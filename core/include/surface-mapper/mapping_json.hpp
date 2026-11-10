#pragma once

#include "model.hpp"

#include <cstdint>
#include <expected>
#include <string>
#include <string_view>

namespace surface_mapper {

struct ParseError {
	std::string message;
};

std::expected<Mapping, ParseError> parse_mapping(std::string_view json);
std::string serialize_mapping(const Mapping &);
Mapping default_mapping(uint32_t width, uint32_t height); // grid 20, no surfaces
// Returns true if at least one surface was changed.
bool rename_source(Mapping &, std::string_view from, std::string_view to);

} // namespace surface_mapper
