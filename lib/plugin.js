import { PIXEL_CRAFT_PROMPT } from './craft-prompt.js';
import {
  buildAnimation,
  buildStatic,
  MOTION_PRESETS,
  TEMPLATE_NAMES,
} from './pixel/art.js';
import { PALETTE_NAMES } from './pixel/palette.js';
import { buildShader } from './pixel/shader.js';
import { writeArtifacts } from './pixel/output.js';

export const name = 'pixel-studio';
export const inject = ['tools', 'workingDirectory', 'systemPrompt'];

const GRID_SCHEMA = {
  type: 'array',
  items: { type: 'string' },
  description: 'Rows of one-character pixels. "." is transparent. Every row must have the same length.',
};

const LAYER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', description: 'Layer name for the manifest and OYPX project.' },
    grid: { ...GRID_SCHEMA, description: 'Layer pixels, same one-character-per-pixel format.' },
    x: { type: 'integer', description: 'Horizontal offset in canvas pixels; may be negative when width/height are explicit.' },
    y: { type: 'integer', description: 'Vertical offset in canvas pixels; may be negative when width/height are explicit.' },
    opacity: { type: 'number', description: 'Layer opacity from 0 to 1. Defaults to 1.' },
  },
  required: ['grid'],
};

const FRAME_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    grid: GRID_SCHEMA,
    layers: {
      type: 'array',
      items: LAYER_SCHEMA,
      description: 'Layered frame pixels, bottom-to-top. Use either grid or layers.',
    },
    durationMs: { type: 'integer', description: 'Frame hold time in milliseconds (10–10000). Defaults to 1000/fps.' },
    label: { type: 'string', description: 'Optional frame label, for example "walk-1".' },
  },
};

const EFFECTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    outline: { type: 'boolean', description: 'Add a 4-neighbour outline around the silhouette.' },
    outlineColor: { type: 'string', description: 'Hex outline colour. Defaults to the darkest palette colour.' },
    shadow: { type: 'boolean', description: 'Add a translucent drop shadow.' },
    shadowColor: { type: 'string', description: 'Hex shadow colour, alpha included. Defaults to #00000080.' },
    shadowX: { type: 'integer', description: 'Shadow X offset, -8..8. Defaults to 1.' },
    shadowY: { type: 'integer', description: 'Shadow Y offset, -8..8. Defaults to 1.' },
  },
};

const COMMON_PROPERTIES = {
  name: {
    type: 'string',
    description: 'Artwork name; used as the file stem. Spaces and unsafe filename characters are normalised.',
  },
  width: { type: 'integer', description: 'Canvas width. Omit it to infer the size from the grid.' },
  height: { type: 'integer', description: 'Canvas height. Omit it to infer the size from the grid.' },
  grid: GRID_SCHEMA,
  layers: {
    type: 'array',
    items: LAYER_SCHEMA,
    description: 'Layered pixels, bottom-to-top. Use either grid or layers, not both.',
  },
  template: {
    type: 'string',
    enum: TEMPLATE_NAMES,
    description: 'Start from a built-in 16×16 sprite template. Mutually exclusive with grid/layers.',
  },
  palette: {
    type: 'string',
    enum: PALETTE_NAMES,
    description: 'Built-in palette. Mutually exclusive with paletteColors. Defaults to sweetie16.',
  },
  paletteColors: {
    type: 'array',
    items: { type: 'string' },
    description: 'Custom palette as hex colours (#RGB, #RGBA, #RRGGBB or #RRGGBBAA), up to 64.',
  },
  legend: {
    type: 'object',
    additionalProperties: true,
    description: 'Optional map of single-character symbols to hex colours. When present, grid symbols address the legend instead of palette indices.',
  },
  background: {
    type: 'string',
    description: '"transparent" (default) or a hex colour to fill behind the artwork.',
  },
  effects: EFFECTS_SCHEMA,
  outputDir: {
    type: 'string',
    description: 'Directory for generated files, relative to the session working directory or absolute. Defaults to "pixel-art".',
  },
  scale: {
    type: 'integer',
    description: 'Nearest-neighbour preview scale, 1..24. Defaults to a size-appropriate value.',
  },
  sheetColumns: { type: 'integer', description: 'Sprite-sheet column count. Defaults to min(frameCount, 8).' },
  padding: { type: 'integer', description: 'Sprite-sheet outer padding in pixels, 0..16. Defaults to 0.' },
  gutter: { type: 'integer', description: 'Sprite-sheet space between cells in pixels, 0..16. Defaults to 0.' },
  includeViewer: { type: 'boolean', description: 'Write an optional standalone HTML viewer. Defaults to false because the native chat canvas is primary.' },
  includeOypx: { type: 'boolean', description: 'Write the oy-pixel OYPX project. Defaults to true.' },
};

