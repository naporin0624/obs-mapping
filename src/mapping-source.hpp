#pragma once

#include <obs-module.h>

#include <expected>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string_view>
#include <vector>

#include "obs-mapping/homography.hpp"
#include "obs-mapping/mapping_json.hpp"
#include "overlay.hpp"
#include "source-cache.hpp"

extern struct obs_source_info mapping_source_info;

// Immutable view of the applied mapping plus per-surface inverse homographies
// (canvas px -> unit square). Swapped atomically; readers keep their own pointer.
struct MappingSnapshot {
	obs_mapping::Mapping mapping;
	std::vector<std::optional<obs_mapping::Mat3>> inv_h; // parallel to mapping.surfaces
};

struct MappingSource {
	obs_source_t *source = nullptr;

	MappingSource(obs_source_t *source, obs_data_t *settings);
	~MappingSource();
	MappingSource(const MappingSource &) = delete;
	MappingSource &operator=(const MappingSource &) = delete;

	// Any thread.
	obs_mapping::Mapping current() const;
	// Any thread. Validates first; on failure nothing changes.
	std::expected<void, obs_mapping::ParseError> set_mapping_json(std::string_view json);

	// Any thread. Replaces the overlay state and mirrors `enabled` into the `overlay` setting.
	void set_overlay(OverlayState state);

	// OBS source callbacks (graphics thread unless noted).
	void update(obs_data_t *settings);
	void video_tick();
	void video_render();
	uint32_t width() const;
	uint32_t height() const;
	void enum_active_sources(obs_source_enum_proc_t callback, void *param);
	void on_source_renamed(const char *prev_name, const char *new_name); // signal thread

private:
	std::shared_ptr<const MappingSnapshot> snapshot() const;
	std::shared_ptr<const OverlayState> overlay() const;
	// Caller holds write_mutex_. Returns whether the applied mapping changed.
	std::expected<bool, obs_mapping::ParseError> apply_json(std::string_view json);
	void load_effect();

	mutable std::mutex state_mutex_;
	std::shared_ptr<const MappingSnapshot> snapshot_;
	std::shared_ptr<const OverlayState> overlay_; // guarded by state_mutex_
	std::mutex write_mutex_; // serializes apply_json + settings writes

	SourceCache cache_;
	gs_effect_t *effect_ = nullptr;
};

// Null unless `src` is a Mapping source.
MappingSource *mapping_source_from(obs_source_t *src);

// Invoked (on any thread) whenever a source's applied mapping changes.
void set_on_mapping_changed(std::function<void(MappingSource &)> handler);
