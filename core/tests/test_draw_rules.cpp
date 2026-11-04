#include <doctest/doctest.h>

#include "../../src/draw-rules.hpp"

using namespace obs_mapping;

namespace {
Surface drawable_surface()
{
	Surface s;
	s.source = "Camera";
	s.visible = true;
	return s;
}
} // namespace

TEST_CASE("should_draw_surface is true for a visible, sourced, non-empty, invertible surface")
{
	CHECK(should_draw_surface(drawable_surface(), true, 1280, 720, true));
}

TEST_CASE("should_draw_surface is false when the surface is hidden")
{
	Surface s = drawable_surface();
	s.visible = false;
	CHECK_FALSE(should_draw_surface(s, s.visible, 1280, 720, true));
}

TEST_CASE("should_draw_surface is false when the source has no pixels")
{
	const Surface s = drawable_surface();
	CHECK_FALSE(should_draw_surface(s, s.visible, 0, 0, true));
	CHECK_FALSE(should_draw_surface(s, s.visible, 0, 720, true));
	CHECK_FALSE(should_draw_surface(s, s.visible, 1280, 0, true));
}

TEST_CASE("should_draw_surface is false when no source is assigned")
{
	Surface s = drawable_surface();
	s.source.clear();
	CHECK_FALSE(should_draw_surface(s, s.visible, 1280, 720, true));
}

TEST_CASE("should_draw_surface is false without a homography")
{
	CHECK_FALSE(should_draw_surface(drawable_surface(), true, 1280, 720, false));
}

TEST_CASE("should_draw_surface is false when an ancestor hides it")
{
	const Surface s = drawable_surface();
	REQUIRE(s.visible);
	CHECK_FALSE(should_draw_surface(s, false, 1280, 720, true));
}

TEST_CASE("mask_texture_size rounds each side up to a power of two")
{
	CHECK(mask_texture_size(500, 500) == std::pair<uint32_t, uint32_t>{512, 512});
	CHECK(mask_texture_size(501, 10) == std::pair<uint32_t, uint32_t>{512, 16});
}

TEST_CASE("mask_texture_size clamps each side to [16, 1024]")
{
	CHECK(mask_texture_size(4, 3000) == std::pair<uint32_t, uint32_t>{16, 1024});
}

TEST_CASE("mask_texture_size rounds up before clamping")
{
	CHECK(mask_texture_size(0.4, 10.2) == std::pair<uint32_t, uint32_t>{16, 16});
}

TEST_CASE("mask_texture_size keeps the size through a small drag")
{
	CHECK(mask_texture_size(500, 500) == mask_texture_size(510, 505));
}

TEST_CASE("corner_extent measures the corners without clipping to the canvas")
{
	Surface s = drawable_surface();
	s.corners = {Point{-300, -100}, Point{500, -120}, Point{520, 400}, Point{-280, 380}};
	CHECK(corner_extent(s) == std::pair<double, double>{820, 520});
}
