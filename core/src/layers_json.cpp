#include "layers_json.hpp"

#include "json_read.hpp"

#include <algorithm>

namespace surface_mapper::detail {

using nlohmann::ordered_json;

namespace {

constexpr int kMaxSpacing = 4096;

std::string index_path(const std::string &base, const char *key, size_t i)
{
	return (base.empty() ? std::string(key) : base + "." + key) + "[" + std::to_string(i) + "]";
}

double spacing(const json &layout, const char *key, const std::string &path)
{
	const std::string p = join(path, key);
	const double v = number(require(layout, key, path), p);
	if (v < 0 || v > kMaxSpacing)
		fail(p, "must be between 0 and " + std::to_string(kMaxSpacing));
	return v;
}

Direction parse_direction(const json &layout, const std::string &path)
{
	const std::string p = join(path, "direction");
	const std::string v = str(require(layout, "direction", path), p);
	if (v == "row")
		return Direction::Row;
	if (v == "column")
		return Direction::Column;
	fail(p, "unknown direction \"" + v + "\"");
}

Align parse_align(const json &layout, const std::string &path)
{
	const std::string p = join(path, "align");
	const std::string v = str(require(layout, "align", path), p);
	if (v == "start")
		return Align::Start;
	if (v == "center")
		return Align::Center;
	if (v == "end")
		return Align::End;
	fail(p, "unknown align \"" + v + "\"");
}

Layout parse_layout(const json &g, const std::string &path)
{
	const std::string p = join(path, "layout");
	const json &l = require(g, "layout", path);
	if (!l.is_object())
		fail(p, "expected object");
	Layout out;
	out.direction = parse_direction(l, p);
	out.gap = spacing(l, "gap", p);
	out.align = parse_align(l, p);
	out.padding = spacing(l, "padding", p);
	return out;
}

Point parse_origin(const json &g, const std::string &path)
{
	const std::string p = join(path, "origin");
	const json &o = require(g, "origin", path);
	if (!o.is_array() || o.size() != 2)
		fail(p, "expected [x, y]");
	return {number(o[0], p + "[0]"), number(o[1], p + "[1]")};
}

Group parse_group(const json &g, size_t i, std::set<std::string> &ids)
{
	const std::string p = index_path("", "groups", i);
	if (!g.is_object())
		fail(p, "expected object");
	Group out;
	out.id = str(require(g, "id", p), p + ".id");
	if (out.id.empty())
		fail(p + ".id", "must not be empty");
	if (!ids.insert(out.id).second)
		fail(p + ".id", "duplicate id \"" + out.id + "\"");
	out.name = str(require(g, "name", p), p + ".name");
	if (auto it = g.find("visible"); it != g.end()) {
		if (!it->is_boolean())
			fail(p + ".visible", "expected boolean");
		out.visible = it->get<bool>();
	}
	out.origin = parse_origin(g, p);
	out.layout = parse_layout(g, p);
	return out;
}

struct TreeContext {
	std::set<std::string> surfaces, groups;
	std::set<std::string> seen;
};

LayerNode parse_node(const json &node, const std::string &path, int depth, TreeContext &ctx);

std::vector<LayerNode> parse_children(const json &node, const std::string &path, int depth, TreeContext &ctx)
{
	const json &children = require(node, "children", path);
	if (!children.is_array())
		fail(join(path, "children"), "expected array");
	std::vector<LayerNode> out;
	for (size_t i = 0; i < children.size(); ++i)
		out.push_back(parse_node(children[i], index_path(path, "children", i), depth + 1, ctx));
	return out;
}

LayerNode parse_node(const json &node, const std::string &path, int depth, TreeContext &ctx)
{
	if (!node.is_object())
		fail(path, "expected object");
	if (depth > kMaxTreeDepth)
		fail(path, "depth exceeds " + std::to_string(kMaxTreeDepth));
	const bool is_surface = node.contains("surface");
	if (is_surface == node.contains("group"))
		fail(path, "expected exactly one of \"surface\" or \"group\"");

	LayerNode out;
	out.kind = is_surface ? LayerNode::Kind::Surface : LayerNode::Kind::Group;
	const char *key = is_surface ? "surface" : "group";
	const auto &known = is_surface ? ctx.surfaces : ctx.groups;
	out.id = str(node.at(key), join(path, key));
	if (!known.contains(out.id))
		fail(join(path, key), std::string("unknown ") + key + " \"" + out.id + "\"");
	if (!ctx.seen.insert(out.id).second)
		fail(join(path, key), std::string(key) + " \"" + out.id + "\" appears more than once");
	if (!is_surface)
		out.children = parse_children(node, path, depth, ctx);
	return out;
}

TreeContext context_of(const Mapping &m)
{
	TreeContext ctx;
	for (const Surface &s : m.surfaces)
		ctx.surfaces.insert(s.id);
	for (const Group &g : m.groups)
		ctx.groups.insert(g.id);
	return ctx;
}

void require_all_in_tree(const Mapping &m, const TreeContext &ctx)
{
	for (const Surface &s : m.surfaces) {
		if (!ctx.seen.contains(s.id))
			fail("layers", "surface \"" + s.id + "\" is missing from the tree");
	}
	for (const Group &g : m.groups) {
		if (!ctx.seen.contains(g.id))
			fail("layers", "group \"" + g.id + "\" is missing from the tree");
	}
}

void collect_surface_ids(const std::vector<LayerNode> &nodes, std::vector<std::string> &out)
{
	for (const LayerNode &n : nodes) {
		if (n.kind == LayerNode::Kind::Surface)
			out.push_back(n.id);
		else
			collect_surface_ids(n.children, out);
	}
}

ordered_json layer_to_json(const LayerNode &n)
{
	ordered_json o = ordered_json::object();
	if (n.kind == LayerNode::Kind::Surface) {
		o["surface"] = n.id;
		return o;
	}
	o["group"] = n.id;
	o["children"] = layers_to_json(n.children);
	return o;
}

const char *direction_name(Direction d)
{
	return d == Direction::Row ? "row" : "column";
}

const char *align_name(Align a)
{
	switch (a) {
	case Align::Start:
		return "start";
	case Align::Center:
		return "center";
	case Align::End:
		return "end";
	}
	return "start";
}

} // namespace

std::vector<Group> parse_groups(const json &groups, std::set<std::string> &ids)
{
	if (!groups.is_array())
		fail("groups", "expected array");
	std::vector<Group> out;
	for (size_t i = 0; i < groups.size(); ++i)
		out.push_back(parse_group(groups[i], i, ids));
	return out;
}

std::vector<LayerNode> parse_layers(const json &layers, const Mapping &m)
{
	if (!layers.is_array())
		fail("layers", "expected array");
	TreeContext ctx = context_of(m);
	std::vector<LayerNode> out;
	for (size_t i = 0; i < layers.size(); ++i)
		out.push_back(parse_node(layers[i], index_path("", "layers", i), 1, ctx));
	require_all_in_tree(m, ctx);
	return out;
}

void check_surface_order(const Mapping &m)
{
	std::vector<std::string> in_tree;
	collect_surface_ids(m.layers, in_tree);
	const bool same = std::ranges::equal(in_tree, m.surfaces, {}, {}, &Surface::id);
	if (!same)
		fail("surfaces", "order must match the depth-first order of layers");
}

std::vector<LayerNode> flat_layers(const std::vector<Surface> &surfaces)
{
	std::vector<LayerNode> out;
	out.reserve(surfaces.size());
	for (const Surface &s : surfaces)
		out.push_back({LayerNode::Kind::Surface, s.id, {}});
	return out;
}

ordered_json groups_to_json(const std::vector<Group> &groups)
{
	ordered_json arr = ordered_json::array();
	for (const Group &g : groups) {
		ordered_json o = ordered_json::object();
		o["id"] = g.id;
		o["name"] = g.name;
		o["visible"] = g.visible;
		o["origin"] = ordered_json::array({g.origin.x, g.origin.y});
		o["layout"] = {{"direction", direction_name(g.layout.direction)},
			       {"gap", g.layout.gap},
			       {"align", align_name(g.layout.align)},
			       {"padding", g.layout.padding}};
		arr.push_back(o);
	}
	return arr;
}

ordered_json layers_to_json(const std::vector<LayerNode> &layers)
{
	ordered_json arr = ordered_json::array();
	for (const LayerNode &n : layers)
		arr.push_back(layer_to_json(n));
	return arr;
}

} // namespace surface_mapper::detail
