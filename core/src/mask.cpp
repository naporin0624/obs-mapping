#include "obs-mapping/mask.hpp"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace obs_mapping {

namespace {

constexpr int kSamples = 4;

bool in_ellipse(const EllipseMask &e, Point p)
{
	double rx = e.width / 2, ry = e.height / 2;
	double dx = (p.x - (e.x + rx)) / rx, dy = (p.y - (e.y + ry)) / ry;
	return dx * dx + dy * dy <= 1.0;
}

bool crosses(Point p, Point a, Point b)
{
	return (a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x;
}

bool in_polygon(const PolygonMask &poly, Point p)
{
	const auto &pts = poly.points;
	bool inside = false;
	for (size_t i = 0; i < pts.size(); ++i)
		if (crosses(p, pts[i], pts[(i + 1) % pts.size()]))
			inside = !inside;
	return inside;
}

double sample_x(uint32_t i, int a, uint32_t width)
{
	return (i + (a + 0.5) / kSamples) / width;
}

double sample_y(uint32_t j, int b, uint32_t height)
{
	return (j + (b + 0.5) / kSamples) / height;
}

std::vector<double> sorted_crossings(const PolygonMask &poly, double y)
{
	const auto &pts = poly.points;
	std::vector<double> xs;
	for (size_t i = 0; i < pts.size(); ++i) {
		Point a = pts[i], b = pts[(i + 1) % pts.size()];
		if ((a.y > y) != (b.y > y))
			xs.push_back((b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x);
	}
	std::ranges::sort(xs);
	return xs;
}

// Samples left to right: inside while an odd number of crossings is <= x.
void count_polygon_row(const PolygonMask &poly, double y, uint32_t width, std::vector<int> &hits)
{
	auto xs = sorted_crossings(poly, y);
	size_t passed = 0;
	for (uint32_t i = 0; i < width; ++i)
		for (int a = 0; a < kSamples; ++a) {
			double x = sample_x(i, a, width);
			while (passed < xs.size() && xs[passed] <= x)
				++passed;
			hits[i] += passed % 2;
		}
}

void count_ellipse_row(const EllipseMask &e, double y, uint32_t width, std::vector<int> &hits)
{
	for (uint32_t i = 0; i < width; ++i)
		for (int a = 0; a < kSamples; ++a)
			hits[i] += in_ellipse(e, {sample_x(i, a, width), y}) ? 1 : 0;
}

void count_row(const Mask &m, double y, uint32_t width, std::vector<int> &hits)
{
	if (const auto *e = std::get_if<EllipseMask>(&m))
		count_ellipse_row(*e, y, width, hits);
	else
		count_polygon_row(std::get<PolygonMask>(m), y, width, hits);
}

std::vector<Point> ellipse_outline(const EllipseMask &e, int segments)
{
	double rx = e.width / 2, ry = e.height / 2;
	std::vector<Point> out;
	if (segments <= 0)
		return out;
	out.reserve(segments);
	for (int k = 0; k < segments; ++k) {
		double t = 2 * std::numbers::pi * k / segments;
		out.push_back({e.x + rx + rx * std::cos(t), e.y + ry + ry * std::sin(t)});
	}
	return out;
}

} // namespace

bool mask_contains(const Mask &m, Point unit)
{
	if (const auto *e = std::get_if<EllipseMask>(&m))
		return in_ellipse(*e, unit);
	return in_polygon(std::get<PolygonMask>(m), unit);
}

std::vector<uint8_t> rasterize_mask(const Mask &m, uint32_t width, uint32_t height)
{
	std::vector<uint8_t> out(static_cast<size_t>(width) * height);
	std::vector<int> hits(width);
	for (uint32_t j = 0; j < height; ++j) {
		std::ranges::fill(hits, 0);
		for (int b = 0; b < kSamples; ++b)
			count_row(m, sample_y(j, b, height), width, hits);
		for (uint32_t i = 0; i < width; ++i)
			out[static_cast<size_t>(j) * width + i] =
				static_cast<uint8_t>(hits[i] * 255 / (kSamples * kSamples));
	}
	return out;
}

std::vector<Point> mask_outline(const Mask &m, int ellipse_segments)
{
	if (const auto *e = std::get_if<EllipseMask>(&m))
		return ellipse_outline(*e, ellipse_segments);
	return std::get<PolygonMask>(m).points;
}

} // namespace obs_mapping
