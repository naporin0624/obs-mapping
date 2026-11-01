#pragma once

#include <obs-module.h>

#include <cstdint>
#include <mutex>
#include <set>
#include <string>
#include <vector>

struct RenderedChild {
	gs_texture_t *texture = nullptr;
	uint32_t width = 0;
	uint32_t height = 0;
};

// Resolves the child sources a Mapping references, keeps them active while attached,
// and renders each one at most once per frame.
// tick/render/clear run on the graphics thread (clear also from destroy);
// enum_active_sources may be called from any thread.
class SourceCache {
public:
	explicit SourceCache(obs_source_t *owner) : owner_(owner) {}
	~SourceCache();
	SourceCache(const SourceCache &) = delete;
	SourceCache &operator=(const SourceCache &) = delete;

	// Re-resolves every wanted name and re-attaches children whose resolution changed.
	void tick(const std::set<std::string> &wanted_names);
	// Returns the child's frame for this tick, or an empty result when unresolved or 0x0.
	RenderedChild render(const std::string &name);
	void enum_active_sources(obs_source_enum_proc_t callback, void *param);
	// Detaches and releases every child and frees GPU resources.
	void clear();

private:
	struct Entry {
		std::string name;
		obs_source_t *child = nullptr; // strong ref, registered via obs_source_add_active_child
		gs_texrender_t *texrender = nullptr;
		uint64_t rendered_frame = 0;
	};

	void detach(Entry &entry);
	void publish_attached();

	obs_source_t *owner_;
	std::vector<Entry> entries_;   // graphics thread only
	std::set<std::string> warned_; // graphics thread only
	uint64_t frame_ = 0;

	std::mutex attached_mutex_;
	std::vector<obs_source_t *> attached_; // mirror of entries_[*].child for enum_active_sources
};
