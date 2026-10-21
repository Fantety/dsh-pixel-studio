import { colorToHex, mix as mixColor, parseColor } from './color.js';
import { parseLua, LuaSyntaxError } from './lua/parser.js';
import { executeLua, LuaRuntimeError } from './lua/runtime.js';
import { parseBackground, fillBackground } from './raster.js';
import { resolvePalette } from './palette.js';
import { assertBudget, slugify } from './art.js';

const MAX_CODE_BYTES = 65_536;
const MAX_INSTRUCTIONS_PER_FRAME = 20_000_000;
const MAX_MILLISECONDS_PER_FRAME = 5_000;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function requireNumber(value, what) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${what} must be a finite number`);
  }
  return value;
}

function requireInteger(value, what) {
  const number = requireNumber(value, what);
  if (!Number.isInteger(number)) throw new Error(`${what} must be an integer`);
  return number;
}

function normalizePaint(value, what = 'color') {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`${what} must be a #RRGGBB/#RRGGBBAA colour or nil`);
  const parsed = parseColor(value);
  if (!parsed) throw new Error(`${what} must be a #RRGGBB/#RRGGBBAA colour or nil`);
  return parsed.a === 0 ? null : colorToHex(parsed);
}

function colorFromHsv(h, s, v, a = 1) {
  const hue = ((requireNumber(h, 'hsv hue') % 360) + 360) % 360;
  const saturation = clamp(requireNumber(s, 'hsv saturation'));
  const value = clamp(requireNumber(v, 'hsv value'));
  const alpha = clamp(requireNumber(a, 'hsv alpha'));
  const c = value * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return colorToHex({
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: Math.round(alpha * 255),
  });
}

function mixPaints(first, second, t) {
  const a = parseColor(normalizePaint(first, 'mix first colour') ?? '#00000000');
  const b = parseColor(normalizePaint(second, 'mix second colour') ?? '#00000000');
  if (!a || !b) throw new Error('mix colours must be valid');
  return colorToHex(mixColor(a, b, clamp(requireNumber(t, 'mix t'))));
}

