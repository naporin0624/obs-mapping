#include <doctest/doctest.h>

#include "obs-mapping/mapping_json.hpp"

#include <string>

using namespace obs_mapping;

namespace {

const char *kValid = R"({
  "version": 1,
  "canvas": { "width": 1920, "height": 1080 },
  "grid": { "size": 20 },
  "surfaces": [
    {
      "id": "s-1", "name": "左壁", "type": "quad", "source": "VJ A",
      "crop": { "x": 0, "y": 0, "width": 1, "height": 1 },
      "corners": [[100, 100], [900, 120], [880, 700], [120, 680]],
      "visible": true
    },
    {
      "id": "s-2", "name": "右壁", "type": "quad", "source": "VJ A",
      "crop": { "x": 0.25, "y": 0, "width": 0.5, "height": 1 },
      "corners": [[1000, 100], [1800, 120], [1780, 700], [1020, 680]]
    }
  ]
})";

const char *kValidV2 = R"({
  "version": 2,
  "canvas": { "width": 1920, "height": 1080 },
  "grid": { "size": 20 },
  "surfaces": [
    {
      "id": "s-1", "name": "左壁", "type": "quad", "source": "VJ A",
      "crop": { "x": 0, "y": 0, "width": 1, "height": 1 },
      "corners": [[100, 100], [900, 120], [880, 700], [120, 680]],
      "visible": true
    },
    {
      "id": "s-2", "name": "右壁", "type": "quad", "source": "VJ A",
      "crop": { "x": 0.25, "y": 0, "width": 0.5, "height": 1 },
      "corners": [[1000, 100], [1800, 120], [1780, 700], [1020, 680]]
    }
  ],
  "groups": [
    { "id": "g-1", "name": "列", "visible": true, "origin": [100, 100],
      "layout": { "direction": "row", "gap": 20, "align": "start", "padding": 0 } }
  ],
  "layers": [
    { "group": "g-1", "children": [ { "surface": "s-1" } ] },
    { "surface": "s-2" }
  ]
})";

std::string error_of(const std::string &json)
{
	auto r = parse_mapping(json);
	REQUIRE_FALSE(r.has_value());
	return r.error().message;
}

std::string replace(std::string s, const std::string &a, const std::string &b)
{
	auto pos = s.find(a);
	REQUIRE(pos != std::string::npos);
	return s.replace(pos, a.size(), b);
}

bool starts_with(const std::string &s, const std::string &p)
{
	return s.rfind(p, 0) == 0;
}

} // namespace

TEST_CASE("round_trip")
{
	auto a = parse_mapping(kValid);
	REQUIRE(a.has_value());
	CHECK(a->surfaces.size() == 2);
	CHECK(a->surfaces[0].corners[1] == Point{900, 120});
	std::string out = serialize_mapping(*a);
	auto b = parse_mapping(out);
	REQUIRE(b.has_value());
	CHECK(*a == *b);
	CHECK(serialize_mapping(*b) == out);
}

TEST_CASE("defaults")
{
	auto r = parse_mapping(kValid);
	REQUIRE(r.has_value());
	CHECK(r->surfaces[1].visible == true);
	auto d = default_mapping(1280, 720);
	CHECK(d.grid_size == 20);
	CHECK(d.surfaces.empty());
	CHECK(parse_mapping(serialize_mapping(d)).has_value());
}

TEST_CASE("unknown_fields_ignored")
{
	std::string j = replace(kValid, "\"version\": 1,", "\"version\": 1, \"foo\": 1,");
	j = replace(j, "\"id\": \"s-1\",", "\"id\": \"s-1\", \"foo\": 1,");
	CHECK(parse_mapping(j).has_value());
}

