#pragma once

#include <cstdint>

#include "obs-mapping/model.hpp"

namespace obs_mapping {

inline bool should_draw_surface(const Surface &surface, uint32_t src_w, uint32_t src_h, bool has_homography)
{
	return surface.visible && !surface.source.empty() && src_w > 0 && src_h > 0 && has_homography;
}

} // namespace obs_mapping
