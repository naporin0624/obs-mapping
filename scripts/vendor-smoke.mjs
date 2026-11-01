// Smoke test for the obs-mapping obs-websocket vendor API.
// Mutates the chosen Mapping source (and restores it at the end), so only run it against an OBS you can spare.
//   OBS_WS_URL=ws://127.0.0.1:4455 OBS_WS_PASSWORD=... [OBS_MAPPING_SOURCE=name] node scripts/vendor-smoke.mjs
import OBSWebSocket from "obs-websocket-js";

const VENDOR = "obs-mapping";
const url = process.env.OBS_WS_URL ?? "ws://127.0.0.1:4455";
const password = process.env.OBS_WS_PASSWORD || undefined;
const wantedSource = process.env.OBS_MAPPING_SOURCE || undefined;

const obs = new OBSWebSocket();
const events = [];
const overlayEvents = [];

class SmokeFailure extends Error {}

function check(condition, message) {
  if (!condition) throw new SmokeFailure(message);
  console.log(`ok   ${message}`);
}

async function call(requestType, requestData) {
  const res = await obs.call("CallVendorRequest", { vendorName: VENDOR, requestType, requestData });
  return res.responseData;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(50);
  }
  return predicate();
}

async function run() {
  obs.on("VendorEvent", (e) => {
    if (e.vendorName === VENDOR && e.eventType === "MappingChanged") events.push(e.eventData);
    if (e.vendorName === VENDOR && e.eventType === "OverlayChanged") overlayEvents.push(e.eventData);
  });

  // 1. List
  const list = await call("ListMappingSources", {});
  check(list?.ok === true && Array.isArray(list.sources), "ListMappingSources returns ok with sources");
  const target = wantedSource ?? list.sources[0]?.name;
  check(
    typeof target === "string" && list.sources.some((s) => s.name === target),
    `target Mapping source exists (${target ?? "none found"})`,
  );

  // 2. Get
  const got = await call("GetMapping", { sourceName: target });
  check(got?.ok === true && typeof got.mappingJson === "string", "GetMapping returns mappingJson");
  check(typeof got.overlayEnabled === "boolean", "GetMapping returns overlayEnabled");
  const originalOverlay = got.overlayEnabled;
  const original = JSON.parse(got.mappingJson);
  check(original.version === 1, "GetMapping returns a version 1 mapping");
  let restoreNeeded = false;

  try {
    // 3. Set with one more surface
    const added = {
      id: `smoke-${Date.now()}`,
      name: "Smoke",
      type: "quad",
      source: "",
      crop: { x: 0, y: 0, width: 1, height: 1 },
      corners: [
        [100, 100],
        [500, 100],
        [500, 400],
        [100, 400],
      ],
      visible: true,
    };
    const next = { ...original, surfaces: [...original.surfaces, added] };
    const eventsBefore = events.length;
    restoreNeeded = true;
    const set = await call("SetMapping", { sourceName: target, mappingJson: JSON.stringify(next) });
    check(set?.ok === true, "SetMapping with an added surface succeeds");

    // 4. Get again
    const again = await call("GetMapping", { sourceName: target });
    const againMapping = JSON.parse(again?.mappingJson ?? "{}");
    check(
      again?.ok === true && againMapping.surfaces.length === original.surfaces.length + 1,
      "GetMapping reflects the added surface",
    );
    check(againMapping.surfaces.at(-1)?.id === added.id, "the added surface is the last one");

    // 6 (checked after the valid Set, before the invalid one). MappingChanged exactly once.
    check(await waitFor(() => events.length > eventsBefore, 2000), "MappingChanged event received");
    await sleep(300);
    check(events.length - eventsBefore === 1, "MappingChanged received exactly once for the valid Set");
    const ev = events.at(-1);
    check(ev.sourceName === target && JSON.parse(ev.mappingJson ?? "{}").surfaces?.length === next.surfaces.length, "event carries sourceName and the new mappingJson");
    check(typeof ev.overlayEnabled === "boolean", "MappingChanged carries overlayEnabled");

    // 5. Invalid Set (3 corners)
    const bad = {
      ...original,
      surfaces: [{ ...added, id: "smoke-bad", corners: added.corners.slice(0, 3) }],
    };
    const eventsBeforeBad = events.length;
    const rejected = await call("SetMapping", { sourceName: target, mappingJson: JSON.stringify(bad) });
    check(rejected?.ok === false, "SetMapping with 3 corners is rejected");
    check(
      typeof rejected.error === "string" && rejected.error.includes("surfaces[0].corners"),
      `error names surfaces[0].corners (${rejected.error})`,
    );
    await sleep(300);
    check(events.length === eventsBeforeBad, "rejected SetMapping emits no MappingChanged");

    // SetOverlay: selection-only keeps the flag; an explicit enabled flips it and emits OverlayChanged once.
    const selection = JSON.stringify({ selectedSurfaceIds: [], selectedCorner: null });
    const keep = await call("SetOverlay", { sourceName: target, selectionJson: selection });
    check(keep?.ok === true, "SetOverlay without enabled succeeds");
    const afterKeep = await call("GetMapping", { sourceName: target });
    check(afterKeep?.overlayEnabled === originalOverlay, "SetOverlay without enabled keeps the overlay flag");

    const flipped = !originalOverlay;
    const overlayBefore = overlayEvents.length;
    const flip = await call("SetOverlay", { sourceName: target, enabled: flipped, selectionJson: selection });
    check(flip?.ok === true, "SetOverlay with enabled succeeds");
    check(await waitFor(() => overlayEvents.length > overlayBefore, 2000), "OverlayChanged event received");
    check(overlayEvents.at(-1).sourceName === target && overlayEvents.at(-1).enabled === flipped, "OverlayChanged carries sourceName and enabled");
    const afterFlip = await call("GetMapping", { sourceName: target });
    check(afterFlip?.overlayEnabled === flipped, "GetMapping reflects the new overlay flag");
    const unchangedBefore = overlayEvents.length;
    await call("SetOverlay", { sourceName: target, enabled: flipped, selectionJson: selection });
    await sleep(300);
    check(overlayEvents.length === unchangedBefore, "setting the same overlay flag emits no OverlayChanged");
    await call("SetOverlay", { sourceName: target, enabled: originalOverlay, selectionJson: selection });

    const missing = await call("GetMapping", { sourceName: "__no_such_source__" });
    check(missing?.ok === false && missing.error.startsWith("source not found"), "unknown source is reported");
  } finally {
    if (restoreNeeded) {
      const restored = await call("SetMapping", { sourceName: target, mappingJson: JSON.stringify(original) });
      if (restored?.ok !== true) throw new SmokeFailure(`could not restore the original mapping: ${restored?.error}`);
      console.log("restored the original mapping");
    }
  }
}

try {
  await obs.connect(url, password);
} catch (e) {
  console.error(`smoke: cannot connect to ${url}: ${e.message}`);
  process.exit(1);
}

try {
  await run();
  console.log("smoke: all passed");
} catch (e) {
  console.error(`smoke: FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  await obs.disconnect().catch(() => {});
}
