#include <doctest/doctest.h>

#include <cmath>

#include "surface-mapper/homography.hpp"

using namespace surface_mapper;

namespace {
using Quad = std::array<Point, 4>;

void check_point(const Point &a, const Point &b)
{
	CHECK(a.x == doctest::Approx(b.x).epsilon(1e-9));
	CHECK(a.y == doctest::Approx(b.y).epsilon(1e-9));
}
} // namespace

TEST_CASE("identity_like")
{
	const Quad q{{{0, 0}, {1, 0}, {1, 1}, {0, 1}}};
	const auto h = unit_square_to_quad(q);
	REQUIRE(h.has_value());
	const Mat3 id{1, 0, 0, 0, 1, 0, 0, 0, 1};
	for (size_t i = 0; i < 9; ++i)
		CHECK(std::abs((*h)[i] - id[i]) < 1e-9);
}

TEST_CASE("maps_corners")
{
	const Quad q{{{10, 20}, {110, 35}, {95, 140}, {-5, 120}}};
	REQUIRE(is_convex_quad(q));
	const auto h = unit_square_to_quad(q);
	REQUIRE(h.has_value());
	const Point sq[4] = {{0, 0}, {1, 0}, {1, 1}, {0, 1}};
	for (int i = 0; i < 4; ++i) {
		const auto p = apply(*h, sq[i]);
		REQUIRE(p.has_value());
		check_point(*p, q[i]);
	}
}

TEST_CASE("projective_center")
{
	const Quad q{{{0, 0}, {4, 0}, {3, 2}, {1, 2}}};
	const auto h = unit_square_to_quad(q);
	REQUIRE(h.has_value());
	const auto p = apply(*h, {0.5, 0.5});
	REQUIRE(p.has_value());
	// Diagonals (0,0)-(3,2) and (4,0)-(1,2) intersect at (2, 4/3).
	check_point(*p, {2.0, 4.0 / 3.0});
	// The affine (bilinear-average) center would be (2, 1): confirm it differs.
	CHECK(std::abs(p->y - 1.0) > 0.1);
}

TEST_CASE("inverse_round_trip")
{
	const Quad q{{{10, 20}, {110, 35}, {95, 140}, {-5, 120}}};
	const auto h = unit_square_to_quad(q);
	REQUIRE(h.has_value());
	const auto inv = invert(*h);
	REQUIRE(inv.has_value());
	const Point pts[] = {{0.3, 0.7}, {0, 0}, {1, 1}, {0.9, 0.1}};
	for (const Point &p : pts) {
		const auto fwd = apply(*h, p);
		REQUIRE(fwd.has_value());
		const auto back = apply(*inv, *fwd);
		REQUIRE(back.has_value());
		check_point(*back, p);
	}
}

TEST_CASE("invert_singular")
{
	const Mat3 zero{};
	CHECK_FALSE(invert(zero).has_value());
}

TEST_CASE("apply_w_zero")
{
	const Mat3 m{1, 0, 0, 0, 1, 0, 1, 0, 0}; // w = x
	CHECK_FALSE(apply(m, {0, 5}).has_value());
}

TEST_CASE("degenerate_collinear")
{
	const Quad q{{{0, 0}, {1, 1}, {2, 2}, {0, 5}}};
	CHECK_FALSE(unit_square_to_quad(q).has_value());
	const Quad q2{{{0, 0}, {1, 0}, {2, 0}, {3, 0}}};
	CHECK_FALSE(unit_square_to_quad(q2).has_value());
	const Quad q3{{{0, 5}, {0, 0}, {1, 1}, {2, 2}}};
	CHECK_FALSE(unit_square_to_quad(q3).has_value());
}

TEST_CASE("degenerate_same_point")
{
	const Quad q{{{3, 3}, {3, 3}, {3, 3}, {3, 3}}};
	CHECK_FALSE(unit_square_to_quad(q).has_value());
}

TEST_CASE("convexity")
{
	CHECK(is_convex_quad({{{0, 0}, {4, 0}, {4, 4}, {0, 4}}}));
	CHECK(is_convex_quad({{{0, 0}, {0, 4}, {4, 4}, {4, 0}}}));       // opposite winding
	CHECK_FALSE(is_convex_quad({{{0, 0}, {4, 0}, {4, 4}, {3, 1}}})); // concave
	CHECK_FALSE(is_convex_quad({{{0, 0}, {4, 4}, {4, 0}, {0, 4}}})); // twisted
	CHECK_FALSE(is_convex_quad({{{0, 0}, {1, 1}, {2, 2}, {3, 3}}})); // degenerate
}
