#pragma once

#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "obs-mapping/model.hpp"

struct OverlayState {
	bool enabled = false;
	std::vector<std::string> selected_surface_ids;
	std::optional<std::pair<std::string, int>> selected_corner; // (surface id, 0..3)
};

// Draws the grid, surface outlines and corner handles in canvas px. Graphics thread only.
void draw_overlay(const obs_mapping::Mapping &mapping, const OverlayState &state);