TEST_CASE("validation errors")
{
	CHECK(starts_with(error_of(replace(kValid, "\"version\": 1", "\"version\": 3")),
			  "version: unsupported version 3"));
	CHECK(starts_with(error_of(replace(kValid, "\"width\": 1920", "\"width\": 0")), "canvas.width: "));
	CHECK(starts_with(error_of(replace(kValid, "\"width\": 1920", "\"width\": 1920.5")), "canvas.width: "));
	CHECK(starts_with(error_of(replace(kValid, "\"height\": 1080", "\"height\": 16385")), "canvas.height: "));
	CHECK(starts_with(error_of(replace(kValid, "\"size\": 20", "\"size\": 0")), "grid.size: "));
	CHECK(starts_with(error_of(replace(kValid, "\"size\": 20", "\"size\": 1025")), "grid.size: "));
	CHECK(parse_mapping(replace(kValid, "\"size\": 20", "\"size\": 12.5")).has_value());
	CHECK(starts_with(error_of(replace(kValid, "\"id\": \"s-2\"", "\"id\": \"s-1\"")),
			  "surfaces[1].id: duplicate id \"s-1\""));
	CHECK(starts_with(error_of(replace(kValid, "\"id\": \"s-1\"", "\"id\": \"\"")), "surfaces[0].id: "));
	CHECK(starts_with(
		error_of(replace(kValid, "\"x\": 0, \"y\": 0, \"width\": 1,", "\"x\": 0.2, \"y\": 0, \"width\": 1,")),
		"surfaces[0].crop: "));
	CHECK(starts_with(error_of(replace(kValid, "\"width\": 1, \"height\": 1 }", "\"width\": 0, \"height\": 1 }")),
			  "surfaces[0].crop: "));
	CHECK(starts_with(error_of(replace(kValid, ", [120, 680]]", "]")), "surfaces[0].corners: expected 4 points"));
	CHECK(starts_with(error_of(replace(kValid, "[880, 700]", "null")), "surfaces[0].corners[2]: "));
	CHECK(starts_with(
		error_of(replace(kValid,
				 "\"type\": \"quad\", \"source\": \"VJ A\",\n      \"crop\": { \"x\": 0, \"y\": 0",
				 "\"type\": \"mesh\", \"source\": \"VJ A\",\n      \"crop\": { \"x\": 0, \"y\": 0")),
		"surfaces[0].type: unknown type \"mesh\""));
	CHECK(starts_with(error_of(replace(kValid, "\"visible\": true", "\"visible\": 1")), "surfaces[0].visible: "));
	CHECK(starts_with(error_of("{ not json"), "json: "));
}

TEST_CASE("empty source allowed")
{
	CHECK(parse_mapping(replace(kValid, "\"source\": \"VJ A\"", "\"source\": \"\"")).has_value());
}

TEST_CASE("rename_source_updates_all")
{
	auto m = parse_mapping(kValid);
	REQUIRE(m.has_value());
	CHECK(rename_source(*m, "VJ A", "VJ B"));
	CHECK(m->surfaces[0].source == "VJ B");
	CHECK(m->surfaces[1].source == "VJ B");
	CHECK_FALSE(rename_source(*m, "nope", "x"));
}

TEST_CASE("serialize survives invalid UTF-8 in a source name")
{
	auto m = parse_mapping(kValid);
	REQUIRE(m.has_value());
	CHECK(rename_source(*m, "VJ A", std::string("bad\xff\xfe name")));
	std::string text;
	CHECK_NOTHROW(text = serialize_mapping(*m));
	CHECK(parse_mapping(text).has_value());
}

namespace {

std::string nested_chain(int groups)
{
	std::string defs;
	std::string open;
	std::string close;
	for (int i = 1; i <= groups; ++i) {
		defs += std::string(i > 1 ? "," : "") + "{ \"id\": \"n-" + std::to_string(i) +
			"\", \"name\": \"n\", \"origin\": [0, 0], \"layout\": { \"direction\": \"row\", "
			"\"gap\": 0, \"align\": \"start\", \"padding\": 0 } }";
		open += "{ \"group\": \"n-" + std::to_string(i) + "\", \"children\": [";
		close += "] }";
	}
	std::string j = replace(kValidV2, "\"groups\": [", "\"groups\": [" + defs + ",");
	return replace(j, "\"layers\": [", "\"layers\": [" + open + close + ",");
}

std::string child_path(int levels)
{
	std::string p = "layers[0]";
	for (int i = 1; i < levels; ++i)
		p += ".children[0]";
	return p;
}

} // namespace

