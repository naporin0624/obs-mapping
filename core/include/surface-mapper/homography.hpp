#pragma once

#include <array>
#include <optional>

#include "surface-mapper/model.hpp"

namespace surface_mapper {

using Mat3 = std::array<double, 9>; // row-major

// Homography mapping the unit square to quad q:
// (0,0)->q[0], (1,0)->q[1], (1,1)->q[2], (0,1)->q[3].
// Returns nullopt for degenerate quads.
std::optional<Mat3> unit_square_to_quad(const std::array<Point, 4> &q);

// Returns nullopt when |det| < 1e-12.
std::optional<Mat3> invert(const Mat3 &m);

// Returns nullopt when the homogeneous w is close to 0.
std::optional<Point> apply(const Mat3 &m, Point p);

// True only for strictly convex, non-self-intersecting, non-degenerate quads.
bool is_convex_quad(const std::array<Point, 4> &q);

} // namespace surface_mapper
