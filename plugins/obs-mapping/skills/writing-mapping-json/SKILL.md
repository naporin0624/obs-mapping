---
name: writing-mapping-json
description: Use when writing, generating, editing or reviewing an obs-mapping mapping JSON (version 2) — surfaces, crop, corners, masks, groups, layers — or when SetMapping / Import rejects a document with a path-prefixed error such as "surfaces[0].crop: must satisfy …", "surfaces: order must match the depth-first order of layers", "layers: surface \"x\" is missing from the tree" or "surfaces[1].mask: expected object", or when a surface shows the wrong part of its source, appears in the wrong place, or does not draw at all.
---

# Writing mapping JSON (v2)

## Overview

A mapping is one JSON document per Mapping source. The plugin validates the **whole** document and either applies all of it or rejects it with the **first** error, prefixed with its JSON path. Unknown fields are ignored.

To send it, see `driving-obs-mapping-over-websocket`. For LED charts, see `mapping-led-pixel-maps`.

## Two coordinate systems — don't mix them

| Field | Space | Meaning |
|---|---|---|
| `crop` | **Ratio 0..1 of the source frame** | Which part of the input to take |
| `corners` | **Canvas pixels** | Where that part lands on the output |
| `mask` | **Ratio of the surface's own unit square** (after crop) | Which part of the warped quad stays opaque |

`crop` is a ratio, so if the source's resolution changes (e.g. a 1920×1080 clip replaced by 3840×2160), the same region is still taken. `corners` are absolute pixels on the canvas and do not care about the source size. Whatever `crop` selects is stretched to fill the four corners — if the crop's aspect ratio differs from the quad's, the image is distorted.

## Top level

| Field | Rule |
|---|---|
| `version` | Integer `1` or `2`. Write `2` |
| `canvas.width` / `canvas.height` | Integer 1..16384. This **is** the Mapping source's output size |
| `grid.size` | Number, > 0 and ≤ 1024 (editor snapping only) |
| `surfaces` | Array of surfaces |
| `groups` | Required in v2. Array (may be empty) |
| `layers` | Required in v2. Tree of `{ "surface": id }` / `{ "group": id, "children": [...] }` |

v1 (no `groups`/`layers`) is still accepted and read as all surfaces at the top level; `GetMapping` always returns v2.

## Surface

| Field | Rule |
|---|---|
| `id` | Non-empty string, unique across surfaces **and** groups |
| `name` | String |
| `type` | Must be `"quad"` |
| `source` | String — the OBS source **name**. `""` is valid but the surface never draws |
| `crop` | `{x, y, width, height}`: `x,y >= 0`, `width,height > 0`, `x+width <= 1`, `y+height <= 1` |
| `corners` | Exactly 4 `[x, y]` finite numbers, order **[TL, TR, BR, BL]**. Source (0,0)→TL, (1,0)→TR, (1,1)→BR, (0,1)→BL. Values outside the canvas are allowed (the part outside is cut off) |
| `visible` | Boolean, optional (default `true`) |
| `mask` | Optional. **Omit the key** for no mask |

A surface whose source is missing, has 0×0 size, or whose four corners are degenerate (three on a line) is silently not drawn — `SetMapping` still returns `ok: true`. Non-convex quads draw as-is.

## Mask

Two shapes, both in the surface's **unit square** (0,0 = TL corner, 1,1 = BR corner — the same space as the crop region after warping). The mask warps with the corners, so a circle on a trapezoid becomes an egg.

```json
{ "type": "ellipse", "x": 0, "y": 0, "width": 1, "height": 1 }
{ "type": "polygon", "points": [[0.5, 0], [1, 1], [0, 1]] }
```

| Rule | Error when broken |
|---|---|
| Must be an object; `"mask": null` is rejected | `surfaces[i].mask: expected object` |
| `type` is `"ellipse"` or `"polygon"` | `surfaces[i].mask.type: unknown type "…"` |
| Ellipse `x`, `y`, `width`, `height` all present, finite | `…mask.x: missing` / `expected number` / `expected finite number` |
| Ellipse `width`, `height` > 0 | `surfaces[i].mask.width: must be greater than 0` |
| Polygon has 3–64 `[x, y]` points | `surfaces[i].mask.points: expected 3 to 64 points` |

- Coordinates may go outside 0..1 (a circle bigger than its rectangle); only the part inside the quad is visible.
- Polygons use the **even-odd** rule: a self-intersecting or doubly wound region becomes a hole.
- Outside the mask is fully transparent, so lower surfaces show through.

