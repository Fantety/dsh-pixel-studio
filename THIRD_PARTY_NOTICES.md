# Third-party notices

This project is original code except where noted below. No third-party source
code or binaries are bundled in the npm package.

## DeepSeek Harness

- Project: <https://github.com/deepseek-ai/deepseek-harness>
- License: MIT
- Usage: This plugin is designed to run inside DeepSeek Harness and uses its
  Cordis plugin APIs plus the Web client's plugin/slot contract. DSH code is
  not copied or bundled here; it is a runtime dependency.

## oy-pixel — pixel-art craft guidance

- Project: <https://github.com/Fantety/oy-pixel>
- Copyright: Copyright (c) 2026 Fantety
- Usage: The pixel-art craft guidance in `lib/craft-prompt.js` is adapted from
  oy-pixel's in-editor `PIXEL_AGENT_INSTRUCTIONS` ("PIXEL ART CRAFT" and
  "PIXEL ANIMATION CRAFT" sections).
- Also adapted: the `pixel_shader` canvas/helper API and animation-uniform
  design follow oy-pixel's `pixel_run_shader` contract. The JavaScript lexer,
  parser, interpreter and renderer in this repository are original
  implementations; no Rust/Lua source or binary is copied.
- Licensing note: oy-pixel is separately distributed under its own license.
  The adapted guidance and API design in this repository were contributed by
  the copyright holder of both projects and are released under this
  repository's MIT license. No oy-pixel source code or binary is copied into
  this repository.

## React

- Project: <https://react.dev/>
- License: MIT
- Usage: The client half loads the `react` module supplied by DeepSeek Harness.
  React is not bundled in this package.

## Development-only tooling

The test suite uses only Node.js built-ins. GitHub Actions uses the standard
`actions/checkout` and `actions/setup-node` actions under their own licenses.
