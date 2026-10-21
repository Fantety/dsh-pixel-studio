import { colorToHex, mix, parseColor } from './color.js';
import { builtInPalette, GRID_SYMBOLS, resolveLegend, resolvePalette, templateRoles } from './palette.js';
import {
  composeLayers,
  fillBackground,
  motionRaster,
  outlineRaster,
  parseBackground,
  parseGrid,
  scaleRaster,
  shadowRaster,
} from './raster.js';
import { TEMPLATES, TEMPLATE_NAMES } from './templates.js';

export const MAX_DIMENSION = 256;
export const MAX_FRAMES = 120;
export const MAX_FRAME_PIXELS = 8_000_000;
export const MOTION_PRESETS = Object.freeze([
  'none', 'bob', 'float', 'breathe', 'sway', 'shake', 'pulse', 'spin', 'orbit',
]);

/**
 * Make a filesystem-safe slug while keeping CJK names readable.
 * @param {string} input
 */
export function slugify(input) {
  const normalized = String(input ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 56);
  return normalized || `pixel-art-${Date.now()}`;
}

function clampInteger(value, name, min, max, fallback) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  if (value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return value;
}

function paletteFromLegend(legend) {
  const colors = [];
  const seen = new Set();
  for (const color of legend.values()) {
    const hex = colorToHex(color);
    if (!seen.has(hex)) {
      seen.add(hex);
      colors.push(hex);
    }
  }
  return { name: 'legend', label: 'Legend', colors };
}

/**
 * Resolve palette and legend together. A legend without a palette becomes the
 * palette, so the generated OYPX/GIF metadata still describes the colours used.
 * @param {Record<string, any>} args
 */
export function resolveColors(args) {
  let legendResult = null;
  if (args.legend !== undefined) {
    legendResult = resolveLegend({ legend: args.legend, palette: { colors: [] } });
  }
  let palette;
  if (args.palette !== undefined || args.paletteColors !== undefined) {
    palette = resolvePalette(args);
  } else if (legendResult) {
    palette = paletteFromLegend(legendResult.legend);
  } else {
    palette = resolvePalette(args);
  }
  if (legendResult === null) {
    legendResult = resolveLegend({ palette });
  }
  return { palette, legend: legendResult.legend, legendSource: legendResult.source };
}

function templateSpec(args, palette, legend) {
  const template = TEMPLATES[args.template];
  if (!template) throw new Error(`unknown template "${args.template}"; choose one of ${TEMPLATE_NAMES.join(', ')}`);
  const roles = templateRoles({ template, args, palette, legend: args.legend !== undefined ? { legend } : undefined });
  const roleLegend = new Map();
  for (const [symbol, hex] of Object.entries(roles)) {
    roleLegend.set(symbol, parseColor(hex));
  }
  let raster = parseGrid(template.grid, roleLegend, `template ${args.template}`);
  const defaultWidth = 16;
  const defaultHeight = 16;
  const width = clampInteger(args.width, 'width', 1, MAX_DIMENSION, defaultWidth);
  const height = clampInteger(args.height, 'height', 1, MAX_DIMENSION, defaultHeight);
  if (width !== raster.width || height !== raster.height) {
    raster = scaleRaster(raster, width, height);
  }
  return {
    raster,
    durationMs: 100,
    label: template.label,
    defaultMotion: template.defaultMotion ?? 'bob',
  };
}

function layerRasters(spec, args, palette, legend) {
  if (spec.grid !== undefined && spec.layers !== undefined) {
    throw new Error('use either grid or layers, not both');
  }
  if (spec.grid !== undefined && spec.layers !== undefined) throw new Error('unreachable');
  if (spec.layers !== undefined) {
    if (!Array.isArray(spec.layers) || spec.layers.length === 0) {
      throw new Error('layers must be a non-empty array');
    }
    return spec.layers.map((layer, index) => {
      if (typeof layer !== 'object' || layer === null || Array.isArray(layer)) {
        throw new Error(`layers[${index}] must be an object`);
      }
      if (!Array.isArray(layer.grid)) throw new Error(`layers[${index}].grid must be an array of strings`);
      const x = clampInteger(layer.x, `layers[${index}].x`, -MAX_DIMENSION, MAX_DIMENSION, 0);
      const y = clampInteger(layer.y, `layers[${index}].y`, -MAX_DIMENSION, MAX_DIMENSION, 0);
      const opacity = layer.opacity === undefined ? 1 : Number(layer.opacity);
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
        throw new Error(`layers[${index}].opacity must be a number between 0 and 1`);
      }
      return {
        name: typeof layer.name === 'string' ? layer.name : `Layer ${index + 1}`,
        raster: parseGrid(layer.grid, legend, `layers[${index}].grid`),
        x,
        y,
        opacity,
      };
    });
  }
  if (!Array.isArray(spec.grid)) {
    throw new Error('provide grid (rows of one-character pixels) or layers, or choose a template');
  }
  return [{
    name: 'Artwork',
    raster: parseGrid(spec.grid, legend, 'grid'),
    x: 0,
    y: 0,
    opacity: 1,
  }];
}

