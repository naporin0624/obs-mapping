#pragma once

#include "mapping_json.hpp"

#include <expected>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace obs_mapping {

struct Selection {
	std::vector<std::string> surface_ids;
	std::optional<std::pair<std::string, int>> corner; // (surface id, 0..3)
};

// Parses {"selectedSurfaceIds": string[], "selectedCorner": {"surfaceId": string, "index": 0..3} | null}.
// Both keys are optional. Errors read "selectionJson: <reason>".
std::expected<Selection, ParseError> parse_selection(std::string_view json);

} // namespace obs_mapping
