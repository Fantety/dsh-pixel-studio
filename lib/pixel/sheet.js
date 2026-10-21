import { encodePng } from './png.js';
import { scaleRaster, toRgba } from './raster.js';

/**
 * Lay frames out on a sprite sheet and return both the PNG and a machine
 * readable atlas. Frames are copied at native resolution; `padding` is the
 * outer margin and `gutter` the space between cells.
 * @param {Array<{raster: import('./raster.js').Raster, durationMs:number, label?:string}>} frames
 * @param {{columns?:number,padding?:number,gutter?:number}} [options]
 */
export function makeSpriteSheet(frames, options = {}) {
  if (frames.length === 0) throw new Error('sprite sheet needs at least one frame');
  const frameWidth = frames[0].raster.width;
  const frameHeight = frames[0].raster.height;
  for (const frame of frames) {
    if (frame.raster.width !== frameWidth || frame.raster.height !== frameHeight) {
      throw new Error('all sprite-sheet frames must share one canvas size');
    }
  }
  const columns = Math.max(1, Math.min(frames.length, options.columns ?? Math.min(frames.length, 8)));
  const rows = Math.ceil(frames.length / columns);
  const padding = Math.max(0, Math.min(16, options.padding ?? 0));
  const gutter = Math.max(0, Math.min(16, options.gutter ?? 0));
  const width = padding * 2 + columns * frameWidth + Math.max(0, columns - 1) * gutter;
  const height = padding * 2 + rows * frameHeight + Math.max(0, rows - 1) * gutter;
  const pixels = new Array(width * height).fill(null);
  const rects = [];
  for (let index = 0; index < frames.length; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + column * (frameWidth + gutter);
    const y = padding + row * (frameHeight + gutter);
    const raster = frames[index].raster;
    for (let sy = 0; sy < frameHeight; sy += 1) {
      for (let sx = 0; sx < frameWidth; sx += 1) {
        const pixel = raster.pixels[sy * frameWidth + sx];
        if (pixel) pixels[(y + sy) * width + (x + sx)] = { ...pixel };
      }
    }
    rects.push({
      index,
      label: frames[index].label ?? `frame-${index}`,
      x,
      y,
      width: frameWidth,
      height: frameHeight,
      durationMs: frames[index].durationMs,
    });
  }
  const raster = { width, height, pixels };
  const png = encodePng(width, height, toRgba(raster));
  return {
    png,
    raster,
    metadata: {
      format: 'dsh-pixel-studio-spritesheet',
      version: 1,
      width,
      height,
      frameWidth,
      frameHeight,
      columns,
      rows,
      padding,
      gutter,
      frames: rects,
    },
  };
}

/**
 * Create a nearest-neighbour scaled preview of a sprite sheet with a checkerboard.
 * @param {import('./raster.js').Raster} raster
 * @param {number} scale
 * @param {(raster: import('./raster.js').Raster, cell: number) => import('./raster.js').Raster} checker
 */
export function scaledSheetPreview(raster, scale, checker) {
  return scaleRaster(checker(raster, 8), raster.width * scale, raster.height * scale);
}