function withAlpha(value, alpha) {
  const color = parseColor(normalizePaint(value, 'alpha colour') ?? '#00000000');
  if (!color) throw new Error('alpha colour must be valid');
  color.a = Math.round(clamp(requireNumber(alpha, 'alpha value')) * 255);
  return colorToHex(color);
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed) {
  let hash = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

function clipSegment(x0, y0, x1, y1, width, height) {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const checks = [
    [-dx, x0],
    [dx, width - 1 - x0],
    [-dy, y0],
    [dy, height - 1 - y0],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return {
    x0: Math.round(x0 + t0 * dx),
    y0: Math.round(y0 + t0 * dy),
    x1: Math.round(x0 + t1 * dx),
    y1: Math.round(y0 + t1 * dy),
  };
}

class ShaderCanvas {
  constructor(width, height) {
    this.kind = 'shader-canvas';
    this.width = width;
    this.height = height;
    this.pixels = new Array(width * height).fill(null);
    this.changed = 0;
    this.maxChanged = Math.max(65_536, width * height * 2);
  }

  pset(x, y, color) {
    const px = requireInteger(x, 'pset x');
    const py = requireInteger(y, 'pset y');
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) {
      throw new Error(`pset: (${px}, ${py}) is outside the ${this.width}x${this.height} canvas`);
    }
    this.set(px, py, normalizePaint(color, 'pset colour'));
    return null;
  }

  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = y * this.width + x;
    if (this.pixels[index] === color) return;
    if (this.changed >= this.maxChanged) {
      throw new Error(`shader exceeded its ${this.maxChanged} changed-pixel budget`);
    }
    this.changed += 1;
    this.pixels[index] = color;
  }

  pget(x, y) {
    const px = requireInteger(x, 'pget x');
    const py = requireInteger(y, 'pget y');
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) {
      throw new Error(`pget: (${px}, ${py}) is outside the ${this.width}x${this.height} canvas`);
    }
    return this.pixels[py * this.width + px];
  }

  clear(color) {
    const value = normalizePaint(color, 'clear colour');
    for (let index = 0; index < this.pixels.length; index += 1) {
      if (this.pixels[index] !== value) {
        this.changed += 1;
        this.pixels[index] = value;
      }
    }
    return null;
  }

  line(x0, y0, x1, y1, color) {
    const value = normalizePaint(color, 'line colour');
    const clipped = clipSegment(
      requireNumber(x0, 'line x0'), requireNumber(y0, 'line y0'),
      requireNumber(x1, 'line x1'), requireNumber(y1, 'line y1'),
      this.width, this.height,
    );
    if (clipped === null) return null;
    let x = clipped.x0;
    let y = clipped.y0;
    const targetX = clipped.x1;
    const targetY = clipped.y1;
    const dx = Math.abs(targetX - x);
    const sx = x < targetX ? 1 : -1;
    const dy = -Math.abs(targetY - y);
    const sy = y < targetY ? 1 : -1;
    let error = dx + dy;
    while (true) {
      this.set(x, y, value);
      if (x === targetX && y === targetY) break;
      const e2 = 2 * error;
      if (e2 >= dy) {
        error += dy;
        x += sx;
      }
      if (e2 <= dx) {
        error += dx;
        y += sy;
      }
    }
    return null;
  }

  rect(x, y, w, h, color) {
    const value = normalizePaint(color, 'rect colour');
    const left = requireInteger(x, 'rect x');
    const top = requireInteger(y, 'rect y');
    const width = requireInteger(w, 'rect width');
    const height = requireInteger(h, 'rect height');
    if (width < 1 || height < 1) throw new Error(`rect: width/height must be >= 1, got ${width}x${height}`);
    this.line(left, top, left + width - 1, top, value);
    this.line(left, top + height - 1, left + width - 1, top + height - 1, value);
    this.line(left, top, left, top + height - 1, value);
    this.line(left + width - 1, top, left + width - 1, top + height - 1, value);
    return null;
  }

  rectfill(x, y, w, h, color) {
    const value = normalizePaint(color, 'rectfill colour');
    const left = requireInteger(x, 'rectfill x');
    const top = requireInteger(y, 'rectfill y');
    const width = requireInteger(w, 'rectfill width');
    const height = requireInteger(h, 'rectfill height');
    if (width < 1 || height < 1) throw new Error(`rectfill: width/height must be >= 1, got ${width}x${height}`);
    const minX = Math.max(0, left);
    const maxX = Math.min(this.width, left + width);
    const minY = Math.max(0, top);
    const maxY = Math.min(this.height, top + height);
    for (let py = minY; py < maxY; py += 1) {
      for (let px = minX; px < maxX; px += 1) this.set(px, py, value);
    }
    return null;
  }

  circle(cx, cy, r, color) {
    const value = normalizePaint(color, 'circle colour');
    const centerX = requireNumber(cx, 'circle cx');
    const centerY = requireNumber(cy, 'circle cy');
    const radius = requireNumber(r, 'circle radius');
    if (radius < 0) throw new Error('circle radius must be >= 0');
    const minX = Math.max(0, Math.floor(centerX - radius - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius + 1));
    const minY = Math.max(0, Math.floor(centerY - radius - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius + 1));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.hypot(x - centerX, y - centerY);
        if (Math.abs(distance - radius) <= 0.55) this.set(x, y, value);
      }
    }
    return null;
  }

  circfill(cx, cy, r, color) {
    const value = normalizePaint(color, 'circfill colour');
    const centerX = requireNumber(cx, 'circfill cx');
    const centerY = requireNumber(cy, 'circfill cy');
    const radius = requireNumber(r, 'circfill radius');
    if (radius < 0) throw new Error('circfill radius must be >= 0');
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (Math.hypot(x - centerX, y - centerY) <= radius + 0.5) this.set(x, y, value);
      }
    }
    return null;
  }

  ellipse(cx, cy, rx, ry, color) {
    const value = normalizePaint(color, 'ellipse colour');
    const centerX = requireNumber(cx, 'ellipse cx');
    const centerY = requireNumber(cy, 'ellipse cy');
    const radiusX = requireNumber(rx, 'ellipse rx');
    const radiusY = requireNumber(ry, 'ellipse ry');
    if (radiusX <= 0 || radiusY <= 0) throw new Error('ellipse radii must be > 0');
    const minX = Math.max(0, Math.floor(centerX - radiusX - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(centerX + radiusX + 1));
    const minY = Math.max(0, Math.floor(centerY - radiusY - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(centerY + radiusY + 1));
    const band = Math.min(0.12, 1 / Math.max(radiusX, radiusY));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const q = ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2;
        if (Math.abs(q - 1) <= band) this.set(x, y, value);
      }
    }
    return null;
  }

  ellipsefill(cx, cy, rx, ry, color) {
    const value = normalizePaint(color, 'ellipsefill colour');
    const centerX = requireNumber(cx, 'ellipsefill cx');
    const centerY = requireNumber(cy, 'ellipsefill cy');
    const radiusX = requireNumber(rx, 'ellipsefill rx');
    const radiusY = requireNumber(ry, 'ellipsefill ry');
    if (radiusX <= 0 || radiusY <= 0) throw new Error('ellipsefill radii must be > 0');
    const minX = Math.max(0, Math.floor(centerX - radiusX));
    const maxX = Math.min(this.width - 1, Math.ceil(centerX + radiusX));
    const minY = Math.max(0, Math.floor(centerY - radiusY));
    const maxY = Math.min(this.height - 1, Math.ceil(centerY + radiusY));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const q = ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2;
        if (q <= 1) this.set(x, y, value);
      }
    }
    return null;
  }

  flood(x, y, color) {
    const seedX = requireInteger(x, 'flood x');
    const seedY = requireInteger(y, 'flood y');
    const value = normalizePaint(color, 'flood colour');
    if (seedX < 0 || seedY < 0 || seedX >= this.width || seedY >= this.height) {
      throw new Error(`flood: (${seedX}, ${seedY}) is outside the canvas`);
    }
    const target = this.pixels[seedY * this.width + seedX];
    if (target === value) return null;
    const stack = [[seedX, seedY]];
    while (stack.length > 0) {
      const [px, py] = stack.pop();
      if (px < 0 || py < 0 || px >= this.width || py >= this.height) continue;
      const index = py * this.width + px;
      if (this.pixels[index] !== target) continue;
      this.set(px, py, value);
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    return null;
  }

  replace(oldColor, newColor) {
    const from = normalizePaint(oldColor, 'replace old colour');
    const to = normalizePaint(newColor, 'replace new colour');
    for (let index = 0; index < this.pixels.length; index += 1) {
      if (this.pixels[index] === from) {
        if (this.pixels[index] !== to) {
          this.changed += 1;
          this.pixels[index] = to;
        }
      }
    }
    return null;
  }

  outline(color) {
    const value = normalizePaint(color, 'outline colour');
    const source = this.pixels.slice();
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (source[y * this.width + x] !== null) continue;
        const left = x > 0 && source[y * this.width + x - 1] !== null;
        const right = x + 1 < this.width && source[y * this.width + x + 1] !== null;
        const up = y > 0 && source[(y - 1) * this.width + x] !== null;
        const down = y + 1 < this.height && source[(y + 1) * this.width + x] !== null;
        if (left || right || up || down) this.set(x, y, value);
      }
    }
    return null;
  }

  stamp(rows, legend, x, y) {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('stamp rows must be a non-empty table of strings');
    if (legend === null || typeof legend !== 'object') {
      throw new Error('stamp legend must be a table mapping symbols to colours');
    }
    if (typeof rows[0] !== 'string' || rows[0].length === 0) throw new Error('stamp row 1 must be a non-empty string');
    const rowWidth = rows[0].length;
    for (let row = 1; row < rows.length; row += 1) {
      const text = rows[row];
      if (typeof text !== 'string') throw new Error(`stamp row ${row + 1} must be a string`);
      if (text.length !== rowWidth) {
        throw new Error(`stamp row ${row + 1} has width ${text.length}; expected ${rowWidth}`);
      }
    }
    const palette = new Map();
    for (const [symbol, color] of Object.entries(legend)) {
      if (symbol.length !== 1) throw new Error(`stamp legend keys must be single characters, got '${symbol}'`);
      palette.set(symbol, normalizePaint(color, `stamp legend '${symbol}'`));
    }
    const originX = requireInteger(x, 'stamp x');
    const originY = requireInteger(y, 'stamp y');
    if (originX < 0 || originY < 0) throw new Error('stamp x/y must be >= 0');
    if (originX + rowWidth > this.width || originY + rows.length > this.height) {
      throw new Error(`stamp: ${rowWidth}x${rows.length} grid at (${originX}, ${originY}) does not fit the ${this.width}x${this.height} canvas`);
    }
    for (let row = 0; row < rows.length; row += 1) {
      const text = rows[row];
      for (let column = 0; column < text.length; column += 1) {
        const symbol = text[column];
        if (symbol === '.') continue;
        if (!palette.has(symbol)) throw new Error(`stamp: symbol '${symbol}' (row ${row + 1}, column ${column + 1}) is missing from the legend`);
        this.set(originX + column, originY + row, palette.get(symbol));
      }
    }
    return null;
  }
}

