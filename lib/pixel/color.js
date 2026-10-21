/**
 * Small, dependency-free colour helpers used by the raster and GIF pipelines.
 * All public colours use #RRGGBBAA internally.
 */

const HEX_RE = /^#?([0-9a-f]{3,8})$/i;

/**
 * Parse #RGB, #RGBA, #RRGGBB or #RRGGBBAA (leading # optional).
 * @param {unknown} input
 * @returns {{r:number,g:number,b:number,a:number}|null}
 */
export function parseColor(input) {
  if (typeof input !== 'string') return null;
  const match = HEX_RE.exec(input.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    hex = [...hex].map((char) => char + char).join('');
  }
  if (hex.length !== 6 && hex.length !== 8) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255;
  return { r, g, b, a };
}

/** @param {{r:number,g:number,b:number,a:number}} color */
export function colorToHex(color) {
  return `#${[color.r, color.g, color.b, color.a]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** Parse and report a readable error. */
export function requireColor(input, label = 'colour') {
  const color = parseColor(input);
  if (!color) {
    throw new Error(`${label} must be a hex colour (#RGB, #RGBA, #RRGGBB or #RRGGBBAA), received ${JSON.stringify(input)}`);
  }
  return color;
}

/**
 * Source-over blend one non-premultiplied RGBA colour over another.
 * @param {{r:number,g:number,b:number,a:number}} dst
 * @param {{r:number,g:number,b:number,a:number}} src
 * @param {number} [opacity=1]
 */
export function blendOver(dst, src, opacity = 1) {
  const sa = (src.a / 255) * Math.max(0, Math.min(1, opacity));
  if (sa <= 0) return { ...dst };
  const da = dst.a / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (src.r * sa + dst.r * da * (1 - sa)) / outA,
    g: (src.g * sa + dst.g * da * (1 - sa)) / outA,
    b: (src.b * sa + dst.b * da * (1 - sa)) / outA,
    a: outA * 255,
  };
}

/** @param {{r:number,g:number,b:number}} color */
export function luminance(color) {
  const channel = (value) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** @param {{r:number,g:number,b:number}} color */
export function saturation(color) {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Hue in degrees, 0 for greys. */
export function hue(color) {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let value;
  if (max === r) value = ((g - b) / delta) % 6;
  else if (max === g) value = (b - r) / delta + 2;
  else value = (r - g) / delta + 4;
  return (value * 60 + 360) % 360;
}

export function hueDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

/** @param {{r:number,g:number,b:number}} color */
export function mix(color, target, amount) {
  const t = Math.max(0, Math.min(1, amount));
  return {
    r: color.r + (target.r - color.r) * t,
    g: color.g + (target.g - color.g) * t,
    b: color.b + (target.b - color.b) * t,
    a: color.a + (target.a - color.a) * t,
  };
}

/** Lighten a colour towards white. */
export function lighten(color, amount = 0.2) {
  return mix(color, { r: 255, g: 255, b: 255, a: color.a }, amount);
}

/** Darken a colour towards black. */
export function darken(color, amount = 0.2) {
  return mix(color, { r: 0, g: 0, b: 0, a: color.a }, amount);
}

/** Squared RGB distance, used for palette matching. */
export function distanceSq(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/** Nearest colour in a palette, ignoring alpha differences. */
export function nearestColor(color, colors) {
  let best = colors[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of colors) {
    const distance = distanceSq(color, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
