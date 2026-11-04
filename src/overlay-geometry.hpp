#pragma once

// Pure math for the edit overlay (no libobs), so it can be unit-tested in core/tests.

#include <algorithm>
#include <array>
#include <cmath>
#include <optional>
#include <vector>

#include "obs-mapping/homography.hpp"
#include "obs-mapping/model.hpp"

namespace obs_mapping {

struct DashSegment {
	double start = 0;
	double end = 0;
	bool operator==(const DashSegment &) const = default;
};

// Splits [0, length] into `on`-long segments separated by `off` gaps; the last one is clipped to `length`.
inline std::vector<DashSegment> dash_segments(double length, double on, double off)
{
	std::vector<DashSegment> out;
	if (!(length > 0) || !(on > 0) || off < 0)
		return out;
	for (double start = 0; start < length; start += on + off)
		out.push_back({start, std::min(start + on, length)});
	return out;
}

// Corners of a `thickness`-wide strip from a to b, in GS_TRISTRIP order. Nullopt for a zero-length line.
inline std::optional<std::array<Point, 4>> line_strip(Point a, Point b, double thickness)
{
	const double dx = b.x - a.x, dy = b.y - a.y;
	const double len = std::hypot(dx, dy);
	if (!(len > 0))
		return std::nullopt;
	const double nx = -dy / len * thickness / 2, ny = dx / len * thickness / 2;
	return std::array<Point, 4>{Point{a.x + nx, a.y + ny}, Point{a.x - nx, a.y - ny}, Point{b.x + nx, b.y + ny},
				    Point{b.x - nx, b.y - ny}};
}

// Axis-aligned square of side `size` centered on c, in GS_TRISTRIP order.
inline std::array<Point, 4> square_strip(Point c, double size)
{
	const double h = size / 2;
	return {Point{c.x - h, c.y - h}, Point{c.x + h, c.y - h}, Point{c.x - h, c.y + h}, Point{c.x + h, c.y + h}};
}

// Point at distance t along a->b (a and b must differ).
inline Point point_along(Point a, Point b, double t)
{
	const double len = std::hypot(b.x - a.x, b.y - a.y);
	return {a.x + (b.x - a.x) * t / len, a.y + (b.y - a.y) * t / len};
}

// Maps unit-space points through h; points the homography cannot map (w ~ 0) are dropped.
inline std::vector<Point> warp_points(const Mat3 &h, const std::vector<Point> &unit)
{
	std::vector<Point> out;
	out.reserve(unit.size());
	for (const Point &p : unit)
		if (const auto q = apply(h, p))
			out.push_back(*q);
	return out;
}

} // namespace obs_mapping
