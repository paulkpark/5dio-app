# tools/

Development-only files. Not served — `server.js` only exposes `public/`, `assets/`,
`landing/` and `tests/`, so nothing here reaches the web.

## torus-harness.html

Standalone tuning harness for the Quantum Torus renderer that ships in the app as
the Cymatics **Torus** style. Open it directly in a browser (`file://` works).

What it adds over the in-app version:

- live sliders for every renderer parameter (`CONTROLS`, with `topo` flags marking
  the ones that rebuild geometry so they can be debounced)
- an FPS readout
- selectable audio sources, including mic and file, via its own `AudioContext`
- a permalink that encodes the current parameter set, so a look can be shared or
  reloaded exactly

This is where the nine presets in `public/js/torus-viz.js` were authored — sweep
the sliders, find a look, copy the values into `TORUS_PRESETS`.

**Caveat:** the renderer core is *inlined* here, so it is a second copy of the code
in `public/js/torus-viz.js`. They were byte-identical when the app module was
extracted (2026-08-16). Nothing keeps them in sync — if you change the renderer in
the app, this harness will drift and its tuning will stop transferring. Re-sync by
copying the app module's core back in, or by rewriting the harness to `import` it.

The harness deliberately owns an `AudioContext`; the app does not, because
connecting the main player element to one breaks background playback on iOS.
