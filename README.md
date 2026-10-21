# dsh-pixel-studio

[![CI](https://github.com/Fantety/dsh-pixel-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Fantety/dsh-pixel-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.x-4c6ef5)](https://github.com/deepseek-ai/deepseek-harness)

A native, in-chat **pixel art and pixel animation studio** for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). The agent
writes palette-indexed grids or uses a template/motion recipe, and the result
is rendered as an interactive canvas directly in the conversation — not as a
deliverable card or a separate viewer page.

The same result is also exported as real production files: transparent PNG,
GIF89a animation, spritesheet + JSON atlas, an optional standalone HTML viewer,
and an [oy-pixel](https://github.com/Fantety/oy-pixel)-compatible `.oypx`
project.

![Template gallery](examples/template-gallery.png)

![Native ghost animation](examples/native-ghost/native-ghost-preview.png)

## Why another pixel tool?

- **Native canvas first.** Playback, frame stepping, zoom, pixel grid, onion
  skin, palette, and craft score live in the chat tool view.
- **Designed for agents.** One-character-per-pixel grids are compact,
  deterministic, easy to diff, and validated before any file is written.
- **Actual game assets.** PNG, GIF, spritesheet, atlas JSON, OYPX and a manifest
  are written together.
- **Craft-aware generation.** A DSH system-prompt section adapted from
  oy-pixel's pixel-art guidance is injected while the plugin is mounted, and
  every result includes a deterministic craft report.
- **Zero runtime dependencies.** Host code uses Node built-ins only; the client
  half uses the React runtime already supplied by DSH.
- **Safe by design.** Inline canvas data is capped and decoded locally; the
  plugin performs no network requests.

## Features

### Native chat canvas

- Auto-play for animations, play/pause, previous/next frame
- Nearest-neighbour zoom (1–24×), pixel grid, onion skin
- Checker/dark/light background
- Palette chips, frame count, FPS and craft score
- Open PNG, GIF, spritesheet, OYPX, or optional HTML directly from the card
- Compact fallback panel when the artwork exceeds the inline budget

### Pixel tools

- `pixel_art` — stills, icons, sprites, scenes, portraits
- `pixel_animation` — explicit frames or a base sprite plus a motion recipe
- 7 built-in palettes: PICO-8, Game Boy, Sweetie 16, DawnBringer 16/32,
  Studio Warm, Ink & Paper
- Custom palettes and single-character `legend` maps
- Layered drawing with source-over alpha
- 12 built-in 16×16 templates: slime, cat, robot, potion, sword, heart, ghost,
  star, coin, tree, mushroom, crystal
- Motion presets: `bob`, `float`, `breathe`, `sway`, `shake`, `pulse`, `spin`,
  `orbit`
- Outline, shadow, background, GIF loop count and per-frame duration
- OYPX v2 with direct `#RRGGBBAA` row RLE, current oy-pixel parser compatible

## Requirements

- DeepSeek Harness **0.2.1-rc.2 or newer within 0.2.x**
- Node.js **20 or newer** for development and tests
- A DSH Web GUI (the client half is `platform: "web"`)

## Install

The package is a normal DSH plugin: host entry `lib/index.js`, client entry
`lib/client.js`, and a `dsh.client` declaration. It has no build step.

### From GitHub via SSH

For a CLI-managed profile, replace `my-profile` with its name (for example
`web`, `headless`, or a custom profile):

```bash
# 1. Install the package into that profile.
dsh plugin --profile my-profile add "git+ssh://git@github.com/Fantety/dsh-pixel-studio.git"

# 2. Add the loader entry to ~/.dsh/profiles/my-profile/cordis.patch.yml
```

```yaml
- insert:
    - id: pixel-studio
      name: dsh-pixel-studio
```

The `desktop` profile is managed by the Electron app, so the CLI deliberately
rejects `dsh plugin --profile desktop`. Use the DSH Plugin Manager (or the
desktop's bundled command runtime) for that profile, then add the same `insert`
block.

Reload the profile, then **refresh the Web GUI once** so the client bundle is
loaded. If the tool card is still generic after a refresh, restart DSH.

### Local development link

```bash
cd ~/.dsh/profiles/my-profile
pnpm add "link:/absolute/path/to/dsh-pixel-studio"
```

Then add the same `insert` block and refresh the page.

## Quick start

Ask the agent in natural language:

> Draw a 32×32 moss slime with top-left lighting and make an 8-frame floating
> animation. Export it as PNG, GIF and OYPX.

Or call the tool directly:

```json
{
  "name": "moss-slime",
  "template": "slime",
  "palette": "sweetie16",
  "effects": { "outline": true, "shadow": true },
  "outputDir": "pixel-art"
}
```

Hand-drawn grid with a legend:

```json
{
  "name": "tiny-heart",
  "legend": { "O": "#3B0D1A", "R": "#EF4B6B", "L": "#FF9FB2" },
  "grid": [
    ".OO..OO.",
    "ORROORRO",
    "ORLRRRRO",
    "ORRRRRRO",
    ".ORRRRO.",
    "..ORRO..",
    "...OO...",
    "........"
  ],
  "scale": 12
}
```

Without `legend`, characters `0-9a-z` are palette indices (up to 36 colours).
`.` is always transparent. The default palette is `sweetie16`.

### Animation

```json
{
  "name": "native-ghost",
  "template": "ghost",
  "palette": "sweetie16",
  "effects": { "shadow": true, "shadowColor": "#00000055" },
  "motion": { "preset": "float", "frames": 8, "amplitude": 1 },
  "fps": 12,
  "loop": 0,
  "scale": 10
}
```

Explicit frames are also supported:

```json
{
  "name": "coin-spin",
  "palette": "dawnbringer16",
  "fps": 10,
  "loop": 0,
  "frames": [
    { "grid": ["..00..", ".0110.", "011110", "011110", ".0110.", "..00.."] },
    { "grid": ["...00.", "..0110", ".01110", ".01110", "..0110", "...00."], "durationMs": 80 },
    { "grid": ["....00", "...011", "..0111", "..0111", "...011", "....00"], "durationMs": 60 }
  ]
}
```

## Output files

Files are written under the session workspace, by default `pixel-art/`:

```text
pixel-art/
  moss-slime.png                 transparent 1× PNG
  moss-slime-preview.png         nearest-neighbour preview on checkerboard
  moss-slime.gif                 animated GIF (when 2+ frames)
  moss-slime-sheet.png           spritesheet
  moss-slime-sheet.json          frame x/y/width/height/duration atlas
  moss-slime.oypx                oy-pixel v2 project
  moss-slime.json                asset manifest + craft report
  moss-slime-viewer.html         optional: includeViewer: true
```

### Craft report

Every generation includes a deterministic `craft` object in the tool result and
manifest:

```json
{
  "score": 100,
  "checks": [],
  "metrics": {
    "colours": 9,
    "contrast": 61.2,
    "isolatedPixels": 0,
    "loopDelta": 19.4,
    "averageFrameMs": 83
  }
}
```

Checks cover contrast, isolated pixels, loop seams, frame timing, palette size
and silhouette coverage. Warnings are actionable; the agent is instructed to
iterate on them before finishing.

## Craft guidance

While mounted, the plugin registers a DSH system-prompt section named
`pixel-studio:craft` (order `2500`). It is adapted from oy-pixel's
`PIXEL_ART_CRAFT` / `PIXEL_ANIMATION_CRAFT` guidance and covers:

- silhouette first, 2×2+ detail clusters, clean stair-stepped diagonals
- one top-left light source, hue-shifted 3–5 step ramps, cast shadows
- ordered dithering, one outline strategy, sparing anti-aliasing
- lean animation counts, key poses, easing, anticipation/overshoot, squash,
  smears, subpixel motion, secondary motion and loop seams

The same guidance is referenced from both tool descriptions.

## Architecture

```text
pixel_art / pixel_animation (host tools)
        │
        ├── validate grid/palette/frames
        ├── compose layers + effects
        ├── render frames
        ├── write PNG / GIF / sheet / OYPX / manifest
        └── return compact inline canvas + file paths
                    │
                    ▼
        presentationMeta.canvas
                    │
                    ▼
lib/client.js → tool.call.toolview → <canvas> in chat
```

- **Host half** (`lib/`, Node ESM) has no runtime dependencies and uses
  `node:zlib` for PNG.
- **Client half** (`lib/client.js`) is a hand-written
  `window.__ModuleLoader__.load` factory, registered for `pixel_art` and
  `pixel_animation`.
- **Inline data** is palette-indexed, one character per pixel, capped at
  131,072 pixels and 64 colours.
- **No network**: the plugin reads only the current session working directory
  and writes only under `outputDir`.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development

```bash
git clone git@github.com:Fantety/dsh-pixel-studio.git
cd dsh-pixel-studio
npm test
npm run check
npm run demo
npm run demo:showcase
```

The demo scripts regenerate the checked-in examples. No install step is needed
because the plugin has zero runtime dependencies.

## Limits

- Canvas side ≤ 256 px; animation ≤ 120 frames and 8,000,000 total pixels.
- Grid-character palettes ≤ 36 colours; use `legend` for up to 64 symbols.
- GIF timing granularity is 10 ms; frames below 20 ms are stored at 20 ms.
- GIF transparency is 1-bit; translucent edges are quantised.
- OYPX export supports at most 256 unique colours.
- The agent draws structured grids; the plugin does not call an image
  generation model.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md),
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).

## License and attribution

This project is released under the [MIT License](LICENSE), the same license
used by DeepSeek Harness.

The craft guidance is adapted from
[oy-pixel](https://github.com/Fantety/oy-pixel), Copyright © 2026 Fantety. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution details.

中文说明：[README.zh.md](README.zh.md)
