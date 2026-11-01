#include <doctest/doctest.h>

#include "obs-mapping/selection.hpp"

using namespace obs_mapping;

TEST_CASE("parse_selection reads ids and a corner")
{
	auto s = parse_selection(R"({"selectedSurfaceIds":["a","b"],"selectedCorner":{"surfaceId":"a","index":2}})");
	REQUIRE(s.has_value());
	CHECK(s->surface_ids == std::vector<std::string>{"a", "b"});
	REQUIRE(s->corner.has_value());
	CHECK(s->corner->first == "a");
	CHECK(s->corner->second == 2);
}

TEST_CASE("parse_selection accepts a null corner and missing keys")
{
	auto a = parse_selection(R"({"selectedSurfaceIds":[],"selectedCorner":null})");
	REQUIRE(a.has_value());
	CHECK(a->surface_ids.empty());
	CHECK_FALSE(a->corner.has_value());
	auto b = parse_selection("{}");
	REQUIRE(b.has_value());
	CHECK_FALSE(b->corner.has_value());
}

TEST_CASE("parse_selection rejects corner index 4")
{
	auto s = parse_selection(R"({"selectedCorner":{"surfaceId":"a","index":4}})");
	REQUIRE_FALSE(s.has_value());
	CHECK(s.error().message == "selectionJson: selectedCorner.index: expected 0..3");
}

TEST_CASE("parse_selection rejects malformed input")
{
	CHECK(parse_selection("{oops").error().message == "selectionJson: not valid JSON");
	CHECK(parse_selection("[1]").error().message == "selectionJson: expected object");
	CHECK_FALSE(parse_selection(R"({"selectedSurfaceIds":[1]})").has_value());
	CHECK_FALSE(parse_selection(R"({"selectedCorner":{"index":1}})").has_value());
}
