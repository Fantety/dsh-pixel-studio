import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildShader } from '../lib/pixel/shader.js';
import { writeArtifacts } from '../lib/pixel/output.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const examples = path.join(root, 'examples');

const code = `-- Procedural dusk: sky ramp, sun disc, noisy ridge, stars.
local skyTop = hex('#0B1026')
local skyLow = hex('#FF8A5C')
for y = 0, height - 1 do
  local t = y / (height - 1)
  local sky = mix(skyTop, skyLow, t * t)
  for x = 0, width - 1 do canvas.pset(x, y, sky) end
end

local sunX = width * 0.7
local sunY = height * 0.72
for y = 0, height - 1 do
  for x = 0, width - 1 do
    local d = math.sqrt((x - sunX) * (x - sunX) + (y - sunY) * (y - sunY))
    if d < 7 then canvas.pset(x, y, mix(hex('#FFEC27'), hex('#FF8A5C'), d / 7)) end
    if d > 6 and d < 7 then canvas.pset(x, y, hex('#FFEC27')) end
  end
end

for x = 0, width - 1 do
  local ridge = math.floor(height * 0.72 + noise(x, 0, 0.18) * 8)
  for y = ridge, height - 1 do
    local c = mix(hex('#2F4858'), hex('#0B1026'), (y - ridge) / (height - ridge))
    canvas.pset(x, y, c)
  end
end

for i = 0, 20 do
  local x = rand(0, width - 1)
  local y = rand(0, math.floor(height * 0.55))
  canvas.pset(x, y, pal(13))
end`;

const art = buildShader({
  name: 'shader-horizon',
  width: 32,
  height: 32,
  palette: 'studio',
  seed: 12,
  code,
});

const output = writeArtifacts(art, {
  cwd: examples,
  outputDir: 'shader-horizon',
  includeViewer: false,
  includeOypx: true,
});

const orb = buildShader({
  name: 'shader-orb',
  width: 32,
  height: 32,
  palette: 'sweetie16',
  frameCount: 8,
  fps: 12,
  code: `canvas.clear(hex('#10121E'))
local arc = math.sin(phase * math.pi)
canvas.circfill(width / 2, height - 6 - arc * (height - 12), 3, pal(4))
canvas.circfill(width / 2, height - 3, 4, alpha(pal(1), 0.35))`,
});
const orbOutput = writeArtifacts(orb, {
  cwd: examples,
  outputDir: 'shader-orb',
  includeViewer: false,
  includeOypx: true,
});

console.log('wrote', output.directory);
console.log('wrote', orbOutput.directory);
