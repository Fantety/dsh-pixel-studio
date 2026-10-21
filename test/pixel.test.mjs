import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inflateSync } from 'node:zlib';

import { apply } from '../lib/index.js';
import { PIXEL_CRAFT_PROMPT } from '../lib/craft-prompt.js';
import { parseColor, colorToHex } from '../lib/pixel/color.js';
import { buildAnimation, buildStatic } from '../lib/pixel/art.js';
import { inspectCraft } from '../lib/pixel/craft.js';
import { buildInlineCanvas } from '../lib/pixel/inline.js';
import { buildShader } from '../lib/pixel/shader.js';
import { encodeGif } from '../lib/pixel/gif.js';
import { encodePng } from '../lib/pixel/png.js';
import { composeLayers, parseGrid, scaleRaster, toRgba } from '../lib/pixel/raster.js';
import { TEMPLATE_NAMES, TEMPLATES } from '../lib/pixel/templates.js';
import { writeArtifacts } from '../lib/pixel/output.js';

test('colour parsing normalises short and alpha hex', () => {
  assert.deepEqual(parseColor('#0f8'), { r: 0, g: 255, b: 136, a: 255 });
  assert.deepEqual(parseColor('#0f8a'), { r: 0, g: 255, b: 136, a: 170 });
  assert.equal(colorToHex(parseColor('#12345678')), '#12345678');
  assert.equal(parseColor('nope'), null);
});

test('every built-in template is a rectangular 16x16 grid with themed roles', () => {
  assert.ok(TEMPLATE_NAMES.length >= 10);
  for (const name of TEMPLATE_NAMES) {
    const template = TEMPLATES[name];
    assert.equal(template.grid.length, 16, name);
    for (const row of template.grid) {
      assert.equal(row.length, 16, `${name}: ${row}`);
      for (const symbol of row) {
        if (symbol !== '.') assert.ok(template.theme[symbol], `${name} role ${symbol}`);
      }
    }
  }
});

test('parseGrid rejects ragged rows and unknown symbols', () => {
  const legend = new Map([['0', parseColor('#000000')]]);
  assert.throws(() => parseGrid(['00', '0'], legend), /ragged/);
  assert.throws(() => parseGrid(['01'], legend), /unknown symbol/);
});

test('layers composite bottom-to-top with opacity', () => {
  const legend = new Map([
    ['r', parseColor('#FF0000')],
    ['b', parseColor('#0000FF')],
  ]);
  const bottom = parseGrid(['rr', 'rr'], legend);
  const top = parseGrid(['bb', 'bb'], legend);
  const composed = composeLayers(2, 2, [
    { raster: bottom, x: 0, y: 0, opacity: 1 },
    { raster: top, x: 0, y: 0, opacity: 0.5 },
  ]);
  assert.equal(composed.width, 2);
  assert.equal(composed.height, 2);
  assert.ok(composed.pixels[0].b > 0);
  assert.ok(composed.pixels[0].r > 0);
});

test('nearest scaling keeps every source pixel', () => {
  const legend = new Map([['x', parseColor('#FFFFFF')]]);
  const source = parseGrid(['x.', '.x'], legend);
  const scaled = scaleRaster(source, 4, 4);
  assert.equal(scaled.width, 4);
  assert.equal(scaled.height, 4);
  assert.deepEqual(scaled.pixels[0], { r: 255, g: 255, b: 255, a: 255 });
  assert.equal(scaled.pixels[3], null);
  assert.equal(scaled.pixels[12], null);
  assert.equal(scaled.pixels[15].r, 255);
});

test('PNG encoder writes a valid RGBA signature, IHDR and filtered scanlines', () => {
  const rgba = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 128,
    0, 0, 255, 0, 255, 255, 255, 255,
  ]);
  const png = encodePng(2, 2, rgba);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 2);
  assert.equal(png[24], 8);
  assert.equal(png[25], 6);
  const idatStart = png.indexOf(Buffer.from('IDAT'));
  const idatLength = png.readUInt32BE(idatStart - 4);
  const raw = inflateSync(png.subarray(idatStart + 4, idatStart + 4 + idatLength));
  assert.equal(raw.length, 2 * (1 + 2 * 4));
  assert.equal(raw[0], 0);
  assert.equal(raw[9], 0);
});

