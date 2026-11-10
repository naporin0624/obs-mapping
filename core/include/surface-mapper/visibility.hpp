#pragma once

#include <vector>

#include "surface-mapper/model.hpp"

namespace surface_mapper {

// Parallel to m.surfaces: the surface is visible and every ancestor group is visible.
std::vector<bool> effective_visibility(const Mapping &m);

} // namespace surface_mapper
