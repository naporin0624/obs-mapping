#include <doctest/doctest.h>

#include "../../src/overlay-geometry.hpp"

using namespace obs_mapping;

TEST_CASE("dash_segments splits a 100px edge with an 8on/6off pattern")
{
	const auto segs = dash_segments(100, 8, 6);
	REQUIRE(segs.size() == 8);
	CHECK(segs[0] == DashSegment{0, 8});
	CHECK(segs[1] == DashSegment{14, 22});
	CHECK(segs[6] == DashSegment{84, 92});
	CHECK(segs[7] == DashSegment{98, 100});
}

TEST_CASE("dash_segments yields nothing for a zero-length edge")
{
	CHECK(dash_segments(0, 8, 6).empty());
}

TEST_CASE("dash_segments keeps a short edge as one clipped segment")
{
	const auto segs = dash_segments(5, 8, 6);
	REQUIRE(segs.size() == 1);
	CHECK(segs[0] == DashSegment{0, 5});
}

TEST_CASE("line_strip is a strip of the requested thickness around the line")
{
	const auto q = line_strip({0, 0}, {10, 0}, 2);
	REQUIRE(q.has_value());
	CHECK((*q)[0].y == doctest::Approx(1));
	CHECK((*q)[1].y == doctest::Approx(-1));
	CHECK((*q)[2].x == doctest::Approx(10));
	CHECK((*q)[3].y == doctest::Approx(-1));
}

TEST_CASE("line_strip rejects a zero-length line")
{
	CHECK_FALSE(line_strip({3, 3}, {3, 3}, 2).has_value());
}

TEST_CASE("square_strip is centered with the requested side")
{
	const auto q = square_strip({100, 50}, 12);
	CHECK(q[0] == Point{94, 44});
	CHECK(q[3] == Point{106, 56});
}
