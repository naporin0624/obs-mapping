#include "surface-mapper/selection.hpp"

#include <nlohmann/json.hpp>

namespace surface_mapper {

using nlohmann::json;

namespace {

std::unexpected<ParseError> fail(const std::string &reason)
{
	return std::unexpected(ParseError{"selectionJson: " + reason});
}

} // namespace

std::expected<Selection, ParseError> parse_selection(std::string_view text)
{
	json doc = json::parse(text, nullptr, false);
	if (doc.is_discarded())
		return fail("not valid JSON");
	if (!doc.is_object())
		return fail("expected object");

	Selection out;
	if (auto it = doc.find("selectedSurfaceIds"); it != doc.end()) {
		if (!it->is_array())
			return fail("selectedSurfaceIds: expected array");
		for (const json &id : *it) {
			if (!id.is_string())
				return fail("selectedSurfaceIds: expected strings");
			out.surface_ids.push_back(id.get<std::string>());
		}
	}
	if (auto it = doc.find("selectedCorner"); it != doc.end() && !it->is_null()) {
		if (!it->is_object())
			return fail("selectedCorner: expected object or null");
		auto sid = it->find("surfaceId");
		auto idx = it->find("index");
		if (sid == it->end() || !sid->is_string())
			return fail("selectedCorner.surfaceId: expected string");
		if (idx == it->end() || !idx->is_number_integer())
			return fail("selectedCorner.index: expected integer");
		const auto index = idx->get<long long>();
		if (index < 0 || index > 3)
			return fail("selectedCorner.index: expected 0..3");
		out.corner.emplace(sid->get<std::string>(), static_cast<int>(index));
	}
	return out;
}

} // namespace surface_mapper
