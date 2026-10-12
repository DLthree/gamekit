/**
 * The desktop build's flavour, set by `scripts/desktop-build.ts` (esbuild define): true in the
 * Steam build, false in the itch (DRM-free) build, whose bundle holds no Steam code at all.
 */
declare const __STEAM__: boolean;
/** The Steam App ID from ship/config.json (Steam build only; 0 in the itch build). */
declare const __STEAM_APP_ID__: number;