function formatLua(format, ...args) {
  let index = 0;
  return String(format).replace(/%([%sdifxXeEgGq])/g, (_match, specifier) => {
    if (specifier === '%') return '%';
    const value = args[index];
    index += 1;
    if (value === undefined) throw new Error('string.format has fewer arguments than placeholders');
    if (specifier === 'd' || specifier === 'i') return String(Math.trunc(requireNumber(value, 'string.format integer')));
    if (specifier === 'x') return Math.trunc(requireNumber(value, 'string.format integer')).toString(16);
    if (specifier === 'X') return Math.trunc(requireNumber(value, 'string.format integer')).toString(16).toUpperCase();
    if (specifier === 'f' || specifier === 'e' || specifier === 'E' || specifier === 'g' || specifier === 'G') {
      const number = requireNumber(value, 'string.format number');
      if (specifier === 'f') return number.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
      return String(number);
    }
    return String(value);
  });
}

function createGlobals({ width, height, time, phase, frameIndex, frameCount, seed, palette, canvas }) {
  const random = createRandom(seed);
  const color = (value, what) => normalizePaint(value, what);
  const pal = (index) => {
    const value = requireInteger(index, 'pal index');
    if (value < 1 || value > palette.colors.length) {
      throw new Error(`pal index ${value} is outside 1..${palette.colors.length}`);
    }
    return palette.colors[value - 1];
  };
  const hex = (value) => {
    if (typeof value !== 'string') throw new Error('hex expects a colour string');
    return normalizePaint(value, 'hex colour');
  };
  const rand = (a, b) => {
    if (a === undefined && b === undefined) return random();
    const min = Math.trunc(requireNumber(a, 'rand minimum'));
    const max = Math.trunc(requireNumber(b, 'rand maximum'));
    if (max < min) throw new Error('rand maximum must be >= minimum');
    return min + Math.floor(random() * (max - min + 1));
  };
  const noise = (x, y, scale = 1) => {
    const sx = requireNumber(x, 'noise x') * requireNumber(scale, 'noise scale');
    const sy = requireNumber(y, 'noise y') * requireNumber(scale, 'noise scale');
    return valueNoise(sx, sy, seed);
  };
  const math = {
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    sqrt: Math.sqrt,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    exp: Math.exp,
    log: Math.log,
    pow: Math.pow,
    min: Math.min,
    max: Math.max,
    round: Math.round,
    pi: Math.PI,
    huge: Number.POSITIVE_INFINITY,
    random: () => { throw new Error('math.random is disabled; use rand() for deterministic randomness'); },
  };
  const string = {
    format: formatLua,
    len: (value) => {
      if (typeof value !== 'string') throw new Error('string.len expects a string');
      return value.length;
    },
    lower: (value) => String(value).toLowerCase(),
    upper: (value) => String(value).toUpperCase(),
    rep: (value, count) => {
      const text = String(value);
      const times = Math.max(0, requireInteger(count, 'string.rep count'));
      if (text.length * times > 1_000_000) throw new Error('string.rep result is too large');
      return text.repeat(times);
    },
    sub: (value, start, end) => {
      const text = String(value);
      const from = requireInteger(start, 'string.sub start');
      const to = end === undefined ? text.length : requireInteger(end, 'string.sub end');
      const begin = from < 0 ? Math.max(0, text.length + from) : Math.max(0, from - 1);
      const finish = to < 0 ? text.length + to + 1 : to;
      return text.slice(begin, finish);
    },
  };
  return {
    width,
    height,
    time,
    phase,
    frame_index: frameIndex,
    frame_count: frameCount,
    seed,
    canvas,
    math,
    string,
    pal,
    hex,
    mix: mixPaints,
    hsv: (h, s, v, a) => colorFromHsv(h, s, v, a ?? 1),
    alpha: withAlpha,
    rand,
    noise,
    clamp: (value, min, max) => clamp(requireNumber(value, 'clamp value'), requireNumber(min, 'clamp minimum'), requireNumber(max, 'clamp maximum')),
    step: (edge, value) => requireNumber(value, 'step value') < requireNumber(edge, 'step edge') ? 0 : 1,
    smoothstep: (edge0, edge1, value) => {
      const t = clamp((requireNumber(value, 'smoothstep value') - requireNumber(edge0, 'smoothstep edge0')) / (requireNumber(edge1, 'smoothstep edge1') - requireNumber(edge0, 'smoothstep edge0')));
      return t * t * (3 - 2 * t);
    },
    color,
  };
}

