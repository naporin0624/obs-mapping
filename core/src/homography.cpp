#include "surface-mapper/homography.hpp"

#include <cmath>

namespace surface_mapper {

namespace {
constexpr double kEps = 1e-12;

double det3(const Mat3 &m)
{
	return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) +
	       m[2] * (m[3] * m[7] - m[4] * m[6]);
}

double cross(Point o, Point a, Point b)
{
	return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}
} // namespace

// Heckbert's square-to-quad projective mapping.
std::optional<Mat3> unit_square_to_quad(const std::array<Point, 4> &q)
{
	const double x0 = q[0].x, y0 = q[0].y, x1 = q[1].x, y1 = q[1].y;
	const double x2 = q[2].x, y2 = q[2].y, x3 = q[3].x, y3 = q[3].y;

	const double dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
	const double dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;

	const double den = dx1 * dy2 - dx2 * dy1;
	if (std::abs(den) < kEps)
		return std::nullopt;

	double g = 0, h = 0;
	if (std::abs(dx3) >= kEps || std::abs(dy3) >= kEps) {
		g = (dx3 * dy2 - dx2 * dy3) / den;
		h = (dx1 * dy3 - dx3 * dy1) / den;
	}

	const Mat3 m = {x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1.0};
	if (std::abs(det3(m)) < kEps)
		return std::nullopt;
	return m;
}

std::optional<Mat3> invert(const Mat3 &m)
{
	const double det = det3(m);
	if (std::abs(det) < kEps)
		return std::nullopt;
	const double s = 1.0 / det;
	return Mat3{
		(m[4] * m[8] - m[5] * m[7]) * s, (m[2] * m[7] - m[1] * m[8]) * s, (m[1] * m[5] - m[2] * m[4]) * s,
		(m[5] * m[6] - m[3] * m[8]) * s, (m[0] * m[8] - m[2] * m[6]) * s, (m[2] * m[3] - m[0] * m[5]) * s,
		(m[3] * m[7] - m[4] * m[6]) * s, (m[1] * m[6] - m[0] * m[7]) * s, (m[0] * m[4] - m[1] * m[3]) * s,
	};
}

std::optional<Point> apply(const Mat3 &m, Point p)
{
	const double w = m[6] * p.x + m[7] * p.y + m[8];
	if (std::abs(w) < kEps)
		return std::nullopt;
	return Point{(m[0] * p.x + m[1] * p.y + m[2]) / w, (m[3] * p.x + m[4] * p.y + m[5]) / w};
}

bool is_convex_quad(const std::array<Point, 4> &q)
{
	int pos = 0, neg = 0;
	for (int i = 0; i < 4; ++i) {
		const double c = cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4]);
		if (c > kEps)
			++pos;
		else if (c < -kEps)
			++neg;
		else
			return false;
	}
	return pos == 4 || neg == 4;
}

} // namespace surface_mapper