TEST_CASE("v1 reads as flat v2")
{
	auto m = parse_mapping(kValid);
	REQUIRE(m.has_value());
	CHECK(m->version == 2);
	CHECK(m->groups.empty());
	REQUIRE(m->layers.size() == 2);
	CHECK(m->layers[0] == LayerNode{LayerNode::Kind::Surface, "s-1", {}});
	CHECK(serialize_mapping(*m).find("\"version\": 2") != std::string::npos);
}

TEST_CASE("v2 round_trip")
{
	auto a = parse_mapping(kValidV2);
	REQUIRE(a.has_value());
	REQUIRE(a->groups.size() == 1);
	CHECK(a->groups[0].layout.gap == 20);
	CHECK(a->layers[0].children[0].id == "s-1");
	std::string out = serialize_mapping(*a);
	auto b = parse_mapping(out);
	REQUIRE(b.has_value());
	CHECK(*a == *b);
	CHECK(serialize_mapping(*b) == out);
}

TEST_CASE("v2 group defaults")
{
	auto m = parse_mapping(replace(kValidV2, "\"visible\": true, \"origin\"", "\"origin\""));
	REQUIRE(m.has_value());
	CHECK(m->groups[0].visible == true);
}

TEST_CASE("v2 empty group allowed")
{
	auto j = replace(
		kValidV2,
		"{ \"group\": \"g-1\", \"children\": [ { \"surface\": \"s-1\" } ] },\n    { \"surface\": \"s-2\" }",
		"{ \"group\": \"g-1\", \"children\": [] },\n    { \"surface\": \"s-1\" }, { \"surface\": \"s-2\" }");
	auto m = parse_mapping(j);
	REQUIRE(m.has_value());
	CHECK(m->layers[0].children.empty());
}

TEST_CASE("v2 validation errors")
{
	const auto bad = [](const std::string &a, const std::string &b) {
		return error_of(replace(kValidV2, a, b));
	};
	CHECK(starts_with(bad("\"groups\"", "\"gruops\""), "groups: missing"));
	CHECK(starts_with(bad("\"layers\"", "\"layres\""), "layers: missing"));
	CHECK(starts_with(bad("\"id\": \"g-1\"", "\"id\": \"s-1\""), "groups[0].id: duplicate id \"s-1\""));
	CHECK(starts_with(bad("\"gap\": 20", "\"gap\": -1"), "groups[0].layout.gap: must be between 0 and 4096"));
	CHECK(starts_with(bad("\"gap\": 20", "\"gap\": 4097"), "groups[0].layout.gap: must be between 0 and 4096"));
	CHECK(starts_with(bad("\"padding\": 0", "\"padding\": -1"),
			  "groups[0].layout.padding: must be between 0 and 4096"));
	CHECK(starts_with(bad("\"padding\": 0", "\"padding\": 4097"),
			  "groups[0].layout.padding: must be between 0 and 4096"));
	CHECK(starts_with(bad("\"row\"", "\"wrap\""), "groups[0].layout.direction: unknown direction \"wrap\""));
	CHECK(starts_with(bad("\"start\"", "\"stretch\""), "groups[0].layout.align: unknown align \"stretch\""));
	CHECK(starts_with(bad("[100, 100],\n      \"layout\"", "[100],\n      \"layout\""),
			  "groups[0].origin: expected [x, y]"));
	CHECK(starts_with(bad("{ \"surface\": \"s-2\" }", "{ \"surface\": \"s-2\", \"group\": \"g-1\" }"),
			  "layers[1]: expected exactly one of \"surface\" or \"group\""));
	CHECK(starts_with(bad("{ \"surface\": \"s-2\" }", "{ \"children\": [] }"),
			  "layers[1]: expected exactly one of \"surface\" or \"group\""));
	CHECK(starts_with(bad("{ \"surface\": \"s-2\" }", "{ \"surface\": \"s-9\" }"),
			  "layers[1].surface: unknown surface \"s-9\""));
	CHECK(starts_with(bad("\"group\": \"g-1\"", "\"group\": \"g-9\""), "layers[0].group: unknown group \"g-9\""));
	CHECK(starts_with(bad("{ \"surface\": \"s-2\" }", "{ \"surface\": \"s-1\" }"),
			  "layers[1].surface: surface \"s-1\" appears more than once"));
	CHECK(starts_with(bad("\"children\": [ { \"surface\": \"s-1\" } ]", "\"children\": {}"),
			  "layers[0].children: expected array"));
	CHECK(starts_with(bad(",\n    { \"surface\": \"s-2\" }", ""),
			  "layers: surface \"s-2\" is missing from the tree"));
	CHECK(starts_with(bad("{ \"group\": \"g-1\", \"children\": [ { \"surface\": \"s-1\" } ] },", ""),
			  "layers: surface \"s-1\" is missing from the tree"));
	CHECK(starts_with(bad("\"version\": 2", "\"version\": 3"), "version: unsupported version 3"));
	CHECK(starts_with(bad("\"groups\": [", "\"groups\": {}, \"x\": ["), "groups: expected array"));
	CHECK(starts_with(bad("\"layers\": [", "\"layers\": {}, \"x\": ["), "layers: expected array"));
	CHECK(starts_with(bad("\"visible\": true, \"origin\"", "\"visible\": 1, \"origin\""),
			  "groups[0].visible: expected boolean"));
	CHECK(starts_with(
		bad("\"layout\": { \"direction\": \"row\", \"gap\": 20, \"align\": \"start\", \"padding\": 0 }",
		    "\"layout\": []"),
		"groups[0].layout: expected object"));
}