test('GIF encoder writes an animated 256-colour GIF with a loop extension', () => {
  const frame = (color) => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    for (let offset = 0; offset < rgba.length; offset += 4) {
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = 255;
    }
    return { width: 4, height: 4, rgba, durationMs: 80 };
  };
  const gif = encodeGif([frame([255, 0, 0]), frame([0, 0, 255])], { loop: 0 });
  assert.equal(gif.toString('ascii', 0, 6), 'GIF89a');
  assert.deepEqual([...gif.subarray(6, 12)], [4, 0, 4, 0, 0xf7, 0]);
  // Table slot 0 is transparent; real colours start at slot 1.
  assert.deepEqual([...gif.subarray(13, 19)], [0, 0, 0, 255, 0, 0]);
  assert.ok(gif.includes(Buffer.from('NETSCAPE2.0')));
  assert.equal(gif[gif.length - 1], 0x3b);
  assert.ok(gif.includes(Buffer.from([0x21, 0xf9, 0x04])));
});

test('static art renders a template and supports effects', () => {
  const art = buildStatic({
    name: 'Test Cat',
    template: 'cat',
    scale: 8,
    effects: { outline: true, shadow: true },
  });
  assert.equal(art.kind, 'art');
  assert.equal(art.name, 'Test-Cat');
  assert.equal(art.width, 16);
  assert.equal(art.height, 16);
  assert.equal(art.frames.length, 1);
  assert.ok(art.frames[0].raster.pixels.some((pixel) => pixel !== null));
});

test('static art supports legend-based custom grids and inferred dimensions', () => {
  const art = buildStatic({
    name: 'legend-test',
    legend: { R: '#FF0000', B: '#0000FF' },
    grid: [
      'RR.',
      '.BB',
    ],
  });
  assert.equal(art.width, 3);
  assert.equal(art.height, 2);
  assert.equal(art.frames[0].raster.pixels[0].r, 255);
  assert.equal(art.frames[0].raster.pixels[5].b, 255);
  assert.equal(art.palette.colors.length, 2);
});

test('animation builds motion frames with real per-frame timing', () => {
  const animation = buildAnimation({
    name: 'bob',
    grid: ['11', '11'],
    palette: 'mono',
    motion: { preset: 'bob', frames: 4, amplitude: 2 },
    fps: 10,
    loop: 0,
  });
  assert.equal(animation.kind, 'animation');
  assert.equal(animation.frames.length, 4);
  assert.equal(animation.frames[0].durationMs, 100);
  assert.equal(animation.fps, 10);
  assert.equal(animation.loop, 0);
});

test('animation accepts explicit frames and rejects ambiguous inputs', () => {
  const animation = buildAnimation({
    name: 'explicit',
    palette: 'mono',
    fps: 8,
    frames: [
      { grid: ['10', '00'] },
      { grid: ['01', '00'], durationMs: 250, label: 'second' },
    ],
  });
  assert.equal(animation.frames.length, 2);
  assert.equal(animation.frames[0].durationMs, 125);
  assert.equal(animation.frames[1].durationMs, 250);
  assert.equal(animation.frames[1].label, 'second');
  assert.throws(() => buildAnimation({
    name: 'bad',
    template: 'slime',
    frames: [{ grid: ['1'] }, { grid: ['1'] }],
  }), /do not combine/);
  assert.throws(() => buildAnimation({ name: 'bad', palette: 'mono', frames: [{ grid: ['1'] }] }), /at least 2/);
});

test('craft report flags low contrast, isolated pixels and a broken loop seam', () => {
  const flat = buildStatic({
    name: 'flat',
    paletteColors: ['#777777', '#7A7A7A'],
    grid: ['01', '10'],
  });
  const flatCraft = inspectCraft({ ...flat, loop: 0 });
  assert.ok(flatCraft.checks.some((check) => check.id === 'contrast' && check.level === 'warning'));
  assert.ok(flatCraft.score < 100);

  const pixelArt = buildStatic({
    name: 'single-pixel',
    paletteColors: ['#FFFFFF'],
    grid: ['.....', '.....', '..0..', '.....', '.....'],
  });
  const pixelCraft = inspectCraft({ ...pixelArt, loop: 0 });
  assert.ok(pixelCraft.checks.some((check) => check.id === 'isolated'));
  assert.ok(pixelCraft.metrics.isolatedPixels >= 1);

  const brokenLoop = buildAnimation({
    name: 'broken-loop',
    paletteColors: ['#FF0000', '#0000FF'],
    frames: [{ grid: ['00', '00'] }, { grid: ['11', '11'] }],
    loop: 0,
  });
  const loopCraft = inspectCraft(brokenLoop);
  assert.ok(loopCraft.checks.some((check) => check.id === 'loop' && check.level === 'warning'));
  assert.equal(loopCraft.metrics.loopDelta, 100);
});