function colorStringToPixel(value) {
  if (value === null) return null;
  const parsed = parseColor(value);
  return parsed ? { r: parsed.r, g: parsed.g, b: parsed.b, a: parsed.a } : null;
}

/**
 * Compile and render a procedural pixel-art shader.
 * @param {Record<string, any>} args
 */
export function buildShader(args) {
  const code = typeof args.code === 'string' ? args.code : '';
  if (code.trim() === '') throw new Error('code must be a non-empty Lua shader script');
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    throw new Error(`code exceeds the ${MAX_CODE_BYTES}-byte shader limit`);
  }
  const width = args.width ?? 32;
  const height = args.height ?? 32;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256) {
    throw new Error('width and height must be integers between 1 and 256');
  }
  const frameCount = args.frameCount ?? 1;
  if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > 120) {
    throw new Error('frameCount must be an integer between 1 and 120');
  }
  const fps = args.fps ?? 12;
  if (typeof fps !== 'number' || !Number.isFinite(fps) || fps <= 0 || fps > 30) {
    throw new Error('fps must be a number between 1 and 30');
  }
  assertBudget(width, height, frameCount);
  const palette = resolvePalette(args);
  const seed = Number.isInteger(args.seed) ? args.seed >>> 0 : 1;
  const background = parseBackground(args.background);
  let ast;
  try {
    ast = parseLua(code);
  } catch (error) {
    if (error instanceof LuaSyntaxError) {
      throw new Error(`shader syntax error at line ${error.line}: ${error.message}`);
    }
    throw error;
  }
  const frames = [];
  const startedAt = Date.now();
  for (let index = 0; index < frameCount; index += 1) {
    if (Date.now() - startedAt > 10_000) {
      throw new Error('shader exceeded its 10s total generation budget; reduce frameCount or simplify the loops');
    }
    const frameSeed = (seed + Math.imul(index, 0x9e3779b1)) >>> 0;
    const canvas = new ShaderCanvas(width, height);
    const globals = createGlobals({
      width,
      height,
      time: index / fps,
      phase: frameCount === 1 ? 0 : index / frameCount,
      frameIndex: index,
      frameCount,
      seed: frameSeed,
      palette,
      canvas,
    });
    try {
      executeLua(ast, globals, {
        maxInstructions: MAX_INSTRUCTIONS_PER_FRAME,
        maxMilliseconds: MAX_MILLISECONDS_PER_FRAME,
      });
    } catch (error) {
      if (error instanceof LuaRuntimeError) {
        throw new Error(`shader error at line ${error.line}: ${error.message}`);
      }
      throw error;
    }
    let raster = {
      width,
      height,
      pixels: canvas.pixels.map(colorStringToPixel),
    };
    if (background !== null) raster = fillBackground(raster, background);
    frames.push({
      raster,
      durationMs: Math.max(10, Math.round(1000 / fps)),
      label: frameCount > 1 ? `shader ${index + 1}` : 'Shader',
    });
  }
  return {
    kind: frameCount > 1 ? 'animation' : 'art',
    name: slugify(args.name),
    width,
    height,
    palette,
    frames,
    fps: frameCount > 1 ? fps : 1,
    loop: Number.isInteger(args.loop) ? Math.max(0, Math.min(100, args.loop)) : 0,
    shader: {
      frameCount,
      seed,
      codeBytes: Buffer.byteLength(code, 'utf8'),
    },
  };
}

export { ShaderCanvas, LuaSyntaxError, LuaRuntimeError, MAX_CODE_BYTES };
