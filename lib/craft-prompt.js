/**
 * Prompt section adapted from oy-pixel's in-editor pixel-art system prompt
 * (https://github.com/Fantety/oy-pixel), Copyright (c) 2026 Fantety. Adapted
 * and re-licensed under this repository's MIT license by the copyright holder.
 * The section is registered with dsh-system-prompt so it is present on every
 * model step while the plugin is mounted, not only inside tool descriptions.
 */
export const PIXEL_CRAFT_PROMPT = `PIXEL ART CRAFT — apply whenever you use pixel_art or pixel_animation:
- Simplify to canvas resolution: silhouette first, then 2-4 signature details; under 32px use 2-4 base colours and bolder features.
- Keep clean stair-stepped diagonals: 45° = 1px per row, ~22.6° = 2px runs, ~30° = even spacing; isometric edges share one grid angle. No stray single pixels — details should read as 2x2+ clusters (sparkles/stars excepted).
- Use one light source, default top-left: flat base, a narrow shadow ramp on the opposite side, darkest just past the terminator, a small highlight, and a consistent cast shadow.
- Build 3-5 step ramps per material with hue shifts: cooler/darker shadows, warmer highlights; reuse palette colours instead of inventing near-duplicates.
- Use ordered dithering (checkerboard/noise) for broad smooth transitions instead of adding extra in-between colours.
- Pick one outline strategy per drawing: solid dark, selective darker shadow edges, or none; hue-shift the outline instead of using pure black.
- Anti-alias sparingly: at most one intermediate colour where a curve meets a contrasting background; none on tiny sprites or outlines.
- Keep layers purposeful: background, shadow, body, highlights/details; preserve transparency.
- Before calling the tool, sketch rows mentally and keep every row the same width, every symbol in the legend/palette.

PIXEL ANIMATION CRAFT — apply whenever the artwork animates:
- Default to ~12 FPS (83ms) unless asked otherwise. Lean counts: idle 2-4, walk 4-8, run 6-12, attack 3-6 frames.
- Plan key poses and the motion path first; use the motion presets when they fit, otherwise explicit frames. Ease with sin/cos or smoothstep — avoid linear starts/stops.
- Add anticipation (1-2 frames opposite the action), ~10-20% overshoot before settling, and squash on landings.
- Keep silhouette, proportions, palette, and signature details readable in every frame; the loop seam must match or mirror the start.
- For fast actions use a 1-2 frame smear/stretch; for 1-2px moves use subpixel dithering or blended coverage.
- Secondary motion (hair, cape, tail, weapon) follows with lag and smaller amplitude, ideally on its own layer.
- Read the craft report and preview after generating; fix actionable warnings before finishing.`;