test('the plugin registers the craft prompt section and all three tools', () => {
  const tools = [];
  const sections = [];
  const ctx = {
    tools: { register(definition) { tools.push(definition); } },
    systemPrompt: { section(section) { sections.push(section); } },
    on() {},
    get() { return undefined; },
  };
  apply(ctx);
  assert.equal(tools.length, 3);
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ['pixel_animation', 'pixel_art', 'pixel_shader']);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, 'pixel-studio:craft');
  assert.equal(sections[0].order, 2500);
  assert.match(PIXEL_CRAFT_PROMPT, /PIXEL ART CRAFT/);
  assert.match(PIXEL_CRAFT_PROMPT, /PIXEL ANIMATION CRAFT/);
  assert.match(PIXEL_CRAFT_PROMPT, /pixel_shader/);
  assert.match(PIXEL_CRAFT_PROMPT, /compose once, verify once/i);
  assert.match(sections[0].text, /one light source/i);
});

test('sprite sheet, viewer, OYPX and manifest are written together', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-pixel-studio-'));
  const animation = buildAnimation({
    name: 'write-test',
    template: 'slime',
    motion: { preset: 'float', frames: 3 },
    outputDir: directory,
  });
  const output = writeArtifacts(animation, { cwd: directory, outputDir: directory });
  assert.ok(fs.existsSync(output.primary));
  assert.ok(fs.existsSync(output.preview));
  assert.ok(fs.existsSync(output.gif));
  assert.ok(fs.existsSync(output.sheet));
  assert.ok(fs.existsSync(output.viewer));
  assert.ok(fs.existsSync(output.oypx));
  assert.ok(fs.existsSync(output.metadata));
  assert.equal(output.files.length, 8);
  assert.equal(output.inline.available, true);
  assert.equal(output.inline.frames.length, 3);
  assert.equal(output.inline.width, 16);
  assert.equal(output.inline.frames[0].rows.length, 16);
  assert.ok(output.image.endsWith('.png'));
  assert.ok(output.craft.score > 0);
  assert.ok(Array.isArray(output.craft.checks));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'write-test.json'), 'utf8'));
  assert.deepEqual(manifest.craft, output.craft);

  const sheet = JSON.parse(fs.readFileSync(path.join(directory, 'write-test-sheet.json'), 'utf8'));
  assert.equal(sheet.frames.length, 3);
  assert.equal(sheet.frameWidth, 16);

  const oypx = JSON.parse(fs.readFileSync(path.join(directory, 'write-test.oypx'), 'utf8'));
  assert.equal(oypx.format, 'oypx');
  assert.equal(oypx.version, 2);
  assert.equal(oypx.timeline.frames.length, 3);
  for (const cel of oypx.layers[0].cels) {
    assert.equal(cel.encoding, 'rle-row');
    assert.equal(cel.rows.length, 16);
    for (const row of cel.rows) {
      const total = row.split(/\s+/).filter(Boolean).reduce((sum, token) => {
        if (token === '.') return sum + 1;
        const transparentRun = /^\.\*(\d+)$/.exec(token);
        if (transparentRun) return sum + Number(transparentRun[1]);
        const colourRun = /^#[\da-f]{8}(?:\*(\d+))?$/i.exec(token);
        assert.ok(colourRun, token);
        return sum + (colourRun[1] ? Number(colourRun[1]) : 1);
      }, 0);
      assert.equal(total, 16);
      assert.doesNotMatch(row, /\bp\d/);
    }
  }

  const html = fs.readFileSync(output.viewer, 'utf8');
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /write-test\.gif/);
  assert.match(html, /write-test-sheet\.json/);

  fs.rmSync(directory, { recursive: true, force: true });
});

test('inline canvas encodes rows and falls back above its pixel budget', () => {
  const frame = (label) => ({
    raster: { width: 2, height: 2, pixels: [{ r: 255, g: 0, b: 0, a: 255 }, null, null, { r: 0, g: 0, b: 255, a: 255 }] },
    durationMs: 100,
    label,
  });
  const inline = buildInlineCanvas({ width: 2, height: 2, frames: [frame('a'), frame('b')] });
  assert.equal(inline.available, true);
  assert.equal(inline.encoding, 'i1');
  assert.equal(inline.colors.length, 2);
  assert.deepEqual(inline.frames[0].rows, ['0.', '.1']);
  assert.equal(inline.frames[1].label, 'b');

  const manyColors = Array.from({ length: 65 }, (_, index) => ({
    r: index,
    g: 255 - index,
    b: index * 2,
    a: 255,
  }));
  const wide = buildInlineCanvas({
    width: 65,
    height: 1,
    frames: [{ raster: { width: 65, height: 1, pixels: manyColors }, durationMs: 100 }],
  });
  assert.equal(wide.available, true);
  assert.equal(wide.encoding, 'i2');
  assert.equal(wide.colors.length, 65);
  assert.equal(wide.frames[0].rows[0].length, 130);
  assert.match(wide.frames[0].rows[0], /^.{130}$/);

  const large = Array.from({ length: 9 }, (_, index) => ({
    raster: { width: 128, height: 128, pixels: new Array(128 * 128).fill(null) },
    durationMs: 100,
    label: `f${index}`,
  }));
  const fallback = buildInlineCanvas({ width: 128, height: 128, frames: large });
  assert.equal(fallback.available, false);
  assert.equal(fallback.frames.length, 0);
  assert.match(fallback.reason, /exceeds/);
});