TEST_CASE("v2 validation errors on group references")
{
	const auto bad = [](const std::string &a, const std::string &b) {
		return error_of(replace(kValidV2, a, b));
	};
	const std::string second_group =
		"{ \"id\": \"g-1\", \"name\": \"b\", \"origin\": [0, 0], \"layout\": { \"direction\": \"row\", "
		"\"gap\": 0, \"align\": \"start\", \"padding\": 0 } }";
	CHECK(starts_with(bad("\"groups\": [", "\"groups\": [" + second_group + ","),
			  "groups[1].id: duplicate id \"g-1\""));
	CHECK(starts_with(bad("{ \"surface\": \"s-2\" }", "{ \"group\": \"g-1\", \"children\": [] }"),
			  "layers[1].group: group \"g-1\" appears more than once"));
	CHECK(starts_with(bad("{ \"surface\": \"s-2\" }", "{ \"surface\": \"g-1\" }"),
			  "layers[1].surface: unknown surface \"g-1\""));
}

TEST_CASE("v2 spacing bounds are inclusive")
{
	CHECK(parse_mapping(replace(kValidV2, "\"gap\": 20", "\"gap\": 4096")).has_value());
	CHECK(parse_mapping(replace(kValidV2, "\"padding\": 0", "\"padding\": 4096")).has_value());
}

TEST_CASE("v2 unknown fields ignored")
{
	std::string j = replace(kValidV2, "\"version\": 2,", "\"version\": 2, \"foo\": 1,");
	j = replace(j, "\"id\": \"g-1\",", "\"id\": \"g-1\", \"foo\": 1,");
	j = replace(j, "\"direction\": \"row\",", "\"direction\": \"row\", \"foo\": 1,");
	j = replace(j, "{ \"surface\": \"s-2\" }", "{ \"surface\": \"s-2\", \"children\": [], \"foo\": 1 }");
	j = replace(j, "{ \"group\": \"g-1\",", "{ \"group\": \"g-1\", \"collapsed\": true,");
	auto m = parse_mapping(j);
	REQUIRE(m.has_value());
	CHECK(*m == *parse_mapping(kValidV2));
	CHECK(serialize_mapping(*m).find("foo") == std::string::npos);
	CHECK(serialize_mapping(*m).find("collapsed") == std::string::npos);
}

TEST_CASE("v2 group missing from the tree")
{
	auto j = replace(kValidV2, "{ \"group\": \"g-1\", \"children\": [ { \"surface\": \"s-1\" } ] },",
			 "{ \"surface\": \"s-1\" },");
	CHECK(starts_with(error_of(j), "layers: group \"g-1\" is missing from the tree"));
}

