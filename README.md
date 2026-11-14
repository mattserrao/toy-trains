# ToyTrains

A calm browser game for building a tabletop HO model railroad, then watching it run or riding along in the cab.

**Status:** v0.1.0, milestone M0 (prototype): a 4×8 ft table in a show hall, snap-together track, and a steam train you can drive.

## Play

Open `index.html` from any static host. There is no build step: three.js is vendored in `vendor/three` and loaded with an import map, so GitHub Pages serves the repo as-is.

Local preview:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Controls

| Action | Mouse / touch | Keys |
| --- | --- | --- |
| Orbit, pan, zoom | Drag, right-drag, scroll / pinch | |
| Cameras | Orbit · Follow · Cab buttons | 1 · 2 · 3 |
| Throttle | Slider | W / S |
| Stop | Stop button | Space |
| Forward / reverse | Direction button | R |
| Whistle | Hold Whistle | Hold H |
| Sound | Sound button | M |
| Build mode | Build button | B |
| Undo | Undo button | Ctrl/Cmd+Z |

In the cab and follow views, drag to look around.

**Building track:** in Build mode, tap a glowing open end, then tap a piece to add it there. Use *Remove piece* and tap the track to open the loop. Layouts autosave on this device only.

## Code map

| Path | What it does |
| --- | --- |
| `src/track/pieces.js` | Sectional track pieces as data (straights, 3 curve radii) |
| `src/track/layout.js` | Layout document, end-to-end snapping, track graph, movement by distance |
| `src/track/trackMesh.js` | Ballast, ties and rails swept along the pieces |
| `src/train/models.js` | 2-6-0 steam loco, tender, boxcar, caboose at HO size |
| `src/train/train.js` | Consist movement, throttle and momentum, smoke and steam |
| `src/audio.js` | Procedural exhaust beats, rail joints, rumble, hiss, whistle, hall ambience |
| `src/cameras.js` | Orbit, follow and cab cameras |
| `src/build.js` | Build mode: open ends, piece palette, remove |
| `src/scene/` | Table, fascia, painted backdrop, show hall, procedural textures, scenery scatter |

## Deploying

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root. Work in progress lives on the `test` branch.