test('shader renders procedural pixels, tables, stamp and animation phases', () => {
  const still = buildShader({
    name: 'shader-still',
    width: 8,
    height: 8,
    palette: 'mono',
    code: [
      'canvas.clear(pal(1))',
      'canvas.circfill(4, 4, 2, pal(2))',
      "canvas.stamp({'.o.', 'ooo'}, {o=pal(2)}, 0, 0)",
    ].join('\n'),
  });
  assert.equal(still.kind, 'art');
  assert.equal(still.frames.length, 1);
  assert.equal(still.width, 8);
  const pixels = still.frames[0].raster.pixels;
  assert.ok(pixels.some((pixel) => pixel !== null));
  assert.ok(pixels.some((pixel) => pixel && pixel.r < 100 && pixel.g < 100 && pixel.b < 100));
  assert.ok(pixels.some((pixel) => pixel && pixel.r > 200 && pixel.g > 200 && pixel.b > 200));

  const animation = buildShader({
    name: 'shader-animation',
    width: 8,
    height: 8,
    paletteColors: ['#000000', '#FFFFFF'],
    frameCount: 3,
    fps: 10,
    seed: 4,
    code: "canvas.clear(pal(1))\ncanvas.circfill(phase * (width - 1), 4, 1, pal(2))",
  });
  assert.equal(animation.kind, 'animation');
  assert.equal(animation.frames.length, 3);
  assert.equal(animation.frames[0].durationMs, 100);
  const positions = animation.frames.map((frame) => {
    const white = [];
    frame.raster.pixels.forEach((pixel, index) => {
      if (pixel && pixel.r === 255) white.push(index % 8);
    });
    return Math.round(white.reduce((sum, x) => sum + x, 0) / Math.max(1, white.length));
  });
  assert.ok(new Set(positions).size > 1, `expected movement, got ${positions}`);
});

test('shader errors include the script line', () => {
  assert.throws(() => buildShader({
    name: 'shader-error',
    width: 8,
    height: 8,
    code: 'canvas.pset(0, 0, pal(1))\ncanvas.no_such_method(1)',
  }), /line 2/);
  assert.throws(() => buildShader({
    name: 'shader-bounds',
    width: 8,
    height: 8,
    code: 'canvas.pset(99, 0, pal(1))',
  }), /line 1/);
  assert.throws(() => buildShader({
    name: 'shader-escape',
    width: 8,
    height: 8,
    code: "canvas.constructor.constructor('return process')().exit(0)",
  }), /not available in the shader sandbox/);
  assert.throws(() => buildShader({
    name: 'shader-deep',
    width: 8,
    height: 8,
    code: `canvas.pset(0, 0, ${'('.repeat(300)}pal(1)${')'.repeat(300)})`,
  }), /nesting is too deep/);
  assert.throws(() => buildShader({
    name: 'shader-internal',
    width: 8,
    height: 8,
    code: 'canvas.pixels.fill(hex(\'#FFFFFFFF\'))',
  }), /not part of the shader API/);
});