const ART_PROPERTIES = { ...COMMON_PROPERTIES };
delete ART_PROPERTIES.sheetColumns;
delete ART_PROPERTIES.padding;
delete ART_PROPERTIES.gutter;

const ANIMATION_PROPERTIES = {
  ...COMMON_PROPERTIES,
  frames: {
    type: 'array',
    items: FRAME_SCHEMA,
    description: 'Explicit animation frames. Mutually exclusive with the top-level base grid/layers/template.',
  },
  motion: {
    type: 'object',
    additionalProperties: false,
    properties: {
      preset: { type: 'string', enum: MOTION_PRESETS, description: 'Motion recipe. Defaults to bob.' },
      frames: { type: 'integer', description: 'Number of generated frames, 2..24. Defaults to 6.' },
      fps: { type: 'number', description: 'Generated frame rate, 1..30. Defaults to the top-level fps.' },
      amplitude: { type: 'integer', description: 'Motion amplitude in pixels, 0..16. Defaults to 2.' },
    },
    description: 'Apply a built-in motion recipe to the base artwork. Use this instead of explicit frames.',
  },
  fps: { type: 'number', description: 'Animation frame rate for generated/explicit frames. Defaults to 12.' },
  loop: { type: 'integer', description: 'GIF loop count: 0 = infinite, 1 = play once, 2+ = repeat count. Defaults to 0.' },
  sheetColumns: { type: 'integer', description: 'Sprite-sheet column count. Defaults to min(frameCount, 8).' },
  padding: { type: 'integer', description: 'Sprite-sheet outer padding in pixels, 0..16. Defaults to 0.' },
  gutter: { type: 'integer', description: 'Sprite-sheet space between cells in pixels, 0..16. Defaults to 0.' },
};

const SHADER_PROPERTIES = {
  name: COMMON_PROPERTIES.name,
  width: { type: 'integer', description: 'Canvas width, 1..256. Defaults to 32.' },
  height: { type: 'integer', description: 'Canvas height, 1..256. Defaults to 32.' },
  code: {
    type: 'string',
    description: 'Lua-subset shader script. Canvas API: canvas.pset/pget/line/rect/rectfill/circle/circfill/ellipse/ellipsefill/flood/replace/outline/clear/stamp. Helpers: pal(i), hex, mix, hsv, alpha, rand, noise, math.*, string.*. Globals: width, height, time, phase, frame_index, frame_count.',
  },
  palette: COMMON_PROPERTIES.palette,
  paletteColors: COMMON_PROPERTIES.paletteColors,
  frameCount: { type: 'integer', description: 'Number of timeline frames, 1..120. Defaults to 1; 2+ renders an animation sampled with time/phase.' },
  fps: { type: 'number', description: 'Animation frame rate, 1..30. Defaults to 12.' },
  loop: { type: 'integer', description: 'GIF loop count: 0 infinite, 1 once, 2+ repeats. Defaults to 0.' },
  seed: { type: 'integer', description: 'Deterministic seed for rand() and noise(). Defaults to 1.' },
  background: COMMON_PROPERTIES.background,
  outputDir: COMMON_PROPERTIES.outputDir,
  scale: COMMON_PROPERTIES.scale,
  sheetColumns: COMMON_PROPERTIES.sheetColumns,
  padding: COMMON_PROPERTIES.padding,
  gutter: COMMON_PROPERTIES.gutter,
  includeViewer: COMMON_PROPERTIES.includeViewer,
  includeOypx: COMMON_PROPERTIES.includeOypx,
};

