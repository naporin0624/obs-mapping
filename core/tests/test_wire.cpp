#include <doctest/doctest.h>

#include "obs-mapping/mapping_json.hpp"
#include "obs-mapping/wire.hpp"

#include <string>

using namespace obs_mapping;

namespace {

Mapping sample()
{
	Mapping m = default_mapping(1920, 1080);
	Surface s;
	s.id = "s1";
	s.name = "Surface 1";
	s.source = "checker";
	s.corners = {Point{100, 100}, Point{1700, 50.5}, Point{1300, 1000}, Point{300, 900}};
	m.surfaces.push_back(s);
	return m;
}

} // namespace

TEST_CASE("wire form carries corners as {x, y} objects")
{
	const std::string wire = mapping_json_to_wire(serialize_mapping(sample()));
	CHECK(wire.find("\"x\": 1700") != std::string::npos);
	CHECK(wire.find("[100") == std::string::npos);
}

TEST_CASE("wire round trip yields the same mapping")
{
	const Mapping m = sample();
	const std::string back = wire_to_mapping_json(mapping_json_to_wire(serialize_mapping(m)));
	auto parsed = parse_mapping(back);
	REQUIRE(parsed.has_value());
	CHECK(*parsed == m);
}

TEST_CASE("a wire mapping with 3 corners is reported by parse_mapping")
{
	const std::string wire = R"({"version":1,"canvas":{"width":1920,"height":1080},"grid":{"size":20},
"surfaces":[{"id":"a","name":"a","type":"quad","source":"","crop":{"x":0,"y":0,"width":1,"height":1},
"corners":[{"x":0,"y":0},{"x":1,"y":0},{"x":1,"y":1}],"visible":true}]})";
	auto parsed = parse_mapping(wire_to_mapping_json(wire));
	REQUIRE_FALSE(parsed.has_value());
	CHECK(parsed.error().message.find("surfaces[0].corners") != std::string::npos);
}

TEST_CASE("unexpected shapes pass through unchanged")
{
	CHECK(wire_to_mapping_json("not json") == "not json");
	CHECK(wire_to_mapping_json("[1,2]") == "[1,2]");
	CHECK(wire_to_mapping_json(R"({"surfaces":3})") == R"({"surfaces":3})");
}
