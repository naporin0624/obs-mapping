#pragma once

#include <vector>

#include "obs-mapping/model.hpp"

namespace obs_mapping {

// Parallel to m.surfaces: the surface is visible and every ancestor group is visible.
std::vector<bool> effective_visibility(const Mapping &m);

} // namespace obs_mapping
