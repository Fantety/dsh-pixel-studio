# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2026-10-22

### Added

- GitHub Release workflow for `v*` tags. Each release publishes a prebuilt,
  version-free `dsh-pixel-studio.tgz` asset for storefronts and offline installs.
- `screenshots.json` declaring four repository screenshots for DSH storefronts.
- Release tarball and awesome-list submission notes in the README.

## [1.3.0] - 2026-10-21

### Fixed

- Declare the package as a DSH bundle with `dsh.bundle.patch` and a bundled
  `cordis.patch.yml`. The Plugin Manager now recognizes it as an installable
  plugin instead of failing with “this package declares no bundle”.
- Include `cordis.patch.yml` in the published package and document bundle-based
  installation (Plugin Manager / CLI), replacing the old manual loader-row
  instructions.
- The bundle row inserts `pixel-studio` automatically; manual `pixel-studio`
  inserts in a profile patch are now documented as obsolete and should be
  removed.

### Changed

- Package and generated manifest version bumped to `1.3.0`.

## [1.2.0] - 2026-10-21

### Added

- `pixel_shader`, a procedural generation tool that follows oy-pixel's
  `pixel_run_shader` design: an oy-pixel-style canvas API, 1-based `pal()`,
  `mix`/`hsv`/`alpha`, seeded `rand`/`noise`, `time`/`phase`/`frame_index`/
  `frame_count` animation uniforms, shape clipping, `stamp`, and line-numbered
  errors.
- A bounded Lua-subset lexer, parser and tree-walking interpreter with no host
  access. Supports `local`, assignment, calls, `if/elseif/else`, numeric `for`,
  `while`, `break`, table constructors and `[key]` indexing.
- A native chat view, client label and shared output pipeline for
  `pixel_shader`.
- Procedural `shader-horizon` and `shader-orb` examples plus
  `npm run demo:shader`.
- Two-symbol palette-indexed inline frames (`i2`) so shader gradients with up
  to 4,096 colours still render in the native chat canvas.
- Rebuilt `pixel-studio:craft` prompt following oy-pixel's
  `PIXEL_AGENT_INSTRUCTIONS` workflow: prefer shaders over long rows, one
  composition pass, one verification pass, motion parametrization, blockout,
  easing, anticipation, overshoot, smears, sub-pixel motion and loop seams.

### Changed

- `pixel-studio:craft` now references all three tools and the shader API.

## [1.1.0] - 2026-10-21

### Added

- Native in-chat Canvas tool view for `pixel_art` and `pixel_animation`:
  playback, frame stepping, zoom, grid, onion skin, background selection,
  palette display, craft score and file-open actions.
- Compact palette-indexed inline canvas metadata with a 131,072 pixel / 64
  colour budget and a safe fallback.
- `dsh.client` manifest, `./client` export and a dependency-free client bundle.
- DSH system-prompt section `pixel-studio:craft`, adapted from oy-pixel's pixel
  art and animation guidance.
- Deterministic craft report with contrast, isolated-pixel, loop-seam, timing,
  palette and silhouette checks.
- Open-source project documentation, CI, issue/PR templates, security policy
  and third-party notices.
- Reproducible examples including native-canvas animation output.

### Changed

- `includeViewer` now defaults to `false`; the standalone HTML viewer is an
  opt-in export.
- Tool results no longer create deliverable cards automatically.
- OYPX export uses v2 direct-colour row RLE for compatibility with the current
  oy-pixel parser.
- Template palette roles use cooler shadow and warmer highlight ramps.

### Fixed

- GIF global colour table is offset correctly for the transparent index.
- Inline animation loops are validated and seeded in the client canvas.
- Output paths and file metadata are preserved for client-side file actions.

## [1.0.0] - 2026-10-17

- Initial pre-release: palette-aware pixel rendering, PNG/GIF, spritesheets,
  OYPX export, HTML viewer, craft prompt and tests.

[1.3.1]: https://github.com/Fantety/dsh-pixel-studio/releases/tag/v1.3.1
[1.3.0]: https://github.com/Fantety/dsh-pixel-studio/releases/tag/v1.3.0
[1.2.0]: https://github.com/Fantety/dsh-pixel-studio/releases/tag/v1.2.0
[1.1.0]: https://github.com/Fantety/dsh-pixel-studio/releases/tag/v1.1.0
[1.0.0]: https://github.com/Fantety/dsh-pixel-studio/releases/tag/v1.0.0
