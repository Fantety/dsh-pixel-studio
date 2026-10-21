/**
 * Minimal GIF89a animation encoder. It is intentionally dependency-free:
 * pixel art has a tiny palette, so a global colour table plus LZW is enough.
 */

/** @typedef {{width:number,height:number,rgba:Uint8ClampedArray,durationMs:number}} GifFrame */

function medianCut(colors, limit) {
  if (colors.length <= limit) return colors;
  let boxes = [{ colors, weight: sumWeight(colors) }];
  while (boxes.length < limit) {
    boxes.sort((a, b) => boxScore(b) - boxScore(a));
    const box = boxes.shift();
    if (!box || box.colors.length < 2) {
      boxes.push(box);
      break;
    }
    const channel = widestChannel(box.colors);
    const sorted = [...box.colors].sort((a, b) => a[channel] - b[channel]);
    let total = 0;
    const half = box.weight / 2;
    let split = 1;
    for (let index = 0; index < sorted.length - 1; index += 1) {
      total += sorted[index].count;
      if (total >= half) {
        split = Math.max(1, Math.min(sorted.length - 1, index + 1));
        break;
      }
    }
    const left = sorted.slice(0, split);
    const right = sorted.slice(split);
    if (left.length === 0 || right.length === 0) {
      boxes.push(box);
      break;
    }
    boxes.push({ colors: left, weight: sumWeight(left) }, { colors: right, weight: sumWeight(right) });
  }
  return boxes.map((box) => averageColor(box.colors));
}

function sumWeight(colors) {
  return colors.reduce((total, color) => total + color.count, 0);
}

function boxScore(box) {
  if (box.colors.length < 2) return -1;
  const channel = widestChannel(box.colors);
  let min = 255;
  let max = 0;
  for (const color of box.colors) {
    min = Math.min(min, color[channel]);
    max = Math.max(max, color[channel]);
  }
  return (max - min) * Math.log2(box.weight + 1);
}

function widestChannel(colors) {
  let best = 'r';
  let bestRange = -1;
  for (const channel of ['r', 'g', 'b']) {
    let min = 255;
    let max = 0;
    for (const color of colors) {
      min = Math.min(min, color[channel]);
      max = Math.max(max, color[channel]);
    }
    if (max - min > bestRange) {
      bestRange = max - min;
      best = channel;
    }
  }
  return best;
}

function averageColor(colors) {
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const color of colors) {
    total += color.count;
    r += color.r * color.count;
    g += color.g * color.count;
    b += color.b * color.count;
  }
  return {
    r: Math.round(r / total),
    g: Math.round(g / total),
    b: Math.round(b / total),
    count: total,
  };
}

/**
 * Build a global 255-colour palette (plus transparency at index 0).
 * @param {GifFrame[]} frames
 * @returns {{colors: Array<{r:number,g:number,b:number}>, indices: Uint8Array[]}}
 */
