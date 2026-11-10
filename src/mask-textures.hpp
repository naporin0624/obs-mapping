#pragma once

#include <obs-module.h>

#include <cstdint>
#include <map>
#include <set>
#include <string>

#include "surface-mapper/model.hpp"

// Rasterized surface masks as R8 textures, keyed by surface id. Graphics thread only;
// the owner calls clear() inside a graphics context before destruction.
class MaskTextures {
public:
	MaskTextures() = default;
	MaskTextures(const MaskTextures &) = delete;
	MaskTextures &operator=(const MaskTextures &) = delete;

	// Rebuilds only when the mask or the size differs from the cached one; a failed (null) texture is cached too.
	gs_texture_t *get(const std::string &surface_id, const surface_mapper::Mask &mask, uint32_t width,
			  uint32_t height);
	// Destroys every texture whose surface id is not listed.
	void retain(const std::set<std::string> &surface_ids);
	// A 1x1 white R8 texture for unmasked surfaces, created once on first use; null if creation failed.
	gs_texture_t *blank();
	void clear();

private:
	struct Entry {
		surface_mapper::Mask mask;
		uint32_t width = 0;
		uint32_t height = 0;
		gs_texture_t *texture = nullptr;
	};

	std::map<std::string, Entry> entries_;
	gs_texture_t *blank_ = nullptr;
	bool blank_tried_ = false;
};