const COMMON_KEYS = new Set([
  'name', 'width', 'height', 'grid', 'layers', 'template', 'palette', 'paletteColors',
  'legend', 'background', 'effects', 'outputDir', 'scale',
  'sheetColumns', 'padding', 'gutter', 'includeViewer', 'includeOypx',
]);
const ART_KEYS = new Set([...COMMON_KEYS].filter((key) => !['sheetColumns', 'padding', 'gutter'].includes(key)));
const ANIMATION_KEYS = new Set([...COMMON_KEYS, 'frames', 'motion', 'fps', 'loop']);
const SHADER_KEYS = new Set(Object.keys(SHADER_PROPERTIES));

function assertPlainObject(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertKnownKeys(args, allowed, label) {
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) throw new Error(`${label} does not accept "${key}"`);
  }
}

function assertInteger(value, label, min, max) {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
}

function validateArgs(args, mode) {
  const label = mode === 'shader' ? 'pixel_shader' : mode === 'animation' ? 'pixel_animation' : 'pixel_art';
  const keys = mode === 'shader' ? SHADER_KEYS : mode === 'animation' ? ANIMATION_KEYS : ART_KEYS;
  assertKnownKeys(args, keys, label);
  if (typeof args.name !== 'string' || args.name.trim() === '') throw new Error('name must be a non-empty string');
  if (args.outputDir !== undefined && (typeof args.outputDir !== 'string' || args.outputDir.trim() === '')) {
    throw new Error('outputDir must be a non-empty string');
  }
  assertInteger(args.width, 'width', 1, 256);
  assertInteger(args.height, 'height', 1, 256);
  assertInteger(args.scale, 'scale', 1, 24);
  assertInteger(args.sheetColumns, 'sheetColumns', 1, 120);
  assertInteger(args.padding, 'padding', 0, 16);
  assertInteger(args.gutter, 'gutter', 0, 16);
  assertInteger(args.loop, 'loop', 0, 100);
  if (args.background !== undefined && typeof args.background !== 'string') throw new Error('background must be a string');
  if (args.includeViewer !== undefined && typeof args.includeViewer !== 'boolean') throw new Error('includeViewer must be a boolean');
  if (args.includeOypx !== undefined && typeof args.includeOypx !== 'boolean') throw new Error('includeOypx must be a boolean');
  if (args.paletteColors !== undefined && !Array.isArray(args.paletteColors)) throw new Error('paletteColors must be an array');
  if (mode === 'shader') {
    if (typeof args.code !== 'string' || args.code.trim() === '') throw new Error('code must be a non-empty Lua shader script');
    assertInteger(args.frameCount, 'frameCount', 1, 120);
    assertInteger(args.seed, 'seed', 0, 4_294_967_295);
    if (args.fps !== undefined) {
      if (typeof args.fps !== 'number' || !Number.isFinite(args.fps) || args.fps <= 0 || args.fps > 30) {
        throw new Error('fps must be a number between 1 and 30');
      }
    }
    return;
  }
  if (args.legend !== undefined) assertPlainObject(args.legend, 'legend');
  if (args.effects !== undefined) assertPlainObject(args.effects, 'effects');
  if (args.grid !== undefined && !Array.isArray(args.grid)) throw new Error('grid must be an array of strings');
  if (args.layers !== undefined && !Array.isArray(args.layers)) throw new Error('layers must be an array');
  if (mode === 'animation') {
    if (args.frames !== undefined && !Array.isArray(args.frames)) throw new Error('frames must be an array');
    if (args.motion !== undefined) assertPlainObject(args.motion, 'motion');
    if (args.fps !== undefined) {
      if (typeof args.fps !== 'number' || !Number.isFinite(args.fps) || args.fps <= 0 || args.fps > 30) {
        throw new Error('fps must be a number between 1 and 30');
      }
    }
  }
}

