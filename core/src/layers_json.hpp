#pragma once

#include "surface-mapper/model.hpp"

#include <nlohmann/json.hpp>

#include <set>
#include <string>
#include <vector>

namespace surface_mapper::detail {

constexpr int kMaxTreeDepth = 16;

// `ids` already holds the surface ids; group ids are added so both share one namespace.
std::vector<Group> parse_groups(const nlohmann::json &groups, std::set<std::string> &ids);
// `m.surfaces` and `m.groups` must already be parsed.
std::vector<LayerNode> parse_layers(const nlohmann::json &layers, const Mapping &m);
void check_surface_order(const Mapping &m);
std::vector<LayerNode> flat_layers(const std::vector<Surface> &surfaces);
nlohmann::ordered_json groups_to_json(const std::vector<Group> &groups);
nlohmann::ordered_json layers_to_json(const std::vector<LayerNode> &layers);

} // namespace surface_mapper::detail
