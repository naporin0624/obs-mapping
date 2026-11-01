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

bool starts_with(const std::string &s, const std::string &p) { return s.rfind(p, 0) == 0; }

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
	CHECK(starts_with(error_of(replace(kValid, "\"version\": 1", "\"version\": 2")),
			  "version: unsupported version 2"));
	CHECK(starts_with(error_of(replace(kValid, "\"width\": 1920", "\"width\": 0")), "canvas.width: "));
	CHECK(starts_with(error_of(replace(kValid, "\"width\": 1920", "\"width\": 1920.5")), "canvas.width: "));
	CHECK(starts_with(error_of(replace(kValid, "\"height\": 1080", "\"height\": 16385")), "canvas.height: "));
	CHECK(starts_with(error_of(replace(kValid, "\"size\": 20", "\"size\": 0")), "grid.size: "));
	CHECK(starts_with(error_of(replace(kValid, "\"size\": 20", "\"size\": 1025")), "grid.size: "));
	CHECK(parse_mapping(replace(kValid, "\"size\": 20", "\"size\": 12.5")).has_value());
	CHECK(starts_with(error_of(replace(kValid, "\"id\": \"s-2\"", "\"id\": \"s-1\"")),
			  "surfaces[1].id: duplicate id \"s-1\""));
	CHECK(starts_with(error_of(replace(kValid, "\"id\": \"s-1\"", "\"id\": \"\"")), "surfaces[0].id: "));
	CHECK(starts_with(error_of(replace(kValid, "\"x\": 0, \"y\": 0, \"width\": 1,", "\"x\": 0.2, \"y\": 0, \"width\": 1,")),
			  "surfaces[0].crop: "));
	CHECK(starts_with(error_of(replace(kValid, "\"width\": 1, \"height\": 1 }", "\"width\": 0, \"height\": 1 }")),
			  "surfaces[0].crop: "));
	CHECK(starts_with(error_of(replace(kValid, ", [120, 680]]", "]")), "surfaces[0].corners: expected 4 points"));
	CHECK(starts_with(error_of(replace(kValid, "[880, 700]", "null")), "surfaces[0].corners[2]: "));
	CHECK(starts_with(error_of(replace(kValid, "\"type\": \"quad\", \"source\": \"VJ A\",\n      \"crop\": { \"x\": 0, \"y\": 0",
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
