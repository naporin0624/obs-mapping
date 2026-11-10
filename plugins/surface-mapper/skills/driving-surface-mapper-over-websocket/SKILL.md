---
name: driving-surface-mapper-over-websocket
description: Use when a script, agent or app needs to read or change a Surface Mapper Mapping source from outside the dock — calling CallVendorRequest with vendor "surface-mapper", creating a Mapping source over obs-websocket, listening for MappingChanged / OverlayChanged, a SetMapping that returns ok:false, a mapping that was sent but the output looks unchanged, or Program showing only part (e.g. a quarter) of a mapping that looks correct in a source screenshot.
---

# Driving Surface Mapper over obs-websocket

## Overview

Surface Mapper exposes one obs-websocket **vendor** named `surface-mapper`. Everything the dock does — list Mapping sources, read a mapping, replace it, toggle the editing overlay — goes through four vendor requests. Payloads that are JSON documents travel as **strings** (`mappingJson`, `selectionJson`), not objects.

For the content of `mappingJson` see `writing-mapping-json`. For building a mapping from an LED chart see `mapping-led-pixel-maps`.

## Connecting

- URL and password come from OBS: **Tools > WebSocket Server Settings** (enable the server; default port `4455`). The dock's default URL is `ws://127.0.0.1:4455`. Ask the user for the password — never guess or brute-force it.
- obs-websocket close code `4009` = authentication failed (the dock treats it as non-retryable).
- With `obs-websocket-js` loaded via dynamic `import()` in some Node/ESM setups, the class can end up nested: use `const OBSWebSocket = mod.default?.default ?? mod.default;`.

```typescript
const obs = new OBSWebSocket();
await obs.connect("ws://127.0.0.1:4455", password || undefined);

const call = async (requestType: string, requestData: Record<string, unknown>) => {
  const res = await obs.call("CallVendorRequest", {
    vendorName: "surface-mapper",
    requestType,
    requestData,
  });
  return res.responseData; // { ok: true, ... } | { ok: false, error: string }
};
```

The plugin's reply is in `responseData`. Always check `ok` — a failed vendor request is still a successful obs-websocket call.

## Vendor requests

| Request | `requestData` | `responseData` on success |
|---|---|---|
| `ListMappingSources` | `{}` | `{ ok: true, sources: [{ name, width, height }] }` |
| `GetMapping` | `{ sourceName }` | `{ ok: true, mappingJson, overlayEnabled }` |
| `SetMapping` | `{ sourceName, mappingJson, requestId? }` | `{ ok: true }` |
| `SetOverlay` | `{ sourceName, enabled?, selectionJson? }` | `{ ok: true }` |

Failures are `{ ok: false, error }` with `error` one of:

| `error` | Cause |
|---|---|
| `source not found: <name>` | No OBS source with that name |
| `not a mapping source: <name>` | Source exists but is not a Mapping source |
| `mappingJson: missing` | `SetMapping` without `mappingJson` |
| `<json path>: <reason>` | Mapping validation failed, e.g. `surfaces[2].corners: expected 4 points` |
| `json: <parser message>` | `mappingJson` is not valid JSON |
| `selectionJson: <reason>` | `SetOverlay` selection could not be parsed |

`width` / `height` in `ListMappingSources` are the mapping's `canvas` size — the Mapping source's output size **is** its canvas.

### SetMapping replaces everything

`SetMapping` swaps in the whole document; there is no patch. The safe edit loop is:

1. `GetMapping` → `JSON.parse(mappingJson)` (the plugin returns canonical v2).
2. Change what you need.
3. `SetMapping` with `JSON.stringify(...)`.
4. On `ok: false`, nothing was applied — fix the path named in `error` and resend.

A successful `SetMapping` is persisted into the source's settings (and so into the scene collection).

### SetOverlay

- `enabled` omitted → the current on/off flag is kept; only the selection changes.
- `selectionJson` omitted → empty selection. Shape: `{"selectedSurfaceIds": string[], "selectedCorner": {"surfaceId": string, "index": 0..3} | null}` (both keys optional).
- **The overlay is drawn into the Mapping source's output, so it appears on stream/recording.** Turn it off (`enabled: false`) before going live. It is always off after OBS starts.

