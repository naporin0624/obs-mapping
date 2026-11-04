#pragma once

#include <algorithm>
#include <bit>
#include <cmath>
#include <cstdint>
#include <utility>

#include "obs-mapping/model.hpp"

namespace obs_mapping {

inline bool should_draw_surface(const Surface &surface, bool visible, uint32_t src_w, uint32_t src_h,
				bool has_homography)
{
	return visible && !surface.source.empty() && src_w > 0 && src_h > 0 && has_homography;
}

// Width and height of the corners' axis-aligned bounding box, not clipped to the canvas.
inline std::pair<double, double> corner_extent(const Surface &surface)
{
	const auto [min_x, max_x] = std::ranges::minmax(surface.corners, {}, &Point::x);
	const auto [min_y, max_y] = std::ranges::minmax(surface.corners, {}, &Point::y);
	return {max_x.x - min_x.x, max_y.y - min_y.y};
}

namespace detail {
inline uint32_t mask_side(double px)
{
	const double rounded = std::clamp(std::ceil(px), 16.0, 1024.0);
	return std::bit_ceil(static_cast<uint32_t>(rounded));
}
} // namespace detail

// Powers of two keep the size (and the cached texture) stable through small drags.
inline std::pair<uint32_t, uint32_t> mask_texture_size(double box_w, double box_h)
{
	return {detail::mask_side(box_w), detail::mask_side(box_h)};
}

} // namespace obs_mapping
