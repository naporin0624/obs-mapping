#include "source-cache.hpp"

#include <algorithm>
#include <map>

#include "plugin-support.h"

namespace {

struct Resolved {
	obs_source_t *source = nullptr; // strong ref from obs_get_source_by_name
	bool consumed = false;
};

} // namespace

SourceCache::~SourceCache()
{
	clear();
}

void SourceCache::publish_attached()
{
	std::vector<obs_source_t *> next;
	next.reserve(entries_.size());
	for (const Entry &e : entries_)
		next.push_back(e.child);

	std::lock_guard lock(attached_mutex_);
	attached_ = std::move(next);
}

void SourceCache::detach(Entry &entry)
{
	// Callers have already removed the child from attached_, so enum_active_sources cannot see it.
	if (entry.child) {
		obs_source_remove_active_child(owner_, entry.child);
		obs_source_release(entry.child);
		entry.child = nullptr;
	}
	if (entry.texrender) {
		obs_enter_graphics();
		gs_texrender_destroy(entry.texrender);
		obs_leave_graphics();
		entry.texrender = nullptr;
	}
}

void SourceCache::tick(const std::set<std::string> &wanted_names)
{
	++frame_;

	std::map<std::string, Resolved> resolved;
	for (const std::string &name : wanted_names) {
		if (name.empty())
			continue;
		obs_source_t *found = obs_get_source_by_name(name.c_str());
		if (found == owner_) {
			obs_source_release(found);
			found = nullptr;
			if (warned_.insert(name).second)
				obs_log(LOG_WARNING, "source '%s' is this mapping itself; ignoring", name.c_str());
		}
		resolved[name].source = found;
	}

	// Keep an entry when some wanted name still resolves to its child (this also follows renames).
	std::vector<Entry> kept;
	std::vector<Entry> dropped;
	for (Entry &entry : entries_) {
		bool keep = false;
		if (!obs_source_removed(entry.child)) {
			for (auto &[name, r] : resolved) {
				if (!r.consumed && r.source == entry.child) {
					entry.name = name;
					r.consumed = true;
					keep = true;
					break;
				}
			}
		}
		(keep ? kept : dropped).push_back(std::move(entry));
	}
	entries_ = std::move(kept);
	publish_attached();

	for (Entry &entry : dropped)
		detach(entry);

	for (auto &[name, r] : resolved) {
		if (!r.source)
			continue;
		if (r.consumed) {
			obs_source_release(r.source); // the entry already holds its own ref
			continue;
		}
		if (obs_source_removed(r.source) || !obs_source_add_active_child(owner_, r.source)) {
			if (!obs_source_removed(r.source) && warned_.insert(name).second)
				obs_log(LOG_WARNING, "source '%s' would create a recursion; not attached",
					name.c_str());
			obs_source_release(r.source);
			continue;
		}
		warned_.erase(name);
		Entry entry;
		entry.name = name;
		entry.child = r.source; // ownership moves into the entry
		entries_.push_back(std::move(entry));
		publish_attached();
	}

	std::erase_if(warned_, [&](const std::string &n) { return !wanted_names.contains(n); });
}

RenderedChild SourceCache::render(const std::string &name)
{
	auto it = std::find_if(entries_.begin(), entries_.end(), [&](const Entry &e) { return e.name == name; });
	if (it == entries_.end())
		return {};

	Entry &entry = *it;
	const uint32_t width = obs_source_get_width(entry.child);
	const uint32_t height = obs_source_get_height(entry.child);
	if (width == 0 || height == 0)
		return {};

	if (entry.rendered_frame != frame_) {
		const enum gs_color_space current_space = gs_get_color_space();
		const enum gs_color_space space = obs_source_get_color_space(entry.child, 1, &current_space);
		const enum gs_color_format format = gs_get_format_from_space(space);

		if (entry.texrender && gs_texrender_get_format(entry.texrender) != format) {
			gs_texrender_destroy(entry.texrender);
			entry.texrender = nullptr;
		}
		if (!entry.texrender)
			entry.texrender = gs_texrender_create(format, GS_ZS_NONE);

		gs_texrender_reset(entry.texrender);
		if (gs_texrender_begin_with_color_space(entry.texrender, width, height, space)) {
			vec4 clear_color;
			vec4_zero(&clear_color);
			gs_clear(GS_CLEAR_COLOR, &clear_color, 0.0f, 0);
			gs_ortho(0.0f, static_cast<float>(width), 0.0f, static_cast<float>(height), -100.0f, 100.0f);
			obs_source_video_render(entry.child);
			gs_texrender_end(entry.texrender);
		}
		entry.rendered_frame = frame_;
	}

	return {entry.texrender ? gs_texrender_get_texture(entry.texrender) : nullptr, width, height};
}

void SourceCache::enum_active_sources(obs_source_enum_proc_t callback, void *param)
{
	// Held across the callback so tick() cannot release a child that is being enumerated.
	std::lock_guard lock(attached_mutex_);
	for (obs_source_t *child : attached_)
		callback(owner_, child, param);
}

void SourceCache::clear()
{
	{
		std::lock_guard lock(attached_mutex_);
		attached_.clear();
	}
	for (Entry &entry : entries_)
		detach(entry);
	entries_.clear();
	warned_.clear();
}
