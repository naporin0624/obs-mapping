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
