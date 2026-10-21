import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAnimation, buildStatic } from '../lib/pixel/art.js';
import { writeArtifacts } from '../lib/pixel/output.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const cwd = path.resolve(root, '..');
const outputDir = path.join(root, 'examples', 'showcase');

const wizardGrid = [
  '........................',
  '...........OO...........',
  '..........OHHO..........',
  '.........OHLLHO.........',
  '........OHLLLLHO........',
  '.......OHLLLLLLHO.......',
  '......OHLLLLLLLLHO......',
  '.....OHHHHHHHHHHHHO.....',
  '....OOOOOOOOOOOOOOOO....',
  '.......OSSSSSSSSO.......',
  '.......OSSESSESSO.......',
  '.......OSSSSSSSSO.......',
  '.......OSSSSSSSSO.......',
  '........OBBBBBBO........',
  '.......OBBBBBBBBO.......',
  '......OBBBBBBBBBBO......',
  '......OBBBBBBBBBBO......',
  '.......OBBBBBBBBO.......',
  '........ORRRRRRRO.......',
  '.......ORRRRRRRRO.......',
  '.....ORRRRRRRRRRRRO.....',
  '....ORRRRGGGGRRRRRRO....',
  '....ORRRRRRRRRRRRRRO....',
  '....OOOOOOOOOOOOOOOO....',
];
const wizardLegend = {
  O: '#1A1626', H: '#3D2C8D', L: '#8B5CF6', S: '#F2C49B',
  E: '#171326', B: '#E8E3F2', R: '#2F6F8F', G: '#FFCD75',
};

const wizard = buildAnimation({
  name: 'starlight-wizard',
  width: 24,
  height: 24,
  legend: wizardLegend,
  grid: wizardGrid,
  effects: { shadow: true, shadowColor: '#00000055', shadowX: 1, shadowY: 1 },
  motion: { preset: 'float', frames: 8, amplitude: 3 },
  fps: 10,
  loop: 0,
  scale: 10,
  sheetColumns: 8,
});
const wizardOut = writeArtifacts(wizard, { cwd, outputDir: path.join(outputDir, 'starlight-wizard') });

const still = buildStatic({
  name: 'starlight-wizard-still',
  width: 24,
  height: 24,
  legend: wizardLegend,
  grid: wizardGrid,
  effects: { shadow: true, shadowColor: '#00000055', shadowX: 1, shadowY: 1 },
  scale: 10,
});
writeArtifacts(still, { cwd, outputDir: path.join(outputDir, 'starlight-wizard-still') });

const sky = [
  'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN',
  'NNNNNNNNwNNNNNNNNNNNNNNNNNNNwNNN',
  'NNNNNNNNNNNNNNNNNNWNNNNNmmmNNNNN',
  'NNNWNNNNNNNNNNNNNNNNNNNmMMMmNNNN',
  'NNNNNNNNNNNNNNwNNNNNNNmMMMMMmNNN',
  'NNNNNNNNNNNNNNNNNNNNNmMMMMMMMmNN',
  'NNNNNNNNNNNNNNNNNNNNNmMMMmmmmmNN',
  'NNNNNNNNNNNNNNNNNNNNNmMMMmmmmmNN',
  'NNNNNNNNNNNNNNNNNNNNNNmMMmmmmNWN',
  'NNNNNNNNNNNNNNNNNNNNwNNmMmmmNNNN',
  'NNNNNNNNNNNNWNNNNNNNNNNNmmmNNNNN',
  'NNwNNNNNNNNNNNNNNNNNNNNNNNNNNNNN',
  'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN',
  'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN',
  'NNNNNNNNNNNNNNNNNNNNNNNNNNwNNNNN',
  'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN',
  'NNNNNNwNNNNNNNNNWNNNNNNNNNNNNNNN',
  'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN',
  'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnH',
  'nnnnnnnnnnnnnHHHHHHnnnnnnnnnnnHh',
  'HNNNNNNNNNNNHhhhhhhHHNNNNNNNHHhh',
  'hHNNNNNNNNNHhhhhhhhhhHHNNNNHhhhh',
  'hhHNNNNNNHHhhhhhhhhhhhhHHHHhhhhh',
  'hhhHHHNHHhhhhhhhhhhhhhhhhhhhhhhh',
  'hhhrhhHhhhhhhhhhhhhhhhhhhhhhhhhh',
  'hhhRhhhhhhhhhhhrhhhhhhhhrhhhhhhh',
  'hhhhhhrhhhhhhhhRhhhhhhhhRhhhhhhh',
  'hhhhhhRhhhhhhhhhhhhhhhhhhhhhrhhh',
  'hhhhhhhhhhhhhhhhhhhhhhhhhhhhRhhh',
  'hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
];
const tree = [
  '................',
  '.......OO.......',
  '.....OOBBOO.....',
  '....OBBBBBBO....',
  '...OBBLBBBBBO...',
  '..OBBBBBBBBBBO..',
  '..OBBBBBBBBBBO..',
  '.OBBBBBBBBBBBBO.',
  '.OBBBBBBBBBBBBO.',
  '..OBBBBBBBBBBO..',
  '...OBBBBBBBBO...',
  '.....OBBBBO.....',
  '.......OO.......',
  '.......AA.......',
  '......AAAA......',
  '.....OOOOOO.....',
];
const slime = [
  '................',
  '................',
  '................',
  '................',
  '.....OOOO.......',
  '...OOBBBBOO.....',
  '..OBBBBBBBBO....',
  '.OBBBBBBBBBBO...',
  '.OBEEBBBBEEBO...',
  '.OBEEBBBBEEBO...',
  '.OBBBBBBBBBBBO..',
  '.OBBLBBBBBBLBO..',
  '..OBBBBBBBBBBO..',
  '...OOOOOOOOOO...',
  '................',
  '................',
];
const scene = buildStatic({
  name: 'moonlit-grove',
  width: 32,
  height: 32,
  legend: {
    N: '#0B1026', n: '#141A3A', M: '#FFF3B0', m: '#D9A066',
    W: '#F4F4F4', w: '#94B0C2', H: '#1E3A34', h: '#2F5D50',
    R: '#EF4B6B', r: '#B13E53', O: '#1A2E1A', B: '#38B764',
    L: '#A7F070', A: '#8F563B', E: '#0B1020',
  },
  layers: [
    { name: 'Night sky and hills', grid: sky },
    { name: 'Tree', x: 4, y: 8, grid: tree },
    { name: 'Slime', x: 16, y: 16, grid: slime },
  ],
  scale: 8,
});
const sceneOut = writeArtifacts(scene, { cwd, outputDir: path.join(outputDir, 'moonlit-grove') });

console.log('wizard', wizardOut.primary);
console.log('scene', sceneOut.primary);