function inferCanvasSize(layers) {
  let width = 0;
  let height = 0;
  for (const layer of layers) {
    width = Math.max(width, layer.x + layer.raster.width);
    height = Math.max(height, layer.y + layer.raster.height);
  }
  return { width, height };
}

function placeOnCanvas(raster, width, height) {
  if (raster.width === width && raster.height === height) return raster;
  const pixels = new Array(width * height).fill(null);
  for (let y = 0; y < Math.min(height, raster.height); y += 1) {
    for (let x = 0; x < Math.min(width, raster.width); x += 1) {
      const pixel = raster.pixels[y * raster.width + x];
      if (pixel) pixels[y * width + x] = { ...pixel };
    }
  }
  return { width, height, pixels };
}

function buildCustom(spec, args, palette, legend, explicitSize) {
  const layers = layerRasters(spec, args, palette, legend);
  let width;
  let height;
  if (explicitSize) {
    width = explicitSize.width;
    height = explicitSize.height;
    for (const layer of layers) {
      if (layer.x < 0 || layer.y < 0 || layer.x + layer.raster.width > width || layer.y + layer.raster.height > height) {
        throw new Error(`layer "${layer.name}" does not fit the ${width}x${height} canvas`);
      }
    }
  } else {
    const inferred = inferCanvasSize(layers);
    width = inferred.width;
    height = inferred.height;
  }
  if (width <= 0 || height <= 0) throw new Error('the artwork has no pixels');
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`canvas ${width}x${height} exceeds the ${MAX_DIMENSION}px per-side limit`);
  }
  return {
    raster: composeLayers(width, height, layers),
    durationMs: 100,
    label: 'Artwork',
    defaultMotion: 'bob',
  };
}

function explicitSize(args) {
  if (args.width === undefined && args.height === undefined) return null;
  const width = clampInteger(args.width, 'width', 1, MAX_DIMENSION, undefined);
  const height = clampInteger(args.height, 'height', 1, MAX_DIMENSION, undefined);
  if (width === undefined || height === undefined) {
    throw new Error('set both width and height, or neither (the grid size is inferred)');
  }
  return { width, height };
}

/**
 * Build a single-frame raster from a top-level spec.
 * @param {Record<string, any>} args
 * @param {{palette:any,legend:Map<string,any>}} colors
 */
export function buildBaseRaster(args, colors) {
  if (args.template !== undefined) {
    if (args.grid !== undefined || args.layers !== undefined) {
      throw new Error('use either template or grid/layers, not both');
    }
    return templateSpec(args, colors.palette, colors.legend);
  }
  if (args.grid === undefined && args.layers === undefined) {
    throw new Error('provide grid/layers, or a template such as slime, cat, robot, potion, sword, heart, ghost, star, coin, tree, mushroom or crystal');
  }
  return buildCustom(args, args, colors.palette, colors.legend, explicitSize(args));
}

function defaultOutline(palette) {
  const parsed = palette.colors.map((hex) => ({ hex, ...parseColor(hex) })).filter((color) => color);
  parsed.sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b));
  const darkest = parsed[0] ?? { r: 26, g: 22, b: 38, a: 255 };
  return colorToHex({ ...mix(darkest, { r: 38, g: 30, b: 78, a: 255 }, 0.16), a: 255 });
}

function processFrame(raster, args, palette) {
  let result = raster;
  const effects = args.effects ?? {};
  if (effects.outline === true) {
    const color = effects.outlineColor ?? defaultOutline(palette);
    result = outlineRaster(result, color);
  }
  if (effects.shadow === true) {
    const color = effects.shadowColor ?? '#00000080';
    const dx = clampInteger(effects.shadowX, 'effects.shadowX', -8, 8, 1);
    const dy = clampInteger(effects.shadowY, 'effects.shadowY', -8, 8, 1);
    result = shadowRaster(result, color, dx, dy);
  }
  const background = parseBackground(args.background);
  if (background !== null) result = fillBackground(result, background);
  return result;
}

/**
 * Validate the aggregate media budget before allocating frames.
 * @param {number} width
 * @param {number} height
 * @param {number} count
 */
export function assertBudget(width, height, count) {
  if (width <= 0 || height <= 0) throw new Error('canvas dimensions must be positive');
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`canvas ${width}x${height} exceeds the ${MAX_DIMENSION}px per-side limit`);
  }
  if (count < 1 || count > MAX_FRAMES) throw new Error(`frame count must be between 1 and ${MAX_FRAMES}`);
  if (width * height * count > MAX_FRAME_PIXELS) {
    throw new Error(`the ${width}x${height}x${count} animation exceeds the ${MAX_FRAME_PIXELS} pixel budget; reduce the canvas or frame count`);
  }
}

/**
 * Build static pixel art.
 * @param {Record<string, any>} args
 */
