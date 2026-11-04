---
name: mapping-led-pixel-maps
description: Use when turning an LED pixel-map chart, LED processor input layout or venue screen drawing (per-screen pixel rectangles on one output canvas) into an obs-mapping mapping — placing several LED screens on one canvas, round or circular LED screens, deciding how content should fill screens of different aspect ratios, content looking stretched or squashed on a screen, or the LED output being offset, scaled or showing the wrong region.
---

# Mapping LED pixel maps

## Overview

An LED pixel map says: "the processor takes one video input of W×H; screen A is the rectangle (x, y, w, h) of it, screen B is …". In obs-mapping that is exactly one Mapping source:

- `canvas` = the processor's input resolution.
- One surface per screen, `corners` = that screen's rectangle.
- `crop` decides **which part of the content** each screen shows.
- Round screens get an ellipse `mask`.

Field rules are in `writing-mapping-json`; sending and verifying are in `driving-obs-mapping-over-websocket`.

**Never commit a client's chart or any numbers derived from it** (screen rectangles, canvas size, the finished mapping JSON) to a repository, issue, or doc. Keep them local to the user's machine. Examples here use invented numbers.

## Step 1 — canvas and scene item

| Item | Value |
|---|---|
| `canvas.width` / `canvas.height` | Processor input resolution, e.g. 3840×2160 |
| OBS base (canvas) resolution | Usually the same, so the output is sent 1:1 |
| Mapping source's scene item | Fill the output 1:1: scale 1, position 0,0, no bounds, no crop |

If the scene item is scaled, every screen is shifted and cut — and a screenshot of the Mapping source alone will still look correct. Check `GetSceneItemTransform`.

## Step 2 — one surface per screen

For a chart rectangle at (x, y) with size w×h:

```
corners = [[x, y], [x+w, y], [x+w, y+h], [x, y+h]]   // TL, TR, BR, BL
```

- Read how the chart states rectangles: width/height, or inclusive end pixels (`x2 − x1 + 1`). An off-by-one shows as a 1px seam or overlap.
- Use the screen's name from the chart as `name`, and a stable `id`.
- Rectangles may touch; they must not overlap unless a mask hides the overlap.

## Step 3 — round screens

A round screen is still a rectangle in the chart; mask it.

| Situation | `mask` |
|---|---|
| Circle inscribed in a square rect | `{type:"ellipse", x:0, y:0, width:1, height:1}` |
| Ellipse filling a non-square rect | same — the unit square stretches with the rect |
| Circle of diameter `h` in a wider `w×h` rect (w > h) | `{x:(1 − h/w)/2, y:0, width:h/w, height:1}` |
| Circle of diameter `w` in a taller `w×h` rect (h > w) | `{x:0, y:(1 − w/h)/2, width:1, height:w/h}` |
| Circle of diameter `D` larger than the rect, centred | `{x:(1 − D/w)/2, y:(1 − D/h)/2, width:D/w, height:D/h}` — negative x/y is fine; the part outside the rect is cut |

Mask coordinates are ratios of the surface, not canvas pixels.

## Step 4 — choose a content recipe

Source size W×H (the OBS source assigned to the surface), screen size w×h.

### (a) Pixel-for-pixel

The content is already authored on a canvas laid out like the chart (same W×H as the processor input). Each screen takes its own rectangle:

```
crop = { x: x/W, y: y/H, width: w/W, height: h/H }
```

No scaling, no distortion. Clamp rounding so `crop.x + crop.width <= 1`.

### (b) Centre cut, no distortion

The same full-frame content on every screen, cut to each screen's aspect.

If the screen is **narrower** than the source (`w/h <= W/H`) — height max:

```
crop.height = 1
crop.width  = (w/h) · (H/W)
crop.x      = (1 − crop.width) / 2
crop.y      = 0
```

If the screen is **wider** than the source (`w/h > W/H`) — width max:

```
crop.width  = 1
crop.height = (h/w) · (W/H)
crop.y      = (1 − crop.height) / 2
crop.x      = 0
```

