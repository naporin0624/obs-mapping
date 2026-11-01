#include "obs-mapping/wire.hpp"

#include <nlohmann/json.hpp>

namespace obs_mapping {

using nlohmann::ordered_json;

namespace {

// Applies `convert` to every surface's `corners` array. Returns the input text when it is not JSON.
template <typename Convert>
std::string convert_corners(std::string_view text, Convert convert)
{
	ordered_json doc = ordered_json::parse(text, nullptr, false);
	if (doc.is_discarded() || !doc.is_object())
		return std::string(text);
	auto surfaces = doc.find("surfaces");
	if (surfaces == doc.end() || !surfaces->is_array())
		return std::string(text);
	for (ordered_json &surface : *surfaces) {
		if (!surface.is_object())
			continue;
		auto corners = surface.find("corners");
		if (corners != surface.end() && corners->is_array())
			convert(*corners);
	}
	return doc.dump(2);
}

} // namespace

std::string mapping_json_to_wire(std::string_view mapping_json)
{
	return convert_corners(mapping_json, [](ordered_json &corners) {
		for (ordered_json &pt : corners) {
			if (pt.is_array() && pt.size() == 2)
				pt = ordered_json{{"x", pt[0]}, {"y", pt[1]}};
		}
	});
}

std::string wire_to_mapping_json(std::string_view wire_json)
{
	return convert_corners(wire_json, [](ordered_json &corners) {
		for (ordered_json &pt : corners) {
			if (pt.is_object() && pt.size() == 2 && pt.contains("x") && pt.contains("y"))
				pt = ordered_json::array({pt["x"], pt["y"]});
		}
	});
}

} // namespace obs_mapping
