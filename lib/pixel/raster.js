import { blendOver, parseColor, requireColor } from './color.js';

/** @typedef {{r:number,g:number,b:number,a:number}} Rgba */
/** @typedef {Rgba|null} Pixel */
/** @typedef {{width:number,height:number,pixels:Pixel[]}} Raster */

/**
 * Parse one text grid.
 * @param {string[]} rows
 * @param {Map<string, Rgba>} legend
 * @param {string} label
 * @returns {Raster}
 */
export function parseGrid(rows, legend, label = 'grid') {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${label} must be a non-empty array of strings, one string per pixel row`);
  }
  for (let index = 0; index < rows.length; index += 1) {
    if (typeof rows[index] !== 'string') {
      throw new Error(`${label}[${index}] must be a string`);
    }
  }
  const height = rows.length;
  const width = rows[0].length;
  if (width === 0) throw new Error(`${label} rows cannot be empty`);
  for (let y = 0; y < height; y += 1) {
    if (rows[y].length !== width) {
      throw new Error(`${label} is ragged: row ${y + 1} has ${rows[y].length} characters, expected ${width}`);
    }
  }
  const pixels = new Array(width * height).fill(null);
  for (let y = 0; y < height; y += 1) {
    const row = rows[y];
    for (let x = 0; x < width; x += 1) {
      const symbol = row[x];
      if (symbol === '.' || symbol === ' ') {
        pixels[y * width + x] = null;
        continue;
      }
      const color = legend.get(symbol);
      if (color === undefined) {
        const allowed = [...legend.keys()].join('') || '(none)';
        throw new Error(`${label} uses unknown symbol ${JSON.stringify(symbol)} at row ${y + 1}, column ${x + 1}; allowed symbols: . ${allowed}`);
      }
      pixels[y * width + x] = { ...color };
    }
  }
  return { width, height, pixels };
}

/**
 * Composite layers bottom-to-top with source-over alpha.
 * @param {number} width
 * @param {number} height
 * @param {Array<{raster:Raster,x:number,y:number,opacity:number,name?:string}>} layers
 * @returns {Raster}
 */
export function composeLayers(width, height, layers) {
  const pixels = new Array(width * height).fill(null);
  for (const layer of layers) {
    const { raster, x = 0, y = 0, opacity = 1 } = layer;
    for (let sy = 0; sy < raster.height; sy += 1) {
      for (let sx = 0; sx < raster.width; sx += 1) {
        const src = raster.pixels[sy * raster.width + sx];
        if (src === null) continue;
        const tx = x + sx;
        const ty = y + sy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        const index = ty * width + tx;
        const dst = pixels[index] ?? { r: 0, g: 0, b: 0, a: 0 };
        const result = blendOver(dst, src, opacity);
        pixels[index] = result.a <= 0.5 ? null : result;
      }
    }
  }
  return { width, height, pixels };
}

/**
 * Nearest-neighbour integer-ish scaling with exact pixel boundaries.
 * @param {Raster} raster
 * @param {number} width
 * @param {number} height
 * @returns {Raster}
 */
export function scaleRaster(raster, width, height) {
  if (width === raster.width && height === raster.height) {
    return { width, height, pixels: raster.pixels.map((pixel) => (pixel ? { ...pixel } : null)) };
  }
  const pixels = new Array(width * height).fill(null);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(raster.height - 1, Math.floor((y * raster.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(raster.width - 1, Math.floor((x * raster.width) / width));
      const pixel = raster.pixels[sy * raster.width + sx];
      pixels[y * width + x] = pixel ? { ...pixel } : null;
    }
  }
  return { width, height, pixels };
}

/**
 * Add a 4-neighbour one-pixel outline around every opaque pixel. Existing
 * pixels are never replaced, so outlines stay outside the silhouette.
 * @param {Raster} raster
 * @param {string} colorHex
 * @returns {Raster}
 */
export function outlineRaster(raster, colorHex) {
  const color = requireColor(colorHex, 'outlineColor');
  const { width, height } = raster;
  const pixels = raster.pixels.map((pixel) => (pixel ? { ...pixel } : null));
  const copy = raster.pixels;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < width && y < height && copy[y * width + x] !== null;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (copy[y * width + x] !== null) continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) {
        pixels[y * width + x] = { ...color };
      }
    }
  }
  return { width, height, pixels };
}

/**
 * Add a translated, translucent drop shadow underneath opaque pixels.
 * @param {Raster} raster
 * @param {string} colorHex
 * @param {number} dx
 * @param {number} dy
 * @returns {Raster}
 */
export function shadowRaster(raster, colorHex, dx = 1, dy = 1) {
  const color = requireColor(colorHex, 'shadowColor');
  const { width, height } = raster;
  const pixels = raster.pixels.map((pixel) => (pixel ? { ...pixel } : null));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (raster.pixels[y * width + x] === null) continue;
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
      const index = ty * width + tx;
      if (pixels[index] !== null) continue;
      pixels[index] = { ...color };
    }
  }
  return { width, height, pixels };
}

/**
 * Fill the transparent area with a background colour. If the background is
 * translucent it is composited beneath the artwork.
 * @param {Raster} raster
 * @param {string} colorHex
 * @returns {Raster}
 */
export function fillBackground(raster, colorHex) {
  const color = requireColor(colorHex, 'background');
  if (color.a === 0) return raster;
  const pixels = new Array(raster.width * raster.height);
  for (let index = 0; index < pixels.length; index += 1) {
    const pixel = raster.pixels[index];
    pixels[index] = pixel === null
      ? { ...color }
      : blendOver(color, pixel);
  }
  return { width: raster.width, height: raster.height, pixels };
}

/**
 * Draw a checkerboard beneath transparent pixels, for user-facing previews.
 * @param {Raster} raster
 * @param {number} cell
 * @returns {Raster}
 */
export function checkerPreview(raster, cell = 8) {
  const dark = { r: 46, g: 52, b: 64, a: 255 };
  const light = { r: 58, g: 66, b: 80, a: 255 };
  const pixels = new Array(raster.width * raster.height);
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      const index = y * raster.width + x;
      const pixel = raster.pixels[index];
      const board = ((Math.floor(x / cell) + Math.floor(y / cell)) & 1) === 0 ? dark : light;
      pixels[index] = pixel === null ? { ...board } : blendOver(board, pixel);
    }
  }
  return { width: raster.width, height: raster.height, pixels };
}

/**
 * Translate a raster by an integer offset.
 * @param {Raster} raster
 * @param {number} dx
 * @param {number} dy
 */
export function translateRaster(raster, dx, dy) {
  const pixels = new Array(raster.width * raster.height).fill(null);
  for (let y = 0; y < raster.height; y += 1) {
    const ty = y + dy;
    if (ty < 0 || ty >= raster.height) continue;
    for (let x = 0; x < raster.width; x += 1) {
      const tx = x + dx;
      if (tx < 0 || tx >= raster.width) continue;
      const pixel = raster.pixels[y * raster.width + x];
      if (pixel) pixels[ty * raster.width + tx] = { ...pixel };
    }
  }
  return { width: raster.width, height: raster.height, pixels };
}

/**
 * Nearest-neighbour scale around an anchor (fractions of the canvas).
 * @param {Raster} raster
 * @param {number} sx
 * @param {number} sy
 * @param {number} anchorX 0..1
 * @param {number} anchorY 0..1
 */
export function scaleAround(raster, sx, sy, anchorX = 0.5, anchorY = 0.5) {
  const { width, height } = raster;
  const cx = (width - 1) * anchorX;
  const cy = (height - 1) * anchorY;
  const pixels = new Array(width * height).fill(null);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.round((x - cx) / sx + cx);
      const sourceY = Math.round((y - cy) / sy + cy);
      if (sourceX < 0 || sourceY < 0 || sourceX >= width || sourceY >= height) continue;
      const pixel = raster.pixels[sourceY * width + sourceX];
      if (pixel) pixels[y * width + x] = { ...pixel };
    }
  }
  return { width, height, pixels };
}

/**
 * Nearest-neighbour rotation around the canvas centre.
 * @param {Raster} raster
 * @param {number} radians
 */
export function rotateRaster(raster, radians) {
  const { width, height } = raster;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const pixels = new Array(width * height).fill(null);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const sourceX = Math.round(dx * cos + dy * sin + cx);
      const sourceY = Math.round(-dx * sin + dy * cos + cy);
      if (sourceX < 0 || sourceY < 0 || sourceX >= width || sourceY >= height) continue;
      const pixel = raster.pixels[sourceY * width + sourceX];
      if (pixel) pixels[y * width + x] = { ...pixel };
    }
  }
  return { width, height, pixels };
}

const TWO_PI = Math.PI * 2;

/**
 * Apply one of the built-in motion recipes to a frame.
 * @param {Raster} raster
 * @param {{preset:string,index:number,count:number,amplitude:number}} motion
 * @returns {Raster}
 */
export function motionRaster(raster, { preset, index, count, amplitude = 2 }) {
  const t = count <= 0 ? 0 : index / count;
  const phase = TWO_PI * t;
  const amp = Math.max(0, Math.round(amplitude));
  switch (preset) {
    case 'none':
      return raster;
    case 'bob': {
      const dy = -Math.max(1, amp) * Math.round((1 - Math.cos(phase)) / 2);
      return translateRaster(raster, 0, dy);
    }
    case 'float': {
      const dy = -Math.max(1, amp) * Math.round((1 - Math.cos(phase)) / 2);
      const dx = Math.round((amp / 2) * Math.sin(phase));
      return translateRaster(raster, dx, dy);
    }
    case 'breathe': {
      const sway = (amp / 32) * Math.sin(phase);
      const sx = 1 - sway * 0.5;
      const sy = 1 + sway;
      const scaled = scaleAround(raster, sx, sy, 0.5, 1);
      return translateRaster(scaled, 0, -Math.round((sy - 1) * raster.height / 2));
    }
    case 'sway':
      return translateRaster(raster, Math.round(amp * Math.sin(phase)), 0);
    case 'shake': {
      const dx = (index % 2 === 0 ? -1 : 1) * Math.max(1, Math.round(amp / 2));
      const dy = index % 4 < 2 ? 0 : 1;
      return translateRaster(raster, dx, dy);
    }
    case 'pulse': {
      const scale = 1 + (amp / 32) * Math.sin(phase);
      return scaleAround(raster, scale, scale, 0.5, 0.5);
    }
    case 'spin':
      return rotateRaster(raster, phase);
    case 'orbit': {
      const radius = Math.max(1, amp);
      return translateRaster(
        raster,
        Math.round(radius * Math.cos(phase)),
        Math.round(radius * Math.sin(phase)),
      );
    }
    default:
      throw new Error(`unknown motion preset "${preset}"`);
  }
}

/**
 * Convert the object pixel raster to a packed RGBA buffer.
 * @param {Raster} raster
 * @returns {Uint8ClampedArray}
 */
export function toRgba(raster) {
  const buffer = new Uint8ClampedArray(raster.width * raster.height * 4);
  for (let index = 0; index < raster.pixels.length; index += 1) {
    const pixel = raster.pixels[index];
    if (pixel === null) continue;
    const offset = index * 4;
    buffer[offset] = pixel.r;
    buffer[offset + 1] = pixel.g;
    buffer[offset + 2] = pixel.b;
    buffer[offset + 3] = pixel.a;
  }
  return buffer;
}

/**
 * Parse a background argument: "transparent" or a hex colour.
 * @param {unknown} value
 * @returns {string|null}
 */
export function parseBackground(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('background must be "transparent" or a hex colour');
  if (value.toLowerCase() === 'transparent') return null;
  return requireColor(value, 'background').a === 0 ? null : value;
}

/**
 * Normalise a colour key for equality checks.
 * @param {Pixel} pixel
 */
export function pixelKey(pixel) {
  if (pixel === null) return null;
  return `${Math.round(pixel.r)},${Math.round(pixel.g)},${Math.round(pixel.b)},${Math.round(pixel.a)}`;
}

/**
 * Parse a colour argument with a useful label.
 * @param {unknown} value
 * @param {string} label
 * @returns {Rgba}
 */
export function colorArg(value, label) {
  const color = parseColor(value);
  if (!color) throw new Error(`${label} must be a hex colour`);
  return color;
}
