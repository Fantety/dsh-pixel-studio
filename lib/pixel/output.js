import fs from 'node:fs';
import path from 'node:path';
import { inspectCraft } from './craft.js';
import { encodeGif } from './gif.js';
import { buildInlineCanvas } from './inline.js';
import { encodeOypx } from './oypx.js';
import { encodePng } from './png.js';
import { checkerPreview, scaleRaster, toRgba } from './raster.js';
import { makeSpriteSheet } from './sheet.js';
import { renderViewer } from './viewer.js';

const GENERATOR = 'dsh-pixel-studio';
const VERSION = '1.2.0';

function ensureDirectory(directory) {
  const stat = fs.existsSync(directory) ? fs.statSync(directory) : null;
  if (stat && !stat.isDirectory()) throw new Error(`output path is not a directory: ${directory}`);
  if (!stat) fs.mkdirSync(directory, { recursive: true });
}

function writeFileAtomic(filePath, data) {
  const directory = path.dirname(filePath);
  ensureDirectory(directory);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    throw new Error(`cannot write ${filePath}: a directory with that name exists`);
  }
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temporary, data);
  try {
    fs.renameSync(temporary, filePath);
  } catch {
    fs.rmSync(filePath, { force: true, recursive: false });
    fs.renameSync(temporary, filePath);
  }
}

function effectiveScale(requested, width, height, limit = 2048) {
  const desired = Math.max(1, Math.min(24, requested ?? (Math.max(width, height) <= 32 ? 8 : Math.max(width, height) <= 64 ? 4 : 2)));
  const fit = Math.max(1, Math.floor(limit / Math.max(width, height)));
  return Math.min(desired, fit);
}

function fileRecord(filePath, kind, description, extra = {}) {
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    kind,
    description,
    bytes: stat.size,
    ...extra,
  };
}

/**
 * Write all derived assets for one generated artwork.
 * @param {ReturnType<import('./art.js').buildStatic>|ReturnType<import('./art.js').buildAnimation>} result
 * @param {{cwd:string,outputDir?:string,scale?:number,loop?:number,sheetColumns?:number,padding?:number,gutter?:number,includeViewer?:boolean,includeOypx?:boolean}} options
 */
