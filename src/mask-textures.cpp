#include "mask-textures.hpp"

#include <cstdint>
#include <vector>

#include "obs-mapping/mask.hpp"
#include "plugin-support.h"

namespace {

gs_texture_t *create_mask_texture(const obs_mapping::Mask &mask, uint32_t width, uint32_t height)
{
	const std::vector<uint8_t> coverage = obs_mapping::rasterize_mask(mask, width, height);
	const uint8_t *data = coverage.data();
	gs_texture_t *texture = gs_texture_create(width, height, GS_R8, 1, &data, 0);
	if (!texture)
		obs_log(LOG_WARNING, "failed to create a %ux%u mask texture; drawing without the mask", width, height);
	return texture;
}

} // namespace

gs_texture_t *MaskTextures::get(const std::string &surface_id, const obs_mapping::Mask &mask, uint32_t width,
				uint32_t height)
{
	auto it = entries_.find(surface_id);
	if (it != entries_.end()) {
		Entry &entry = it->second;
		if (entry.mask == mask && entry.width == width && entry.height == height)
			return entry.texture;
		gs_texture_destroy(entry.texture);
		entries_.erase(it);
	}
	gs_texture_t *texture = create_mask_texture(mask, width, height);
	entries_.insert_or_assign(surface_id, Entry{mask, width, height, texture});
	return texture;
}

void MaskTextures::retain(const std::set<std::string> &surface_ids)
{
	std::erase_if(entries_, [&](const auto &item) {
		if (surface_ids.contains(item.first))
			return false;
		gs_texture_destroy(item.second.texture);
		return true;
	});
}

gs_texture_t *MaskTextures::blank()
{
	if (blank_tried_)
		return blank_;
	blank_tried_ = true;
	const uint8_t white = 0xFF;
	const uint8_t *data = &white;
	blank_ = gs_texture_create(1, 1, GS_R8, 1, &data, 0);
	if (!blank_)
		obs_log(LOG_WARNING, "failed to create the blank mask texture");
	return blank_;
}

void MaskTextures::clear()
{
	for (auto &[id, entry] : entries_)
		gs_texture_destroy(entry.texture);
	entries_.clear();
	if (blank_)
		gs_texture_destroy(blank_);
	blank_ = nullptr;
	blank_tried_ = false;
}