function outputSchema() {
  const fileSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string' },
      name: { type: 'string' },
      kind: { type: 'string' },
      description: { type: 'string' },
      bytes: { type: 'integer' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      scale: { type: 'integer' },
      frames: { type: 'integer' },
    },
    required: ['path', 'name', 'kind', 'description', 'bytes'],
  };
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      kind: { type: 'string' },
      name: { type: 'string' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      frameCount: { type: 'integer' },
      fps: { type: 'number' },
      directory: { type: 'string' },
      primaryPath: { type: 'string' },
      imagePath: { type: 'string' },
      previewPath: { type: 'string' },
      gifPath: { type: 'string' },
      sheetPath: { type: 'string' },
      sheetJsonPath: { type: 'string' },
      viewerPath: { type: 'string' },
      oypxPath: { type: 'string' },
      metadataPath: { type: 'string' },
      palette: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          label: { type: 'string' },
          colors: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'label', 'colors'],
      },
      canvas: {
        type: 'object',
        additionalProperties: false,
        properties: {
          available: { type: 'boolean' },
          width: { type: 'integer' },
          height: { type: 'integer' },
          encoding: { type: 'string' },
          colors: { type: 'array', items: { type: 'string' } },
          frames: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                rows: { type: 'array', items: { type: 'string' } },
                durationMs: { type: 'integer' },
                label: { type: 'string' },
              },
              required: ['rows', 'durationMs', 'label'],
            },
          },
          reason: { type: 'string' },
        },
        required: ['available', 'width', 'height', 'colors', 'frames'],
      },
      craft: {
        type: 'object',
        additionalProperties: false,
        properties: {
          score: { type: 'number' },
          checks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                level: { type: 'string', enum: ['warning', 'note'] },
                message: { type: 'string' },
              },
              required: ['id', 'level', 'message'],
            },
          },
          metrics: {
            type: 'object',
            additionalProperties: false,
            properties: {
              colours: { type: 'integer' },
              averageOpaquePixels: { type: 'integer' },
              coverage: { type: 'number' },
              isolatedPixels: { type: 'integer' },
              maxIsolatedPerFrame: { type: 'integer' },
              contrast: { type: 'number' },
              loopDelta: { type: 'number' },
              averageFrameMs: { type: 'integer' },
            },
            required: ['colours', 'averageOpaquePixels', 'coverage', 'isolatedPixels', 'maxIsolatedPerFrame', 'contrast', 'loopDelta', 'averageFrameMs'],
          },
        },
        required: ['score', 'checks', 'metrics'],
      },
      files: { type: 'array', items: fileSchema },
    },
    required: [
      'kind', 'name', 'width', 'height', 'frameCount', 'fps', 'directory',
      'primaryPath', 'imagePath', 'previewPath', 'gifPath', 'sheetPath', 'sheetJsonPath',
      'viewerPath', 'oypxPath', 'metadataPath', 'palette', 'canvas', 'craft', 'files',
    ],
  };
}