export function writeArtifacts(result, options) {
  const {
    cwd,
    outputDir = 'pixel-art',
    scale,
    loop,
    sheetColumns,
    padding,
    gutter,
    includeViewer = true,
    includeOypx = true,
  } = options;
  const baseDirectory = path.isAbsolute(outputDir) ? outputDir : path.resolve(cwd, outputDir);
  ensureDirectory(baseDirectory);

  const { name, width, height, frames, fps, palette } = result;
  const effectiveLoop = loop ?? result.loop ?? 0;
  const slug = name;
  const imagePath = path.join(baseDirectory, `${slug}.png`);
  const previewPath = path.join(baseDirectory, `${slug}-preview.png`);
  const sheetPath = path.join(baseDirectory, `${slug}-sheet.png`);
  const sheetJsonPath = path.join(baseDirectory, `${slug}-sheet.json`);
  const viewerPath = path.join(baseDirectory, `${slug}-viewer.html`);
  const oypxPath = path.join(baseDirectory, `${slug}.oypx`);
  const metadataPath = path.join(baseDirectory, `${slug}.json`);
  const gifPath = path.join(baseDirectory, `${slug}.gif`);

  const animated = result.kind === 'animation' && frames.length > 1;
  const firstFrame = frames[0].raster;
  writeFileAtomic(imagePath, encodePng(width, height, toRgba(firstFrame)));

  const sheet = makeSpriteSheet(frames, { columns: sheetColumns, padding, gutter });
  writeFileAtomic(sheetPath, sheet.png);
  writeFileAtomic(sheetJsonPath, `${JSON.stringify(sheet.metadata, null, 2)}\n`);

  const previewSource = frames.length > 1 ? sheet.raster : firstFrame;
  const desiredScale = effectiveScale(scale, width, height);
  const scaledWidth = previewSource.width * desiredScale;
  const scaledHeight = previewSource.height * desiredScale;
  const fit = Math.min(1, 2048 / scaledWidth, 2048 / scaledHeight);
  const previewRaster = scaleRaster(
    checkerPreview(previewSource, 8),
    Math.max(1, Math.round(scaledWidth * fit)),
    Math.max(1, Math.round(scaledHeight * fit)),
  );
  const previewScale = previewRaster.width / previewSource.width;
  writeFileAtomic(previewPath, encodePng(previewRaster.width, previewRaster.height, toRgba(previewRaster)));

  let gifBytes = null;
  if (animated) {
    gifBytes = encodeGif(
      frames.map((frame) => ({
        width,
        height,
        rgba: toRgba(frame.raster),
        durationMs: frame.durationMs,
      })),
      { loop: effectiveLoop },
    );
    writeFileAtomic(gifPath, gifBytes);
  }

  const oypxText = includeOypx ? encodeOypx({
    name, width, height, frames, fps, loop: effectiveLoop, palette,
  }) : null;
  if (oypxText !== null) writeFileAtomic(oypxPath, oypxText);

  const relativeAssets = {
    image: path.basename(imagePath),
    preview: path.basename(previewPath),
    sheet: path.basename(sheetPath),
    sheetJson: path.basename(sheetJsonPath),
    gif: animated ? path.basename(gifPath) : undefined,
    oypx: oypxText !== null ? path.basename(oypxPath) : undefined,
  };
  if (includeViewer) {
    const viewer = renderViewer({
      name,
      width,
      height,
      fps,
      loop: effectiveLoop,
      palette: { ...palette, colors: palette.colors },
      sheetBase64: sheet.png.toString('base64'),
      sheet: sheet.metadata,
      assets: relativeAssets,
      static: !animated,
    });
    writeFileAtomic(viewerPath, viewer);
  }

  const craft = inspectCraft({ width, height, frames, loop: effectiveLoop, fps });
  const manifest = {
    generator: GENERATOR,
    version: VERSION,
    generatedAt: new Date().toISOString(),
    name,
    kind: result.kind,
    width,
    height,
    frameCount: frames.length,
    fps,
    loop: effectiveLoop,
    palette,
    craft,
    motion: result.motion,
    assets: relativeAssets,
    files: {
      image: path.basename(imagePath),
      preview: path.basename(previewPath),
      gif: animated ? path.basename(gifPath) : null,
      sheet: path.basename(sheetPath),
      sheetJson: path.basename(sheetJsonPath),
      viewer: includeViewer ? path.basename(viewerPath) : null,
      oypx: oypxText !== null ? path.basename(oypxPath) : null,
    },
    frames: frames.map((frame, index) => ({
      index,
      label: frame.label,
      durationMs: frame.durationMs,
      gifDelayMs: Math.max(2, Math.round(frame.durationMs / 10)) * 10,
      sheet: sheet.metadata.frames[index],
    })),
  };
  writeFileAtomic(metadataPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const files = [
    fileRecord(imagePath, 'image', `${width}×${height} PNG${frames.length > 1 ? ' (first frame)' : ''}`, { width, height }),
    fileRecord(previewPath, 'preview', `Nearest-neighbour preview at ${previewScale.toFixed(2).replace(/\.00$/, '')}×`, {
      width: previewRaster.width,
      height: previewRaster.height,
      scale: Math.max(1, Math.round(previewScale)),
    }),
    fileRecord(sheetPath, 'spritesheet', `${frames.length} frame${frames.length === 1 ? '' : 's'} · ${sheet.metadata.columns} columns`, {
      width: sheet.metadata.width,
      height: sheet.metadata.height,
    }),
    fileRecord(sheetJsonPath, 'spritesheet-metadata', 'Sprite-sheet atlas JSON'),
  ];
  if (gifBytes !== null) {
    files.splice(2, 0, fileRecord(gifPath, 'animation', `Animated GIF · ${frames.length} frames · ${loop === 0 ? 'infinite loop' : loop === 1 ? 'once' : `${loop} loops`}`, {
      width,
      height,
      frames: frames.length,
    }));
  }
  if (includeViewer) files.push(fileRecord(viewerPath, 'viewer', 'Standalone animation viewer with zoom, grid and onion skin'));
  if (oypxText !== null) files.push(fileRecord(oypxPath, 'project', 'OYPX project (oy-pixel compatible)'));
  files.push(fileRecord(metadataPath, 'metadata', 'Asset manifest and frame timings'));

  const primary = animated ? gifPath : imagePath;
  const inline = buildInlineCanvas({ width, height, frames });
  return {
    directory: baseDirectory,
    primary,
    image: imagePath,
    viewer: includeViewer ? viewerPath : null,
    gif: animated ? gifPath : null,
    sheet: sheetPath,
    sheetJson: sheetJsonPath,
    oypx: oypxText !== null ? oypxPath : null,
    metadata: metadataPath,
    preview: previewPath,
    sheetMetadata: sheet.metadata,
    files,
    inline,
    relativeAssets,
    manifest,
    craft,
  };
}
