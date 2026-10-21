import { colorToHex } from './color.js';

/**
 * A compact, lossless palette-indexed representation for the in-chat canvas.
 * One character per pixel, base64-ish symbol set, one row per image row.
 * The client decodes it back to ImageData; no image request is required.
 */
export const INLINE_SYMBOLS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
const MAX_PIXELS = 131_072;
const MAX_COLORS = INLINE_SYMBOLS.length;

/**
 * @param {{width:number,height:number,frames:Array<{raster:any,durationMs:number,label?:string}>}} input
 */
export function buildInlineCanvas({ width, height, frames }) {
  const frameCount = frames.length;
  const totalPixels = width * height * frameCount;
  if (totalPixels > MAX_PIXELS) {
    return {
      available: false,
      width,
      height,
      colors: [],
      frames: [],
      reason: `${width}×${height}×${frameCount} exceeds the ${MAX_PIXELS.toLocaleString('en-US')}-pixel inline budget; open the PNG/GIF instead.`,
    };
  }

  const colors = [];
  const indexByHex = new Map();
  for (const frame of frames) {
    for (const pixel of frame.raster.pixels) {
      if (pixel === null) continue;
      const hex = colorToHex(pixel);
      if (!indexByHex.has(hex)) {
        if (colors.length >= MAX_COLORS) {
          return {
            available: false,
            width,
            height,
            colors: [],
            frames: [],
            reason: `The artwork uses more than ${MAX_COLORS} colours; open the PNG/GIF instead.`,
          };
        }
        indexByHex.set(hex, colors.length);
        colors.push(hex);
      }
    }
  }

  const inlineFrames = frames.map((frame, index) => {
    const rows = new Array(height);
    for (let y = 0; y < height; y += 1) {
      let row = '';
      for (let x = 0; x < width; x += 1) {
        const pixel = frame.raster.pixels[y * width + x];
        row += pixel === null ? '.' : INLINE_SYMBOLS[indexByHex.get(colorToHex(pixel))];
      }
      rows[y] = row;
    }
    return {
      rows,
      durationMs: frame.durationMs,
      label: frame.label ?? `Frame ${index + 1}`,
    };
  });

  return {
    available: true,
    width,
    height,
    colors,
    frames: inlineFrames,
  };
}