test('pixel_shader executes through the DSH tool boundary', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-pixel-shader-tool-'));
  try {
    const tools = [];
    const sections = [];
    apply({
      systemPrompt: { section: (section) => sections.push(section) },
      tools: { register: (tool) => tools.push(tool) },
      workingDirectory: { ensure: async () => directory },
    });
    const shader = tools.find((tool) => tool.name === 'pixel_shader');
    assert.ok(shader);
    assert.deepEqual(shader.parameters.required, ['name', 'code']);
    const result = await shader.execute({
      name: 'shader-tool',
      width: 12,
      height: 12,
      palette: 'sweetie16',
      frameCount: 2,
      fps: 8,
      code: 'canvas.clear(pal(2))\ncanvas.circfill(phase * (width - 1), 6, 2, pal(6))',
    }, { agent: {}, signal: null });
    assert.equal(result.kind, 'animation');
    assert.equal(result.frameCount, 2);
    assert.equal(result.canvas.available, true);
    assert.match(result.canvas.encoding, /^i[12]$/);
    assert.equal(result.canvas.frames.length, 2);
    assert.ok(fs.existsSync(result.imagePath));
    assert.ok(fs.existsSync(result.gifPath));
    assert.ok(fs.existsSync(result.oypxPath));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('shader output uses the shared artifact and inline-canvas pipeline', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-pixel-shader-'));
  try {
    const art = buildShader({
      name: 'shader-files',
      width: 10,
      height: 10,
      palette: 'sweetie16',
      seed: 3,
      code: "canvas.clear(pal(2))\ncanvas.circfill(5, 5, 3, pal(6))",
    });
    const output = writeArtifacts(art, {
      cwd: directory,
      outputDir: 'shader-files',
      includeViewer: false,
      includeOypx: true,
    });
    assert.ok(fs.existsSync(output.image));
    assert.ok(fs.existsSync(output.preview));
    assert.ok(fs.existsSync(output.sheet));
    assert.ok(fs.existsSync(output.oypx));
    assert.ok(fs.existsSync(output.metadata));
    assert.equal(output.inline.available, true);
    assert.equal(output.inline.frames.length, 1);
    assert.ok(output.files.some((file) => file.name.endsWith('.oypx')));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the client bundle is a loadable tool-view registration', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.license, 'MIT');
  assert.equal(packageJson.engines.dsh, '>=0.2.1-rc.2 <0.3.0');
  assert.equal(packageJson.repository.url, 'git+https://github.com/Fantety/dsh-pixel-studio.git');
  assert.equal(packageJson.exports['./client'], './lib/client.js');
  assert.deepEqual(packageJson.dsh.bundle, { patch: './cordis.patch.yml' });
  assert.ok(packageJson.files.includes('cordis.patch.yml'));
  assert.equal(packageJson.dsh.client.platform, 'web');
  assert.ok(packageJson.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-tool'));
  const patch = fs.readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.match(patch, /- insert:/);
  assert.match(patch, /id:\s*pixel-studio/);
  assert.match(patch, /name:\s*"dsh-pixel-studio"/);
  const source = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(source, /window\.__ModuleLoader__\.load/);
  assert.match(source, /id:\s*"dsh-pixel-studio"/);
  assert.match(source, /name:\s*"tool\.call\.toolview"/);
  assert.match(source, /key:\s*"pixel_art"/);
  assert.match(source, /key:\s*"pixel_animation"/);
  assert.match(source, /key:\s*"pixel_shader"/);
  assert.match(source, /createImageData/);
});

test('the client factory registers all keyed tool views', async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  let registration;
  const styleNodes = [];
  const fakeDocument = {
    documentElement: { lang: 'zh-CN' },
    querySelector() { return null; },
    createElement() { return { dataset: {}, textContent: '' }; },
    head: { appendChild(node) { styleNodes.push(node); } },
  };
  globalThis.window = {
    __ModuleLoader__: {
      load(value) { registration = value; },
    },
  };
  globalThis.document = fakeDocument;
  try {
    await import(new URL('../lib/client.js?factory-test', import.meta.url).href);
    assert.equal(registration.id, 'dsh-pixel-studio');
    const fakeReact = { createElement() {} };
    const exports = registration.factory((specifier) => {
      assert.equal(specifier, 'react');
      return fakeReact;
    });
    assert.equal(typeof exports.apply, 'function');
    assert.deepEqual(exports.inject, ['slots']);
    const views = [];
    const ctx = {
      slots: {
        inject(_name, callback) {
          for (const registrationEntry of callback()) views.push(registrationEntry);
        },
        register(definition, component) {
          return { definition, component };
        },
      },
    };
    exports.apply(ctx);
    assert.deepEqual(views.map((view) => view.definition.key), ['pixel_art', 'pixel_animation', 'pixel_shader']);
    assert.equal(styleNodes.length, 1);
    assert.equal(styleNodes[0].dataset.plugin, 'dsh-pixel-studio');
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test('output files can be written beside a caller-supplied absolute directory', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-pixel-studio-abs-'));
  const art = buildStatic({ name: 'abs', template: 'star' });
  const output = writeArtifacts(art, { cwd: os.tmpdir(), outputDir: directory, includeViewer: false, includeOypx: false });
  assert.equal(output.directory, directory);
  assert.equal(output.viewer, null);
  assert.equal(output.oypx, null);
  assert.ok(fs.existsSync(output.primary));
  fs.rmSync(directory, { recursive: true, force: true });
});
