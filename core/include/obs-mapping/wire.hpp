#pragma once

#include <string>
#include <string_view>

namespace obs_mapping {

// obs-websocket carries vendor payloads as obs_data, which cannot hold arrays of arrays
// (libobs drops array items that are not objects). On the wire, `corners` is therefore
// [{"x":..,"y":..}, ...] instead of JSON v1's [[x, y], ...]. These convert between the two.
// Anything that does not have the expected shape is passed through unchanged so that
// parse_mapping reports the real problem.
std::string mapping_json_to_wire(std::string_view mapping_json);
std::string wire_to_mapping_json(std::string_view wire_json);

} // namespace obs_mapping
