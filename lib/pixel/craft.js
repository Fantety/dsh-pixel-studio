import { colorToHex, luminance } from './color.js';
import { pixelKey } from './raster.js';

function opaqueNeighbors(pixels, width, height, x, y) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (pixels[ny * width + nx] !== null) count += 1;
    }
  }
  return count;
}

/**
 * A deterministic, explainable craft review inspired by oy-pixel's pixel-art
 * instructions. It never blocks generation; the report gives the model
 * actionable places to iterate and the user a quick quality signal.
 * @param {{width:number,height:number,frames:Array<{raster:any,durationMs:number}>,loop:number,fps:number}} result
 */
export function inspectCraft(result) {
  const { width, height, frames } = result;
  const area = width * height;
  const colors = new Map();
  let opaqueTotal = 0;
  let isolatedTotal = 0;
  const perFrameIsolated = [];
  for (const frame of frames) {
    const pixels = frame.raster.pixels;
    let opaque = 0;
    let isolated = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = pixels[y * width + x];
        if (pixel === null) continue;
        opaque += 1;
        const key = colorToHex(pixel);
        if (!colors.has(key)) colors.set(key, pixel);
        if (opaqueNeighbors(pixels, width, height, x, y) === 0) isolated += 1;
      }
    }
    opaqueTotal += opaque;
    isolatedTotal += isolated;
    perFrameIsolated.push(isolated);
  }
  const opaqueAverage = frames.length === 0 ? 0 : opaqueTotal / frames.length;
  const coverage = area === 0 ? 0 : opaqueAverage / area;

  const colorList = [...colors.values()];
  const luminances = colorList.map((color) => luminance(color)).filter((value) => Number.isFinite(value));
  const contrast = luminances.length === 0 ? 0 : Math.max(...luminances) - Math.min(...luminances);

  let loopDelta = 0;
  if (frames.length > 1) {
    const first = frames[0].raster.pixels;
    const last = frames.at(-1).raster.pixels;
    let changed = 0;
    for (let index = 0; index < area; index += 1) {
      if (pixelKey(first[index]) !== pixelKey(last[index])) changed += 1;
    }
    loopDelta = area === 0 ? 0 : changed / area;
  }

  const averageFrameMs = frames.length === 0
    ? 0
    : frames.reduce((total, frame) => total + frame.durationMs, 0) / frames.length;

  const checks = [];
  const add = (id, level, message) => checks.push({ id, level, message });

  if (colorList.length > 24) {
    add('palette', 'note', `${colorList.length} colours used; tighten ramps and reuse palette entries where possible.`);
  }
  if (colorList.length >= 2 && contrast < 0.18) {
    add('contrast', 'warning', `Luminance range is only ${(contrast * 100).toFixed(0)}%; separate the shadow and highlight values for a readable silhouette.`);
  }
  if (isolatedTotal > 0) {
    add('isolated', 'note', `${isolatedTotal} isolated pixel${isolatedTotal === 1 ? '' : 's'} across frames; acceptable for sparkles, otherwise merge details into 2x2+ clusters.`);
  }
  if (result.loop !== 1 && frames.length > 1 && loopDelta > 0.3) {
    add('loop', 'warning', `First and last frames differ on ${(loopDelta * 100).toFixed(0)}% of pixels; match or mirror the endpoints for a seamless loop.`);
  }
  if (averageFrameMs > 0 && averageFrameMs < 60) {
    add('timing', 'note', `Average frame time is ${Math.round(averageFrameMs)}ms; fast motion needs clear key poses and a smear, not more similar in-betweens.`);
  } else if (averageFrameMs > 300) {
    add('timing', 'note', `Average frame time is ${Math.round(averageFrameMs)}ms; consider fewer holds unless the action is intentionally heavy.`);
  }
  if (coverage > 0 && coverage < 0.01) {
    add('silhouette', 'note', 'The silhouette covers less than 1% of the canvas; crop or scale up the subject for readability.');
  }

  const warnings = checks.filter((check) => check.level === 'warning').length;
  const notes = checks.filter((check) => check.level === 'note').length;
  const score = Math.max(40, 100 - warnings * 8 - notes * 2);

  return {
    score,
    checks,
    metrics: {
      colours: colorList.length,
      averageOpaquePixels: Math.round(opaqueAverage),
      coverage: Number((coverage * 100).toFixed(1)),
      isolatedPixels: isolatedTotal,
      maxIsolatedPerFrame: perFrameIsolated.length === 0 ? 0 : Math.max(...perFrameIsolated),
      contrast: Number((contrast * 100).toFixed(1)),
      loopDelta: Number((loopDelta * 100).toFixed(1)),
      averageFrameMs: Math.round(averageFrameMs),
    },
  };
}
