#pragma once

#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace obs_mapping {

struct Point {
	double x = 0;
	double y = 0;
	bool operator==(const Point &) const = default;
};

struct CropRect {
	double x = 0, y = 0, width = 1, height = 1;
	bool operator==(const CropRect &) const = default;
};

enum class SurfaceType { Quad };

struct Surface {
	std::string id, name;
	SurfaceType type = SurfaceType::Quad;
	std::string source;
	CropRect crop;
	std::array<Point, 4> corners{};
	bool visible = true;
	bool operator==(const Surface &) const = default;
};

enum class Direction { Row, Column };
enum class Align { Start, Center, End };

struct Layout {
	Direction direction = Direction::Row;
	double gap = 0;
	Align align = Align::Start;
	double padding = 0;
	bool operator==(const Layout &) const = default;
};

struct Group {
	std::string id, name;
	bool visible = true;
	Point origin;
	Layout layout;
	bool operator==(const Group &) const = default;
};

struct LayerNode {
	enum class Kind { Surface, Group } kind = Kind::Surface;
	std::string id;
	std::vector<LayerNode> children;
	bool operator==(const LayerNode &) const = default;
};

struct Mapping {
	int version = 2;
	uint32_t width = 1920, height = 1080;
	double grid_size = 20;
	std::vector<Surface> surfaces;
	std::vector<Group> groups;
	std::vector<LayerNode> layers;
	bool operator==(const Mapping &) const = default;
};

} // namespace obs_mapping