## Events

Subscribe to obs-websocket `VendorEvent` and filter `vendorName === "surface-mapper"`.

| `eventType` | `eventData` | Fires when |
|---|---|---|
| `MappingChanged` | `{ sourceName, mappingJson, overlayEnabled, requestId? }` | The mapping changed (any path), or a `SetMapping` carried a `requestId` even if nothing changed |
| `OverlayChanged` | `{ sourceName, enabled }` | Overlay on/off flipped, via `SetOverlay` or the properties checkbox |

`requestId`: pass any non-empty string to `SetMapping`; the `MappingChanged` it causes carries the same id, so a client can recognise its own echo. Empty strings and non-string values count as "no id". A rejected `SetMapping` emits nothing. `mappingJson` in the event is the value at emit time and can include another client's concurrent edit.

## Creating a Mapping source

The input kind is `surface_mapper_source`. A new source starts with a 1920×1080 canvas and no surfaces.

```typescript
await obs.call("CreateInput", {
  sceneName: "Mapping",           // the scene the user names
  inputName: "LED Wall",
  inputKind: "surface_mapper_source",
});
const r = await call("SetMapping", { sourceName: "LED Wall", mappingJson });
```

Find existing ones with `ListMappingSources`, or `GetInputList` filtered by `inputKind === "surface_mapper_source"`.

Do **not** write the mapping through `CreateInput`'s `inputSettings.mapping_json` or `SetInputSettings`: that path only logs a warning on invalid JSON and keeps the old mapping, so the client never sees the error. Create the source, then `SetMapping`.

## Checking the result

`GetSourceScreenshot` on the Mapping source shows what it renders:

```typescript
const { imageData } = await obs.call("GetSourceScreenshot", {
  sourceName: "LED Wall", imageFormat: "png", imageWidth: 1920,
});
```

A screenshot of the **source** says nothing about how its **scene item** is placed. Check that too.

### Pitfall: the scene item is scaled

A Mapping source's size follows its canvas. A scene item added (or left) with a transform from an earlier size can end up scaled — e.g. scale 2 on a canvas-sized source, so Program shows only the top-left quarter while the source screenshot looks perfect.

When the canvas equals OBS's base resolution (`GetVideoSettings` → `baseWidth` / `baseHeight`):

1. `GetSceneItemId { sceneName, sourceName }` → `sceneItemId`.
2. `GetSceneItemTransform` → expect `scaleX = scaleY = 1`, `positionX = positionY = 0`, no bounds, no crop.
3. If not, `SetSceneItemTransform { sceneItemTransform: { scaleX: 1, scaleY: 1, positionX: 0, positionY: 0 } }` (and reset bounds/crop if set).

Re-check after any `SetMapping` that changes `canvas`.

## Safety around a live setup

- Before anything disruptive (creating/removing inputs, changing canvas, switching scenes), check `GetStreamStatus` / `GetRecordStatus` → `outputActive`. If live, ask first.
- Switching scene collections replaces the user's whole live setup. Work in the collection the user names; do not switch to "a clean one" on your own.
- Do not rename sources the mapping references: a rename inside OBS is followed automatically, but an external delete is not, and that surface just stops drawing.

## Common mistakes

| Mistake | Reality |
|---|---|
| Sending `mappingJson` as an object | It must be a JSON **string** (`JSON.stringify`) |
| Reading the reply from the top level | The plugin's reply is `res.responseData` |
| Treating a resolved `call` as success | Check `responseData.ok`; validation errors come back as `ok: false` |
| Sending only the changed surface | `SetMapping` replaces the whole mapping — always send the full document |
| `SetInputSettings({ mapping_json })` to apply a mapping | Invalid JSON is silently ignored there; use `SetMapping` |
| Waiting for `MappingChanged` after a no-op `SetMapping` without `requestId` | No change and no id → no event |
| Verifying only with a source screenshot | Also check the scene item transform; scale ≠ 1 crops Program |
| Leaving the overlay on | It is burned into the output, including stream and recording |