Using the height-max formula for a wide screen gives `crop.width > 1`, which the plugin rejects.

### (c) Whole source squeezed in

`crop = {x:0, y:0, width:1, height:1}`. Every screen shows the full frame, **distorted** unless `w/h` equals `W/H`. Only choose it when the user asks for it.

## Worked example (invented numbers)

Processor input 3840×2160. Content source "Media A", 1920×1080 (W/H = 16/9 ≈ 1.778). Recipe (b).

| Screen | Rect (x, y, w, h) | w/h | crop | mask |
|---|---|---|---|---|
| Wall (3×1 panels as one) | 0, 0, 1600, 400 | 4.0 — wider | `{x:0, y:0.27778, width:1, height:0.44444}` | — |
| Round | 0, 600, 800, 800 | 1.0 | `{x:0.21875, y:0, width:0.5625, height:1}` | ellipse 0,0,1,1 |
| Pillar | 1000, 600, 600, 1200 | 0.5 | `{x:0.359375, y:0, width:0.28125, height:1}` | — |

Wall: `crop.height = (400/1600)·(1920/1080) = 0.44444`, `crop.y = (1 − 0.44444)/2 = 0.27778`.
Round: `crop.width = 1·(1080/1920) = 0.5625`, `crop.x = 0.21875`.
Pillar: `crop.width = 0.5·0.5625 = 0.28125`, `crop.x = 0.359375`.

```json
{
  "version": 2,
  "canvas": { "width": 3840, "height": 2160 },
  "grid": { "size": 20 },
  "surfaces": [
    { "id": "wall", "name": "Wall", "type": "quad", "source": "Media A",
      "crop": { "x": 0, "y": 0.27778, "width": 1, "height": 0.44444 },
      "corners": [[0, 0], [1600, 0], [1600, 400], [0, 400]], "visible": true },
    { "id": "round", "name": "Round", "type": "quad", "source": "Media A",
      "crop": { "x": 0.21875, "y": 0, "width": 0.5625, "height": 1 },
      "corners": [[0, 600], [800, 600], [800, 1400], [0, 1400]], "visible": true,
      "mask": { "type": "ellipse", "x": 0, "y": 0, "width": 1, "height": 1 } },
    { "id": "pillar", "name": "Pillar", "type": "quad", "source": "Media A",
      "crop": { "x": 0.359375, "y": 0, "width": 0.28125, "height": 1 },
      "corners": [[1000, 600], [1600, 600], [1600, 1800], [1000, 1800]], "visible": true }
  ],
  "groups": [],
  "layers": [{ "surface": "wall" }, { "surface": "round" }, { "surface": "pillar" }]
}
```

Generate this with a small script from the chart table rather than by hand — the arithmetic is where errors creep in.

## Verification checklist

1. `SetMapping` returned `ok: true` (otherwise fix the path in `error`).
2. `ListMappingSources` reports the processor resolution as `width`/`height`.
3. `GetSourceScreenshot` of the Mapping source at full width: each screen's content sits inside its chart rectangle, nothing outside.
4. `GetSceneItemTransform` of the Mapping source's scene item: scale 1, position 0,0 (when canvas = OBS base resolution).
5. Round screens: corners of the rectangle are black/transparent; where rectangles overlap, the mask hides the overlap.
6. Circles look round in the screenshot (if they are ovals, the crop aspect does not match the screen).
7. Overlay is off before the output goes to the LED processor.

## Common mistakes

| Mistake | Reality |
|---|---|
| Canvas = OBS default 1920×1080 while the processor takes another size | Canvas must equal the processor input |
| Crop computed in source pixels | Crop is a 0..1 ratio of the source |
| Height-max formula on a screen wider than the source | `crop.width` exceeds 1 → rejected; use width-max |
| Full-frame crop on every screen "to keep it simple" | Distorts every screen whose aspect differs from the source |
| Mask in chart pixels | Mask is in the surface's unit square |
| Trusting the source screenshot alone | A scaled scene item shifts everything on Program |
| Committing the chart or the generated mapping | Client material — keep it local |
