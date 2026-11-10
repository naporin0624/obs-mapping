#pragma once

#include "surface-mapper/model.hpp"

#include <cstdint>
#include <vector>

namespace surface_mapper {

bool mask_contains(const Mask &m, Point unit);
std::vector<uint8_t> rasterize_mask(const Mask &m, uint32_t width, uint32_t height);
std::vector<Point> mask_outline(const Mask &m, int ellipse_segments);

} // namespace surface_mapper
