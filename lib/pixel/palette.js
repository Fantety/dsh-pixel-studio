import {
  colorToHex,
  darken,
  hue,
  hueDistance,
  lighten,
  luminance,
  mix,
  parseColor,
  saturation,
} from './color.js';

/**
 * Palettes are intentionally small, hand-picked pixel-art palettes. They are
 * the same style of palette the oy-pixel editor ships: a compact index space
 * plus stable semantic ordering for generated sprites.
 */
export const PALETTES = Object.freeze({
  pico8: Object.freeze({
    label: 'PICO-8',
    colors: Object.freeze([
      '#000000', '#1D2B53', '#7E2553', '#008751',
      '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
      '#FF004D', '#FFA300', '#FFEC27', '#00E436',
      '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
    ]),
  }),
  gameboy: Object.freeze({
    label: 'Game Boy DMG',
    colors: Object.freeze(['#0F380F', '#306230', '#8BAC0F', '#9BBC0F']),
  }),
  sweetie16: Object.freeze({
    label: 'Sweetie 16',
    colors: Object.freeze([
      '#1A1C2C', '#5D275D', '#B13E53', '#EF7D57',
      '#FFCD75', '#A7F070', '#38B764', '#257179',
      '#29366F', '#3B5DC9', '#41A6F6', '#73EFF7',
      '#F4F4F4', '#94B0C2', '#566C86', '#333C57',
    ]),
  }),
  dawnbringer16: Object.freeze({
    label: 'DawnBringer 16',
    colors: Object.freeze([
      '#140C1C', '#442434', '#30346D', '#4E4A4E',
      '#854C30', '#346524', '#D04648', '#757161',
      '#597DCE', '#D27D2C', '#8595A1', '#6DAA2C',
      '#D2AA99', '#6DC2CA', '#DAD45E', '#DEEED6',
    ]),
  }),
  dawnbringer32: Object.freeze({
    label: 'DawnBringer 32',
    colors: Object.freeze([
      '#000000', '#222034', '#45283C', '#663931',
      '#8F563B', '#DF7126', '#D9A066', '#EEC39A',
      '#FBF236', '#99E550', '#6ABE30', '#37946E',
      '#4B692F', '#524B24', '#323C39', '#3F3F74',
      '#306082', '#5B6EE1', '#639BFF', '#5FCDE4',
      '#CBDBFC', '#FFFFFF', '#9BADB7', '#847E87',
      '#696A6A', '#595652', '#76428A', '#AC3232',
      '#D95763', '#D77BBA', '#8F974A', '#8A6F30',
    ]),
  }),
  studio: Object.freeze({
    label: 'Studio Warm',
    colors: Object.freeze([
      '#0F0E17', '#232136', '#3D2C3E', '#5A3E4D',
      '#8C5A5A', '#C07A5B', '#E0A458', '#F4D35E',
      '#F7E7CE', '#FFF8E7', '#7A9E7E', '#4F6D5A',
      '#2F4858', '#33658A', '#86BBD8', '#D9F0FF',
    ]),
  }),
  mono: Object.freeze({
    label: 'Ink & Paper',
    colors: Object.freeze(['#101014', '#F8F4E3']),
  }),
});

export const PALETTE_NAMES = Object.freeze(Object.keys(PALETTES));
export const DEFAULT_PALETTE = 'sweetie16';
/** Characters used to address palette indices in a grid. */
export const GRID_SYMBOLS = '0123456789abcdefghijklmnopqrstuvwxyz';

/** @param {string} name */
export function builtInPalette(name) {
  const palette = PALETTES[name];
  if (!palette) {
    throw new Error(`unknown palette "${name}"; choose one of ${PALETTE_NAMES.join(', ')}`);
  }
  return {
    name,
    label: palette.label,
    colors: palette.colors.map((hex) => colorToHex(requirePaletteColor(hex))),
  };
}

function requirePaletteColor(hex) {
  const color = parseColor(hex);
  if (!color) throw new Error(`internal palette contains invalid colour ${hex}`);
  return { ...color, a: 255 };
}

/**
 * Resolve the palette declaration shared by both tools.
 * @param {{palette?: string, paletteColors?: string[]}} args
 * @returns {{name: string, label: string, colors: string[]}}
 */
export function resolvePalette(args) {
  if (args.palette !== undefined && args.paletteColors !== undefined) {
    throw new Error('use either palette (a built-in palette name) or paletteColors (custom hex colours), not both');
  }
  if (args.palette !== undefined) return builtInPalette(args.palette);
  if (args.paletteColors !== undefined) {
    if (!Array.isArray(args.paletteColors) || args.paletteColors.length === 0) {
      throw new Error('paletteColors must contain at least one hex colour');
    }
    if (args.paletteColors.length > 64) {
      throw new Error('paletteColors supports at most 64 colours');
    }
    return {
      name: 'custom',
      label: 'Custom palette',
      colors: args.paletteColors.map((hex, index) => colorToHex(requireColorWithLabel(hex, `paletteColors[${index}]`))),
    };
  }
  return builtInPalette(DEFAULT_PALETTE);
}

