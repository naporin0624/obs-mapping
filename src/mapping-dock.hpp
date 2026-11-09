#pragma once

class QDockWidget;

// Registers the "OBS Mapping" browser dock. Call from obs_module_post_load only, so OBS
// restores the saved DockState onto it. Without obs-browser this logs a warning and does nothing.
void register_mapping_dock();
// Stops listening to frontend events. Call from obs_module_unload.
void unregister_mapping_dock();
// The registered dock, or nullptr when the dock is not registered.
QDockWidget *mapping_dock_widget();
