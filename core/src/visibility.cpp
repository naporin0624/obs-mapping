#include "surface-mapper/visibility.hpp"

#include <string>
#include <unordered_map>

namespace surface_mapper {

namespace {

using VisibleById = std::unordered_map<std::string, bool>;

void walk(const std::vector<LayerNode> &nodes, bool ancestors_visible, const VisibleById &own, VisibleById &out)
{
	for (const LayerNode &n : nodes) {
		const auto it = own.find(n.id);
		const bool visible = ancestors_visible && it != own.end() && it->second;
		if (n.kind == LayerNode::Kind::Surface)
			out[n.id] = visible;
		else
			walk(n.children, visible, own, out);
	}
}

VisibleById own_flags(const Mapping &m)
{
	VisibleById own;
	for (const Surface &s : m.surfaces)
		own[s.id] = s.visible;
	for (const Group &g : m.groups)
		own[g.id] = g.visible;
	return own;
}

} // namespace

std::vector<bool> effective_visibility(const Mapping &m)
{
	VisibleById resolved;
	walk(m.layers, true, own_flags(m), resolved);
	std::vector<bool> out;
	out.reserve(m.surfaces.size());
	for (const Surface &s : m.surfaces) {
		const auto it = resolved.find(s.id);
		out.push_back(it != resolved.end() && it->second);
	}
	return out;
}

} // namespace surface_mapper