function requireColorWithLabel(hex, label) {
  const color = parseColor(hex);
  if (!color) throw new Error(`${label} must be a hex colour`);
  return { ...color, a: 255 };
}

/**
 * Build the character -> RGBA legend used to parse custom grids.
 * @param {{legend?: Record<string,string>, palette: {colors: string[]}}} args
 * @returns {{legend: Map<string, object>, source: 'legend'|'palette'}}
 */
export function resolveLegend(args) {
  if (args.legend !== undefined) {
    if (typeof args.legend !== 'object' || args.legend === null || Array.isArray(args.legend)) {
      throw new Error('legend must be an object mapping single characters to hex colours');
    }
    const entries = Object.entries(args.legend);
    if (entries.length === 0) throw new Error('legend must contain at least one character');
    if (entries.length > 64) throw new Error('legend supports at most 64 symbols');
    const legend = new Map();
    for (const [symbol, hex] of entries) {
      if ([...symbol].length !== 1) throw new Error(`legend key ${JSON.stringify(symbol)} must be exactly one character`);
      if (symbol === '.' || symbol.trim() === '') throw new Error('legend cannot use "." or whitespace as a symbol; they are reserved for transparency');
      const color = parseColor(hex);
      if (!color) throw new Error(`legend[${JSON.stringify(symbol)}] must be a hex colour`);
      legend.set(symbol, color);
    }
    return { legend, source: 'legend' };
  }

  const colors = args.palette.colors;
  if (colors.length > GRID_SYMBOLS.length) {
    throw new Error(`a palette with more than ${GRID_SYMBOLS.length} colours needs an explicit legend because grid symbols are single characters`);
  }
  const legend = new Map();
  for (let index = 0; index < colors.length; index += 1) {
    const color = parseColor(colors[index]);
    if (!color) throw new Error(`palette colour ${colors[index]} is invalid`);
    legend.set(GRID_SYMBOLS[index], color);
  }
  return { legend, source: 'palette' };
}

/**
 * Derive a coherent set of semantic roles from an arbitrary palette. Used to
 * recolour the built-in sprite templates while keeping their shading readable.
 * @param {string[]} colors
 */
export function rolesFromPalette(colors) {
  const parsed = colors.map((hex) => ({ hex, ...parseColor(hex) }));
  const dark = [...parsed].sort((a, b) => luminance(a) - luminance(b));
  const light = [...parsed].sort((a, b) => luminance(b) - luminance(a));
  const outline = dark[0];
  const white = light[0];
  const vivid = [...parsed]
    .filter((color) => color !== outline && color !== white)
    .sort((a, b) => saturation(b) - saturation(a))[0] ?? light[0] ?? dark[0];
  const body = vivid;
  const others = parsed.filter((color) => color !== body && color !== outline);
  const accent = [...others].sort((a, b) => saturation(b) - saturation(a))[0] ?? body;
  const red = [...parsed].sort((a, b) => hueDistance(hue(a), 0) - hueDistance(hue(b), 0))[0] ?? accent;
  const yellow = [...parsed].sort((a, b) => hueDistance(hue(a), 48) - hueDistance(hue(b), 48))[0] ?? accent;
  const skin = [...parsed].sort((a, b) => hueDistance(hue(a), 28) - hueDistance(hue(b), 28))[0] ?? body;
  const metal = [...parsed].sort((a, b) => saturation(a) - saturation(b))[0] ?? white;
  // Hue-shifted ramps: cool shadows and warm highlights read more like painted
  // pixel art than pure black/white lightening.
  const cool = { r: 38, g: 30, b: 78, a: 255 };
  const warm = { r: 255, g: 224, b: 164, a: 255 };
  const shadow = { ...mix(darken(body, 0.3), cool, 0.18), a: 255 };
  const highlight = { ...mix(lighten(body, 0.24), warm, 0.16), a: 255 };
  const shiftedOutline = { ...mix(outline, cool, 0.16), a: 255 };
  return {
    O: colorToHex(shiftedOutline),
    B: colorToHex(body),
    D: colorToHex(shadow),
    L: colorToHex(highlight),
    A: colorToHex(accent),
    W: colorToHex(white),
    E: colorToHex(shiftedOutline),
    M: colorToHex(metal),
    R: colorToHex(red),
    Y: colorToHex(yellow),
    S: colorToHex(skin),
    X: colorToHex(mix(body, outline, 0.5)),
  };
}

/**
 * Work out the palette/role mapping for a template. A palette recolours the
 * template through semantic roles, while an explicit legend overrides roles
 * one character at a time.
 * @param {{template: {theme: Record<string,string>}, args: any, palette: any, legend?: any}} input
 */
export function templateRoles({ template, args, palette, legend }) {
  let roles = { ...template.theme };
  if (args.palette !== undefined || args.paletteColors !== undefined) {
    roles = { ...roles, ...rolesFromPalette(palette.colors) };
  }
  if (legend) {
    for (const [symbol, color] of legend.legend) roles[symbol] = colorToHex(color);
  }
  return roles;
}