## Groups and layers

```json
{ "id": "g-1", "name": "Row", "visible": true, "origin": [0, 0],
  "layout": { "direction": "row", "gap": 0, "align": "start", "padding": 0 } }
```

| Field | Rule |
|---|---|
| `groups[].id` | Non-empty, unique across groups and surfaces |
| `groups[].name`, `origin` | Required; `origin` is finite `[x, y]` |
| `groups[].visible` | Optional boolean; `false` hides every surface below it |
| `groups[].layout` | All required: `direction` `row`/`column`, `align` `start`/`center`/`end`, `gap` and `padding` 0..4096 |
| `layers` | Every surface and group appears **exactly once**; each node has exactly one of `surface` / `group`; depth ≤ 16; empty groups allowed |
| **Order** | `surfaces` must be in the depth-first order of `layers`. Later = drawn on top |

The plugin draws only from `corners`; group `layout` is applied by the dock when it edits. If you generate JSON by hand, put the final positions in `corners` and keep surfaces you want laid out by hand **outside** groups (or use no groups at all: `"groups": []`, `"layers": [{ "surface": "a" }, …]`).

## Minimal valid document

```json
{
  "version": 2,
  "canvas": { "width": 1920, "height": 1080 },
  "grid": { "size": 20 },
  "surfaces": [
    {
      "id": "left", "name": "Left", "type": "quad", "source": "Media A",
      "crop": { "x": 0, "y": 0, "width": 0.5, "height": 1 },
      "corners": [[0, 0], [960, 0], [960, 1080], [0, 1080]]
    }
  ],
  "groups": [],
  "layers": [{ "surface": "left" }]
}
```

## Masked example — round screen

A 600×600 round screen placed at (1200, 200), showing the centre square of a 16:9 source:

```json
{
  "id": "round", "name": "Round", "type": "quad", "source": "Media A",
  "crop": { "x": 0.21875, "y": 0, "width": 0.5625, "height": 1 },
  "corners": [[1200, 200], [1800, 200], [1800, 800], [1200, 800]],
  "visible": true,
  "mask": { "type": "ellipse", "x": 0, "y": 0, "width": 1, "height": 1 }
}
```

`crop.width = 0.5625 = (600/600)·(1080/1920)`; `crop.x = (1 − 0.5625)/2`.

## Validation errors you will hit first

Errors are `<path>: <reason>`. Most common in hand-written JSON:

| Error | Fix |
|---|---|
| `json: …` | Not valid JSON (trailing comma, comments) |
| `groups: missing` / `layers: missing` | v2 needs both, even if empty / flat |
| `surfaces: order must match the depth-first order of layers` | Reorder `surfaces` to match `layers` |
| `layers: surface "x" is missing from the tree` | Every surface needs a `layers` node |
| `layers[0].surface: unknown surface "x"` | Node points at an id that does not exist |
| `layers[1].surface: surface "x" appears more than once` | Each id appears once in the tree |
| `layers[0]: expected exactly one of "surface" or "group"` | A node has both keys or neither |
| `surfaces[0].id: duplicate id "x"` | Ids are shared between surfaces and groups |
| `surfaces[0].type: unknown type "…"` | Only `"quad"` |
| `surfaces[0].crop: must satisfy x,y >= 0, width,height > 0, x+width <= 1, y+height <= 1` | Crop is a ratio; check rounding so `x+width` does not exceed 1 |
| `surfaces[0].corners: expected 4 points` | Exactly four `[x, y]` |
| `canvas.width: expected integer` / `must be between 1 and 16384` | Integer pixels |
| `grid.size: must be greater than 0 and at most 1024` | |
| `groups[0].layout.gap: must be between 0 and 4096` | |

## Common mistakes

| Mistake | Reality |
|---|---|
| `crop` in source pixels | `crop` is a 0..1 ratio of the source frame |
| `corners` as ratios | `corners` are canvas pixels |
| Corners in Z order or clockwise from BL | Order is TL, TR, BR, BL |
| `"mask": null` to clear a mask | Rejected — omit the key |
| Mask in canvas pixels | Mask is in the surface's unit square |
| Editing one surface and sending only it | `SetMapping` replaces the whole mapping |
| `crop.x + crop.width` = 1.0000000001 from float math | Rejected; clamp or round |
| Expecting group `layout` to move surfaces when sent over the API | The plugin draws `corners`; layout is computed by the dock |
