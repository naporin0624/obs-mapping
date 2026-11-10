#pragma once

// obs-websocket vendor "surface-mapper": ListMappingSources, GetMapping, SetMapping, SetOverlay
// and the MappingChanged / OverlayChanged events. Call register_vendor() from obs_module_post_load only.
// Without obs-websocket this logs a warning and does nothing.
void register_vendor();
// Stops emitting events. Call from obs_module_unload.
void unregister_vendor();