export function buildStatic(args) {
  const colors = resolveColors(args);
  const base = buildBaseRaster(args, colors);
  assertBudget(base.raster.width, base.raster.height, 1);
  const raster = processFrame(base.raster, args, colors.palette);
  return {
    kind: 'art',
    name: slugify(args.name),
    width: raster.width,
    height: raster.height,
    palette: colors.palette,
    frames: [{ raster, durationMs: 100, label: base.label ?? 'Artwork' }],
    fps: 1,
  };
}

function frameFromSpec(frame, args, colors, explicit, index) {
  if (frame === null || typeof frame !== 'object' || Array.isArray(frame)) {
    throw new Error(`frames[${index}] must be an object`);
  }
  if (frame.grid !== undefined && frame.layers !== undefined) {
    throw new Error(`frames[${index}] uses both grid and layers`);
  }
  if (frame.grid === undefined && frame.layers === undefined) {
    throw new Error(`frames[${index}] must provide grid or layers`);
  }
  const spec = {
    grid: frame.grid,
    layers: frame.layers,
  };
  const built = buildCustom(spec, args, colors.palette, colors.legend, explicit);
  const raster = built.raster;
  const durationMs = clampInteger(frame.durationMs, `frames[${index}].durationMs`, 10, 10000, 0) || undefined;
  return {
    raster,
    durationMs,
    label: typeof frame.label === 'string' && frame.label.trim() !== '' ? frame.label.trim() : `Frame ${index + 1}`,
  };
}

/**
 * Build an animation from explicit frames or from a base raster plus a motion
 * recipe.
 * @param {Record<string, any>} args
 */
export function buildAnimation(args) {
  const colors = resolveColors(args);
  const explicit = explicitSize(args);
  const fpsArg = args.fps === undefined ? 12 : Number(args.fps);
  if (!Number.isFinite(fpsArg) || fpsArg <= 0 || fpsArg > 30) throw new Error('fps must be between 0 and 30');
  const baseDuration = Math.max(10, Math.round(1000 / fpsArg));

  if (args.frames !== undefined) {
    if (!Array.isArray(args.frames) || args.frames.length < 2) throw new Error('frames must contain at least 2 frames');
    if (args.grid !== undefined || args.layers !== undefined || args.template !== undefined) {
      throw new Error('use frames by themselves, or a base grid/template plus motion; do not combine both inputs');
    }
    if (args.motion !== undefined) throw new Error('use either frames or motion, not both');
    if (args.frames.length > MAX_FRAMES) throw new Error(`at most ${MAX_FRAMES} frames are supported`);
    let parsed = args.frames.map((frame, index) => frameFromSpec(frame, args, colors, explicit, index));
    const width = explicit?.width ?? Math.max(...parsed.map((frame) => frame.raster.width));
    const height = explicit?.height ?? Math.max(...parsed.map((frame) => frame.raster.height));
    assertBudget(width, height, parsed.length);
    parsed = parsed.map((frame, index) => ({
      ...frame,
      raster: processFrame(placeOnCanvas(frame.raster, width, height), args, colors.palette),
      durationMs: frame.durationMs ?? baseDuration,
      label: frame.label ?? `Frame ${index + 1}`,
    }));
    return {
      kind: 'animation',
      name: slugify(args.name),
      width,
      height,
      palette: colors.palette,
      frames: parsed,
      fps: Number((1000 / averageDuration(parsed)).toFixed(2)),
      loop: args.loop ?? 0,
    };
  }

  const base = buildBaseRaster(args, colors);
  const motion = args.motion ?? {};
  const preset = motion.preset ?? base.defaultMotion ?? 'bob';
  if (!MOTION_PRESETS.includes(preset)) {
    throw new Error(`unknown motion preset "${preset}"; choose one of ${MOTION_PRESETS.join(', ')}`);
  }
  const count = clampInteger(motion.frames, 'motion.frames', 2, 24, 6);
  const amplitude = clampInteger(motion.amplitude, 'motion.amplitude', 0, 16, 2);
  const fps = motion.fps === undefined ? fpsArg : Number(motion.fps);
  if (!Number.isFinite(fps) || fps <= 0 || fps > 30) throw new Error('motion.fps must be between 0 and 30');
  const durationMs = Math.max(10, Math.round(1000 / fps));
  assertBudget(base.raster.width, base.raster.height, count);
  const frames = Array.from({ length: count }, (_, index) => ({
    raster: processFrame(
      motionRaster(base.raster, { preset, index, count, amplitude }),
      args,
      colors.palette,
    ),
    durationMs,
    label: `${preset} ${index + 1}`,
  }));
  const loop = Number.isInteger(args.loop) ? Math.max(0, Math.min(100, args.loop)) : 0;
  return {
    kind: 'animation',
    name: slugify(args.name),
    width: base.raster.width,
    height: base.raster.height,
    palette: colors.palette,
    frames,
    fps: Number((1000 / durationMs).toFixed(2)),
    loop,
    motion: { preset, frames: count, amplitude, fps },
  };
}

function averageDuration(frames) {
  return frames.reduce((total, frame) => total + frame.durationMs, 0) / frames.length;
}

export { builtInPalette, GRID_SYMBOLS, TEMPLATE_NAMES };
