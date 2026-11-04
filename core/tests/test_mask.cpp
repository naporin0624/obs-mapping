#include <doctest/doctest.h>

#include "obs-mapping/mask.hpp"

#include <cmath>

using namespace obs_mapping;

namespace {

const Mask kStar = PolygonMask{{{0.5, 0}, {0.79, 0.9}, {0.02, 0.35}, {0.98, 0.35}, {0.21, 0.9}}};

} // namespace

TEST_CASE("mask_contains ellipse")
{
	Mask e = EllipseMask{0, 0, 1, 1};
	CHECK(mask_contains(e, {0.5, 0.5}));
	CHECK_FALSE(mask_contains(e, {0.02, 0.02}));
	CHECK_FALSE(mask_contains(e, {1.2, 0.5}));
	Mask wide = EllipseMask{-0.25, 0, 1.5, 1};
	CHECK(mask_contains(wide, {0.02, 0.5}));
}

TEST_CASE("mask_contains polygon is even-odd")
{
	CHECK_FALSE(mask_contains(kStar, {0.5, 0.5}));
	CHECK(mask_contains(kStar, {0.5, 0.1}));
}

TEST_CASE("rasterize_mask ellipse")
{
	auto px = rasterize_mask(EllipseMask{0, 0, 1, 1}, 16, 16);
	REQUIRE(px.size() == 256);
	CHECK(px[8 * 16 + 8] == 255);
	CHECK(px[0] == 0);
	// Row 2 / col 2: the circle boundary crosses this pixel.
	CHECK(px[2 * 16 + 2] > 0);
	CHECK(px[2 * 16 + 2] < 255);
}

TEST_CASE("rasterize_mask full rectangle is all 255")
{
	Mask rect = PolygonMask{{{-0.1, -0.1}, {1.1, -0.1}, {1.1, 1.1}, {-0.1, 1.1}}};
	auto px = rasterize_mask(rect, 4, 4);
	REQUIRE(px.size() == 16);
	for (auto v : px)
		CHECK(v == 255);
}

TEST_CASE("mask_outline")
{
	auto pts = mask_outline(EllipseMask{0, 0, 1, 1}, 32);
	REQUIRE(pts.size() == 32);
	for (const auto &p : pts) {
		double d = (p.x - 0.5) * (p.x - 0.5) / 0.25 + (p.y - 0.5) * (p.y - 0.5) / 0.25;
		CHECK(std::abs(d - 1.0) < 1e-9);
	}
	auto poly = mask_outline(kStar, 32);
	CHECK(poly == std::get<PolygonMask>(kStar).points);
}

namespace {

std::vector<uint8_t> brute_force(const Mask &m, uint32_t w, uint32_t h)
{
	std::vector<uint8_t> out(static_cast<size_t>(w) * h);
	for (uint32_t j = 0; j < h; ++j)
		for (uint32_t i = 0; i < w; ++i) {
			int hits = 0;
			for (int b = 0; b < 4; ++b)
				for (int a = 0; a < 4; ++a)
					hits += mask_contains(m, {(i + (a + 0.5) / 4) / w, (j + (b + 0.5) / 4) / h})
							? 1
							: 0;
			out[static_cast<size_t>(j) * w + i] = static_cast<uint8_t>(hits * 255 / 16);
		}
	return out;
}

} // namespace

TEST_CASE("rasterize_mask matches per-sample mask_contains")
{
	CHECK(rasterize_mask(kStar, 37, 23) == brute_force(kStar, 37, 23));
	Mask wide = EllipseMask{-0.25, 0, 1.5, 1};
	CHECK(rasterize_mask(wide, 37, 23) == brute_force(wide, 37, 23));
}

TEST_CASE("mask_outline with no segments is empty")
{
	CHECK(mask_outline(EllipseMask{0, 0, 1, 1}, 0).empty());
	CHECK(mask_outline(EllipseMask{0, 0, 1, 1}, -3).empty());
}
