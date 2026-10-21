/**
 * dsh-pixel-studio host plugin.
 *
 * The package deliberately has no runtime dependencies: it renders pixel art
 * with Node's zlib, writes PNG/GIF/OYPX files, and registers the two tools
 * through the Cordis service surface.
 */
export { apply, inject, name } from './plugin.js';