function buildPalette(frames) {
  const counts = new Map();
  for (const frame of frames) {
    const data = frame.rgba;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3] < 128) continue;
      const key = `${data[offset]},${data[offset + 1]},${data[offset + 2]}`;
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { r: data[offset], g: data[offset + 1], b: data[offset + 2], count: 1 });
    }
  }
  let colors = [...counts.values()];
  if (colors.length > 255) colors = medianCut(colors, 255);
  if (colors.length === 0) colors = [{ r: 0, g: 0, b: 0, count: 1 }];

  const cache = new Map();
  const nearest = (r, g, b) => {
    const key = `${r},${g},${b}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < colors.length; index += 1) {
      const dr = r - colors[index].r;
      const dg = g - colors[index].g;
      const db = b - colors[index].b;
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    cache.set(key, best);
    return best;
  };

  const indices = frames.map((frame) => {
    const data = frame.rgba;
    const result = new Uint8Array(frame.width * frame.height);
    for (let pixel = 0; pixel < result.length; pixel += 1) {
      const offset = pixel * 4;
      if (data[offset + 3] < 128) {
        result[pixel] = 0;
      } else {
        result[pixel] = nearest(data[offset], data[offset + 1], data[offset + 2]) + 1;
      }
    }
    return result;
  });
  return { colors, indices };
}

/** LSB-first bit writer for GIF sub-blocks. */
class SubBlockWriter {
  constructor() {
    this.bytes = [];
    this.current = 0;
    this.shift = 0;
  }

  write(code, bits) {
    this.current |= code << this.shift;
    this.shift += bits;
    while (this.shift >= 8) {
      this.bytes.push(this.current & 0xff);
      this.current >>>= 8;
      this.shift -= 8;
    }
  }

  finish() {
    if (this.shift > 0) {
      this.bytes.push(this.current & 0xff);
      this.current = 0;
      this.shift = 0;
    }
    return this.bytes;
  }
}

/**
 * GIF LZW compressor with a minimum code size of 8.
 * @param {Uint8Array} indices
 * @returns {Buffer}
 */
export function lzwEncode(indices) {
  const minCodeSize = 8;
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const writer = new SubBlockWriter();
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let dictionary = new Map();
  const emit = (code) => writer.write(code, codeSize);
  emit(clear);
  if (indices.length === 0) {
    emit(end);
    return packLzw(writer.finish(), minCodeSize);
  }
  let prefix = indices[0];
  for (let index = 1; index < indices.length; index += 1) {
    const suffix = indices[index];
    const key = (prefix << 8) | suffix;
    const found = dictionary.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dictionary.set(key, next);
      next += 1;
      if (next > (1 << codeSize) && codeSize < 12) codeSize += 1;
    } else {
      emit(clear);
      dictionary = new Map();
      codeSize = minCodeSize + 1;
      next = end + 1;
    }
    prefix = suffix;
  }
  emit(prefix);
  emit(end);
  return packLzw(writer.finish(), minCodeSize);
}

function packLzw(bytes, minCodeSize) {
  const out = [minCodeSize];
  for (let offset = 0; offset < bytes.length; offset += 255) {
    const block = bytes.slice(offset, offset + 255);
    out.push(block.length, ...block);
  }
  out.push(0);
  return Buffer.from(out);
}

/**
 * Encode frames as a looping (or counted) animated GIF.
 * @param {GifFrame[]} frames
 * @param {{loop?: number}} [options]
 * @returns {Buffer}
 */
export function encodeGif(frames, options = {}) {
  if (!Array.isArray(frames) || frames.length === 0) throw new Error('GIF needs at least one frame');
  const width = frames[0].width;
  const height = frames[0].height;
  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height) throw new Error('all GIF frames must share one canvas size');
    if (frame.rgba.length !== width * height * 4) throw new Error('GIF frame buffer does not match its dimensions');
  }
  const { colors, indices } = buildPalette(frames);
  const loop = Number.isInteger(options.loop) ? Math.max(0, Math.min(100, options.loop)) : 0;

  const out = [];
  out.push(Buffer.from('GIF89a', 'ascii'));
  const screen = Buffer.alloc(7);
  screen.writeUInt16LE(width, 0);
  screen.writeUInt16LE(height, 2);
  screen[4] = 0xf7; // global table, 256 entries, 8-bit colour resolution
  screen[5] = 0; // background index 0
  screen[6] = 0; // pixel aspect ratio
  out.push(screen);
  const table = Buffer.alloc(256 * 3);
  // Index 0 is the transparent slot; real colours start at table index 1 so
  // that `nearest(...) + 1` in the frame indexer lands on the same colour.
  for (let index = 0; index < colors.length; index += 1) {
    const slot = (index + 1) * 3;
    table[slot] = colors[index].r;
    table[slot + 1] = colors[index].g;
    table[slot + 2] = colors[index].b;
  }
  out.push(table);

  if (loop === 0) {
    out.push(Buffer.from([0x21, 0xff, 0x0b]));
    out.push(Buffer.from('NETSCAPE2.0', 'ascii'));
    out.push(Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]));
  } else if (loop > 1) {
    out.push(Buffer.from([0x21, 0xff, 0x0b]));
    out.push(Buffer.from('NETSCAPE2.0', 'ascii'));
    const count = loop - 1;
    out.push(Buffer.from([0x03, 0x01, count & 0xff, (count >> 8) & 0xff, 0x00]));
  }

  for (let index = 0; index < frames.length; index += 1) {
    const delay = Math.max(2, Math.round(frames[index].durationMs / 10));
    // Graphic control: disposal 2 (restore to background), transparency index 0.
    out.push(Buffer.from([0x21, 0xf9, 0x04, 0x09, delay & 0xff, (delay >> 8) & 0xff, 0x00, 0x00]));
    out.push(Buffer.from([0x2c, 0x00, 0x00, 0x00, 0x00]));
    const descriptor = Buffer.alloc(5);
    descriptor.writeUInt16LE(width, 0);
    descriptor.writeUInt16LE(height, 2);
    descriptor[4] = 0;
    out.push(descriptor);
    out.push(lzwEncode(indices[index]));
  }
  out.push(Buffer.from([0x3b]));
  return Buffer.concat(out);
}