function renderResult(_args, value) {
  const lines = [];
  lines.push(`${value.kind === 'animation' ? 'Created pixel animation' : 'Created pixel art'} "${value.name}" (${value.width}×${value.height}, ${value.frameCount} frame${value.frameCount === 1 ? '' : 's'}).`);
  lines.push(`Image: ${value.imagePath}`);
  if (value.gifPath) lines.push(`GIF: ${value.gifPath}`);
  lines.push(`Sprite sheet: ${value.sheetPath}`);
  if (value.oypxPath) lines.push(`OYPX project: ${value.oypxPath}`);
  const warnings = value.craft.checks.filter((check) => check.level === 'warning');
  const notes = value.craft.checks.filter((check) => check.level === 'note');
  lines.push(`Craft check: ${value.craft.score}/100${warnings.length ? ` · ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}${notes.length ? ` · ${notes.length} note${notes.length === 1 ? '' : 's'}` : ''}`);
  for (const check of value.craft.checks.slice(0, 3)) lines.push(`Craft ${check.level}: ${check.message}`);
  lines.push('The native chat canvas renders this result inline; files remain available for export.');
  return [{ type: 'text', text: lines.join('\n') }];
}

function presentationMeta(_args, value) {
  return {
    path: value.imagePath,
    name: value.name,
    kind: value.kind,
    width: value.width,
    height: value.height,
    frameCount: value.frameCount,
    fps: value.fps,
    palette: value.palette,
    craft: value.craft,
    canvas: value.canvas,
    imagePath: value.imagePath,
    previewPath: value.previewPath,
    gifPath: value.gifPath,
    sheetPath: value.sheetPath,
    sheetJsonPath: value.sheetJsonPath,
    oypxPath: value.oypxPath,
    viewerPath: value.viewerPath,
    metadataPath: value.metadataPath,
  };
}

async function executeTool(ctx, args, exec, mode) {
  validateArgs(args, mode);
  if (exec.agent === undefined) throw new Error('pixel studio tools require an agent session');
  const cwd = await ctx.workingDirectory.ensure(exec.agent, exec.signal);
  exec.signal?.throwIfAborted?.();
  const result = mode === 'shader'
    ? buildShader(args)
    : mode === 'animation'
      ? buildAnimation(args)
      : buildStatic(args);
  const output = writeArtifacts(result, {
    cwd,
    outputDir: args.outputDir,
    scale: args.scale,
    loop: args.loop ?? 0,
    sheetColumns: args.sheetColumns,
    padding: args.padding,
    gutter: args.gutter,
    includeViewer: args.includeViewer === true,
    includeOypx: args.includeOypx !== false,
  });
  return {
    kind: result.kind,
    name: result.name,
    width: result.width,
    height: result.height,
    frameCount: result.frames.length,
    fps: result.fps,
    directory: output.directory,
    primaryPath: output.primary,
    imagePath: output.image,
    previewPath: output.preview,
    gifPath: output.gif ?? '',
    sheetPath: output.sheet,
    sheetJsonPath: output.sheetJson,
    viewerPath: output.viewer ?? '',
    oypxPath: output.oypx ?? '',
    metadataPath: output.metadata,
    palette: result.palette,
    canvas: output.inline,
    craft: output.craft,
    files: output.files,
  };
}

const SHADER_DESCRIPTION = 'Render procedural pixel art with a sandboxed, deterministic Lua-subset shader. '
  + 'PREFER THIS over row-by-row grids for gradients, glows, textures, symmetry, patterns, geometric scenes and formula-driven animation: one short script works at any canvas size. '
  + 'Globals: width, height, time (frame start seconds), phase (0..1), frame_index, frame_count. '
  + 'Helpers: pal(i) 1-based palette, hex("#RRGGBBAA"), mix(c1,c2,t), hsv(h,s,v[,a]), alpha(c,a), rand()/rand(a,b), noise(x,y,scale?), clamp(v,min,max), step(edge,v), smoothstep(a,b,v), math.*, string.format/len/lower/upper/sub/rep. '
  + 'Canvas API (always through canvas.*): pset(x,y,c), pget(x,y), line(x0,y0,x1,y1,c), rect(x,y,w,h,c), rectfill(x,y,w,h,c), circle(cx,cy,r,c), circfill(cx,cy,r,c), ellipse(cx,cy,rx,ry,c), ellipsefill(cx,cy,rx,ry,c), flood(x,y,c), replace(old,new), outline(c), clear(c), stamp(rows, legend, x, y) where rows is {"..", ".."} and legend maps symbols to colours, e.g. {o=pal(1)}. nil erases; invalid colours and out-of-bounds pset/pget are errors. '
  + 'Statements: local, assignment, calls, if/elseif/else, numeric for, while, break. Table constructors and [key] indexing are supported for stamp arguments. No user functions, metatables or host access. '
  + 'For animation set frameCount > 1 and drive motion with phase/time; each frame gets a deterministic seed. '
  + 'Apply the PIXEL ART CRAFT / PIXEL ANIMATION CRAFT rules. The result includes a craft report; address warnings by iterating. '
  + 'Files are written under outputDir; the in-chat canvas and file buttons are the delivery.';

function toolDefinition(mode, ctx) {
  const toolName = mode === 'shader' ? 'pixel_shader' : mode === 'animation' ? 'pixel_animation' : 'pixel_art';
  const description = mode === 'shader'
    ? SHADER_DESCRIPTION
    : mode === 'animation'
      ? 'Create a pixel-art animation rendered as a native interactive canvas in the chat: playback, frame stepping, zoom, pixel grid and onion skin. '
        + 'Also write exportable assets: animated GIF, spritesheet + JSON atlas, 1× PNG, nearest-neighbour preview, and an oy-pixel-compatible OYPX project; a standalone HTML viewer is optional. '
        + 'Use for sprites, idle/bounce/float loops, effects, game assets, or any request for pixel animation. '
        + 'Define animation frames with frames[] (grid/layers), or draw one base sprite and let a motion preset generate the frames. '
        + 'Grids use one character per pixel and "." for transparency. Without legend, characters 0-9a-z are indices into the selected palette (default sweetie16); legend maps custom symbols to hex colours. '
        + 'Templates provide a quick base: slime, cat, robot, potion, sword, heart, ghost, star, coin, tree, mushroom, crystal. '
        + 'Apply the PIXEL ART CRAFT and PIXEL ANIMATION CRAFT rules from the system prompt (clean stair-steps, one light source, hue-shifted ramps, ordered dithering, one outline strategy, lean timing, key poses, eased motion, loop seam). '
        + 'The result includes a craft report; address its warnings by iterating. '
        + 'Files are written under outputDir (default pixel-art). The in-chat canvas and file buttons are the delivery; include the image path in the final answer if the user may want to export it.'
      : 'Create pixel art rendered as a native interactive canvas in the chat: zoom, pixel grid and palette, with exportable files. '
        + 'Also write a transparent PNG, nearest-neighbour preview, spritesheet + JSON atlas, and an oy-pixel-compatible OYPX project; a standalone HTML viewer is optional. '
        + 'Use for sprites, icons, game assets, scenes, portraits, or any request to draw/generate pixel art. '
        + 'Draw with grid rows (one character per pixel, "." transparent), layers (bottom-to-top), or a built-in template. '
        + 'Without legend, characters 0-9a-z are indices into the selected palette (default sweetie16); legend maps custom symbols to hex colours. '
        + 'Templates: slime, cat, robot, potion, sword, heart, ghost, star, coin, tree, mushroom, crystal. '
        + 'Apply the PIXEL ART CRAFT rules from the system prompt (clean stair-steps, one light source, hue-shifted ramps, ordered dithering, one outline strategy, sparing AA). '
        + 'The result includes a craft report; address its warnings by iterating. '
        + 'Files are written under outputDir (default pixel-art). The in-chat canvas and file buttons are the delivery; include the image path in the final answer if the user may want to export it.';
  const properties = mode === 'shader' ? SHADER_PROPERTIES : mode === 'animation' ? ANIMATION_PROPERTIES : ART_PROPERTIES;
  return {
    name: toolName,
    description,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties,
      required: mode === 'shader' ? ['name', 'code'] : ['name'],
    },
    output: {
      schema: outputSchema(),
      render: renderResult,
      presentationMeta,
    },
    timeoutMs: 30_000,
    async execute(args, exec) {
      return executeTool(ctx, args, exec, mode);
    },
  };
}

/**
 * Register the three pixel tools. Results carry a compact inline canvas in
 * presentation metadata; the package's client half renders it in chat.
 * @param {any} ctx
 */
export function apply(ctx) {
  ctx.systemPrompt.section({
    name: 'pixel-studio:craft',
    order: 2500,
    text: PIXEL_CRAFT_PROMPT,
  });
  ctx.tools.register(toolDefinition('art', ctx));
  ctx.tools.register(toolDefinition('animation', ctx));
  ctx.tools.register(toolDefinition('shader', ctx));
}