TEST_CASE("v2 surface order must follow the tree")
{
	auto j = replace(
		kValidV2,
		"{ \"group\": \"g-1\", \"children\": [ { \"surface\": \"s-1\" } ] },\n    { \"surface\": \"s-2\" }",
		"{ \"surface\": \"s-2\" },\n    { \"group\": \"g-1\", \"children\": [ { \"surface\": \"s-1\" } ] }");
	CHECK(starts_with(error_of(j), "surfaces: order must match the depth-first order of layers"));
}

TEST_CASE("v2 tree depth is limited to 16")
{
	CHECK(parse_mapping(nested_chain(16)).has_value());
	CHECK(starts_with(error_of(nested_chain(17)), child_path(17) + ": depth exceeds 16"));
}

namespace {

std::string with_mask(const std::string &mask)
{
	return replace(kValid, "\"visible\": true", "\"visible\": true, \"mask\": " + mask);
}

std::string points_json(int n)
{
	std::string s = "[";
	for (int i = 0; i < n; ++i)
		s += std::string(i ? "," : "") + "[" + std::to_string(i) + ",0.5]";
	return s + "]";
}

} // namespace

TEST_CASE("mask ellipse round trip")
{
	auto m = parse_mapping(with_mask(R"({"type":"ellipse","x":0.1,"y":-0.2,"width":0.8,"height":1.4})"));
	REQUIRE(m.has_value());
	REQUIRE(m->surfaces[0].mask.has_value());
	const auto &e = std::get<EllipseMask>(*m->surfaces[0].mask);
	CHECK(e.x == 0.1);
	CHECK(e.y == -0.2);
	CHECK(e.width == 0.8);
	CHECK(e.height == 1.4);
	auto b = parse_mapping(serialize_mapping(*m));
	REQUIRE(b.has_value());
	CHECK(*m == *b);
}

TEST_CASE("mask polygon round trip")
{
	auto m = parse_mapping(with_mask(R"({"type":"polygon","points":[[0,0],[1,0],[1.2,1],[-0.1,0.9]]})"));
	REQUIRE(m.has_value());
	const auto &p = std::get<PolygonMask>(*m->surfaces[0].mask);
	REQUIRE(p.points.size() == 4);
	CHECK(p.points[2] == Point{1.2, 1});
	auto b = parse_mapping(serialize_mapping(*m));
	REQUIRE(b.has_value());
	CHECK(*m == *b);
}

TEST_CASE("mask absent is nullopt and not serialized")
{
	auto m = parse_mapping(kValid);
	REQUIRE(m.has_value());
	CHECK(m->surfaces[0].mask == std::nullopt);
	CHECK(serialize_mapping(*m).find("\"mask\"") == std::string::npos);
}

TEST_CASE("mask serialization puts type first")
{
	auto m = parse_mapping(with_mask(R"({"width":1,"type":"ellipse","x":0,"y":0,"height":1})"));
	REQUIRE(m.has_value());
	auto out = serialize_mapping(*m);
	auto mask = out.find("\"mask\"");
	REQUIRE(mask != std::string::npos);
	CHECK(out.find("\"type\"", mask) < out.find("\"x\"", mask));
}

TEST_CASE("mask validation errors carry the path")
{
	const std::string mp = "surfaces[0].mask";
	CHECK(starts_with(error_of(with_mask(R"({"type":"polygon","points":)" + points_json(2) + "}")),
			  mp + ".points"));
	CHECK(parse_mapping(with_mask(R"({"type":"polygon","points":)" + points_json(64) + "}")).has_value());
	CHECK(starts_with(error_of(with_mask(R"({"type":"polygon","points":)" + points_json(65) + "}")),
			  mp + ".points"));
	CHECK(starts_with(error_of(with_mask(R"({"type":"ellipse","x":0,"y":0,"width":0,"height":1})")),
			  mp + ".width"));
	CHECK(starts_with(error_of(with_mask(R"({"type":"ellipse","x":0,"y":0,"width":1,"height":-1})")),
			  mp + ".height"));
	CHECK(starts_with(error_of(with_mask(R"({"type":"star"})")), mp + ".type"));
	CHECK(starts_with(error_of(with_mask(R"({"type":"polygon","points":[[1],[0,0],[1,1]]})")), mp + ".points[0]"));
}
