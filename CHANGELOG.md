# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.1.0]: https://github.com/Fantety/dsh-pixel-studio/releases/tag/v1.1.0
[1.0.0]: https://github.com/Fantety/dsh-pixel-studio/releases/tag/v1.0.0
