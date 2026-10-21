import { colorToHex } from './color.js';

function frameId(index) {
  return `f${index}`;
}

function rleToken(token, count) {
  return count > 1 ? `${token}*${count}` : token;
}

/**
 * Encode one row as the direct-colour RLE dialect oy-pixel actually reads:
 * `#RRGGBBAA` or `.`, with an optional `*count` run suffix. (The older format
 * notes mention `p<index>` tokens, but the shipped parser accepts direct
 * colours; using them keeps the project openable in oy-pixel 1.x/2.x.)
 * @param {Array<{r:number,g:number,b:number,a:number}|null>} pixels
 * @param {number} width
 * @param {number} y
 */
function encodeRow(pixels, width, y) {
  const tokens = [];
  let current = null;
  let count = 0;
  const flush = () => {
    if (count === 0) return;
    tokens.push(rleToken(current, count));
  };
  for (let x = 0; x < width; x += 1) {
    const pixel = pixels[y * width + x];
    const token = pixel === null ? '.' : colorToHex(pixel);
    if (token === current) {
      count += 1;
    } else {
      flush();
      current = token;
      count = 1;
    }
  }
  flush();
  return tokens.join(' ');
}

/**
 * Serialize frames as an OYPX text project understood by oy-pixel. Pixels are
 * emitted as direct `#RRGGBBAA` colours so both the version-1 and version-2
 * parsers accept the file; the palette is retained for the editor's colour
 * panel and for round-tripping human-readable swatches.
 * @param {{name:string,width:number,height:number,frames:Array<{raster:any,durationMs:number,label?:string}>,fps:number,loop:number,palette:any}} input
 * @returns {string}
 */
export function encodeOypx(input) {
  const {
    name, width, height, frames, fps, loop, palette,
  } = input;
  const paletteEntries = [];
  const seen = new Set();
  for (const frame of frames) {
    for (const pixel of frame.raster.pixels) {
      if (pixel === null) continue;
      const hex = colorToHex(pixel);
      if (seen.has(hex)) continue;
      seen.add(hex);
      paletteEntries.push({
        id: `p${paletteEntries.length}`,
        hex,
        name: `Colour ${paletteEntries.length + 1}`,
      });
    }
  }
  if (paletteEntries.length === 0) {
    paletteEntries.push({ id: 'p0', hex: '#00000000', name: 'Transparent' });
  }
  if (paletteEntries.length > 256) {
    throw new Error('OYPX export supports at most 256 colours; reduce opacity layers or effects');
  }

  const timelineFrames = frames.map((frame, index) => ({
    id: frameId(index),
    index,
    durationMs: frame.durationMs,
    tagIds: [],
  }));
  const cels = frames.map((frame, index) => ({
    frameId: frameId(index),
    encoding: 'rle-row',
    rows: Array.from({ length: height }, (_, y) => encodeRow(frame.raster.pixels, width, y)),
  }));

  const now = new Date().toISOString();
  const document = {
    format: 'oypx',
    version: 2,
    document: {
      id: `doc_${name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'pixel_studio'}`,
      name,
      width,
      height,
      colorMode: 'rgba8',
      background: 'transparent',
      activePaletteId: 'pixel-studio',
      createdAt: now,
      modifiedAt: now,
    },
    palettes: [{
      id: 'pixel-studio',
      name: palette.label ?? 'Pixel Studio',
      colors: paletteEntries,
    }],
    timeline: {
      fps: Number.isFinite(fps) && fps > 0 ? Math.round(fps) : 12,
      loop: loop === 1 ? 'once' : 'loop',
      frames: timelineFrames,
      tags: [],
    },
    revision: 0,
    layers: [{
      id: 'layer_art',
      name: 'Artwork',
      type: 'raster',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      offset: { x: 0, y: 0 },
      cels,
    }],
    exportPresets: [],
    extensions: {
      generatedBy: 'dsh-pixel-studio',
      generatedAt: now,
    },
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}
