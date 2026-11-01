#include "overlay.hpp"

#include <obs-module.h>

#include <algorithm>
#include <array>

#include "obs-mapping/homography.hpp"
#include "overlay-geometry.hpp"

using obs_mapping::Point;

namespace {

struct Color {
	float r, g, b, a;
};

constexpr Color kGridColor{0.9321f, 0.9374f, 0.9483f, 0.25f};       // colors-gray-1 @ 25%
constexpr Color kOutlineColor{0.5254f, 0.5254f, 0.5254f, 1.0f};     // colors-dark-border-strong
constexpr Color kSelectedColor{0.2243f, 0.5868f, 1.0f, 1.0f};       // colors-neon-blue
constexpr Color kInvalidColor{1.0f, 0.1356f, 0.209f, 1.0f};         // colors-red-text (danger-text)
constexpr Color kHandleColor{0.9321f, 0.9374f, 0.9483f, 1.0f};      // colors-gray-1 (fg-default)
constexpr Color kSelectedCornerColor{0.2243f, 0.5868f, 1.0f, 1.0f}; // colors-neon-blue

constexpr double kGridThickness = 1.0;
constexpr double kOutlineThickness = 2.0;
constexpr double kHandleSize = 12.0;
constexpr double kSelectedHandleSize = 18.0;
constexpr double kDashOn = 8.0;
constexpr double kDashOff = 6.0;
constexpr double kMaxGridLines = 4096; // a tiny grid_size must not stall the render thread

struct Painter {
	gs_eparam_t *color_param;

	void set_color(Color c) const
	{
		// Blending is ONE/INVSRCALPHA (premultiplied), same as the warp pass.
		vec4 v;
		vec4_set(&v, c.r * c.a, c.g * c.a, c.b * c.a, c.a);
		gs_effect_set_vec4(color_param, &v);
	}

	void strip(const std::array<Point, 4> &q) const
	{
		gs_render_start(true);
		for (const Point &p : q)
			gs_vertex2f(static_cast<float>(p.x), static_cast<float>(p.y));
		gs_render_stop(GS_TRISTRIP);
	}

	void line(Point a, Point b, double thickness) const
	{
		if (auto q = obs_mapping::line_strip(a, b, thickness))
			strip(*q);
	}

	void dashed_line(Point a, Point b, double thickness) const
	{
		const double len = std::hypot(b.x - a.x, b.y - a.y);
		for (const auto &seg : obs_mapping::dash_segments(len, kDashOn, kDashOff))
			line(obs_mapping::point_along(a, b, seg.start), obs_mapping::point_along(a, b, seg.end),
			     thickness);
	}
};

bool is_selected(const OverlayState &state, const std::string &id)
{
	return std::find(state.selected_surface_ids.begin(), state.selected_surface_ids.end(), id) !=
	       state.selected_surface_ids.end();
}

void draw_grid(const Painter &p, const obs_mapping::Mapping &m)
{
	if (!(m.grid_size > 0))
		return;
	const double w = m.width, h = m.height;
	if (w / m.grid_size + h / m.grid_size > kMaxGridLines)
		return;
	p.set_color(kGridColor);
	for (double x = 0; x <= w; x += m.grid_size)
		p.line({x, 0}, {x, h}, kGridThickness);
	for (double y = 0; y <= h; y += m.grid_size)
		p.line({0, y}, {w, y}, kGridThickness);
}

} // namespace

void draw_overlay(const obs_mapping::Mapping &mapping, const OverlayState &state)
{
	gs_effect_t *effect = obs_get_base_effect(OBS_EFFECT_SOLID);
	if (!effect)
		return;
	const Painter painter{gs_effect_get_param_by_name(effect, "color")};

	const bool linear = gs_get_linear_srgb();
	const bool previous_srgb = gs_framebuffer_srgb_enabled();
	gs_enable_framebuffer_srgb(linear);
	gs_blend_state_push();
	gs_blend_function(GS_BLEND_ONE, GS_BLEND_INVSRCALPHA);

	while (gs_effect_loop(effect, "Solid")) {
		draw_grid(painter, mapping);

		for (const auto &surface : mapping.surfaces) {
			const bool convex = obs_mapping::is_convex_quad(surface.corners);
			painter.set_color(!convex ? kInvalidColor
						  : (is_selected(state, surface.id) ? kSelectedColor : kOutlineColor));
			for (size_t i = 0; i < 4; ++i) {
				const Point a = surface.corners[i], b = surface.corners[(i + 1) % 4];
				if (convex)
					painter.line(a, b, kOutlineThickness);
				else
					painter.dashed_line(a, b, kOutlineThickness);
			}
		}

		for (const auto &surface : mapping.surfaces) {
			for (size_t i = 0; i < 4; ++i) {
				const bool selected = state.selected_corner &&
						      state.selected_corner->first == surface.id &&
						      state.selected_corner->second == static_cast<int>(i);
				painter.set_color(selected ? kSelectedCornerColor : kHandleColor);
				painter.strip(obs_mapping::square_strip(surface.corners[i],
									selected ? kSelectedHandleSize : kHandleSize));
			}
		}
	}

	gs_blend_state_pop();
	gs_enable_framebuffer_srgb(previous_srgb);
}
