#include "obs-mapping/mapping_json.hpp"

#include <nlohmann/json.hpp>

#include <cmath>
#include <set>

namespace obs_mapping {

using nlohmann::json;
using nlohmann::ordered_json;

namespace {

struct Fail {
	std::string message;
};

[[noreturn]] void fail(const std::string &path, const std::string &msg)
{
	throw Fail{path + ": " + msg};
}

const json &require(const json &obj, const char *key, const std::string &path)
{
	if (!obj.is_object())
		fail(path, "expected object");
	auto it = obj.find(key);
	if (it == obj.end())
		fail(path.empty() ? key : path + "." + key, "missing");
	return *it;
}

std::string join(const std::string &base, const char *key)
{
	return base.empty() ? std::string(key) : base + "." + key;
}

double number(const json &v, const std::string &path)
{
	if (!v.is_number())
		fail(path, "expected number");
	double d = v.get<double>();
	if (!std::isfinite(d))
		fail(path, "expected finite number");
	return d;
}

uint32_t dimension(const json &v, const std::string &path)
{
	double d = number(v, path);
	if (d != std::floor(d))
		fail(path, "expected integer");
	if (d < 1 || d > 16384)
		fail(path, "must be between 1 and 16384");
	return static_cast<uint32_t>(d);
}

std::string str(const json &v, const std::string &path)
{
	if (!v.is_string())
		fail(path, "expected string");
	return v.get<std::string>();
}

Surface parse_surface(const json &s, size_t i, std::set<std::string> &ids)
{
	const std::string p = "surfaces[" + std::to_string(i) + "]";
	if (!s.is_object())
		fail(p, "expected object");
	Surface out;

	out.id = str(require(s, "id", p), p + ".id");
	if (out.id.empty())
		fail(p + ".id", "must not be empty");
	if (!ids.insert(out.id).second)
		fail(p + ".id", "duplicate id \"" + out.id + "\"");

	out.name = str(require(s, "name", p), p + ".name");

	const std::string type = str(require(s, "type", p), p + ".type");
	if (type != "quad")
		fail(p + ".type", "unknown type \"" + type + "\"");
	out.type = SurfaceType::Quad;

	out.source = str(require(s, "source", p), p + ".source");

	const std::string cp = p + ".crop";
	const json &c = require(s, "crop", p);
	if (!c.is_object())
		fail(cp, "expected object");
	out.crop.x = number(require(c, "x", cp), cp + ".x");
	out.crop.y = number(require(c, "y", cp), cp + ".y");
	out.crop.width = number(require(c, "width", cp), cp + ".width");
	out.crop.height = number(require(c, "height", cp), cp + ".height");
	const CropRect &cr = out.crop;
	if (cr.x < 0 || cr.y < 0 || cr.width <= 0 || cr.height <= 0 || cr.x + cr.width > 1 ||
	    cr.y + cr.height > 1)
		fail(cp, "must satisfy x,y >= 0, width,height > 0, x+width <= 1, y+height <= 1");

	const std::string kp = p + ".corners";
	const json &k = require(s, "corners", p);
	if (!k.is_array() || k.size() != 4)
		fail(kp, "expected 4 points");
	for (size_t j = 0; j < 4; ++j) {
		const std::string pp = kp + "[" + std::to_string(j) + "]";
		const json &pt = k[j];
		if (!pt.is_array() || pt.size() != 2)
			fail(pp, "expected [x, y]");
		out.corners[j] = {number(pt[0], pp + "[0]"), number(pt[1], pp + "[1]")};
	}

	auto vit = s.find("visible");
	if (vit != s.end()) {
		if (!vit->is_boolean())
			fail(p + ".visible", "expected boolean");
		out.visible = vit->get<bool>();
	}
	return out;
}

} // namespace

std::expected<Mapping, ParseError> parse_mapping(std::string_view text)
{
	json root;
	try {
		root = json::parse(text.begin(), text.end());
	} catch (const json::exception &e) {
		return std::unexpected(ParseError{std::string("json: ") + e.what()});
	}

	try {
		Mapping m;
		const json &ver = require(root, "version", "");
		if (!ver.is_number_integer())
			fail("version", "expected integer");
		m.version = ver.get<int>();
		if (m.version != 1)
			fail("version", "unsupported version " + std::to_string(m.version));

		const json &canvas = require(root, "canvas", "");
		if (!canvas.is_object())
			fail("canvas", "expected object");
		m.width = dimension(require(canvas, "width", "canvas"), "canvas.width");
		m.height = dimension(require(canvas, "height", "canvas"), "canvas.height");

		const json &grid = require(root, "grid", "");
		if (!grid.is_object())
			fail("grid", "expected object");
		m.grid_size = number(require(grid, "size", "grid"), "grid.size");
		if (m.grid_size <= 0 || m.grid_size > 1024)
			fail("grid.size", "must be greater than 0 and at most 1024");

		const json &surfaces = require(root, "surfaces", "");
		if (!surfaces.is_array())
			fail("surfaces", "expected array");
		std::set<std::string> ids;
		for (size_t i = 0; i < surfaces.size(); ++i)
			m.surfaces.push_back(parse_surface(surfaces[i], i, ids));
		return m;
	} catch (const Fail &f) {
		return std::unexpected(ParseError{f.message});
	}
}

std::string serialize_mapping(const Mapping &m)
{
	ordered_json j = ordered_json::object();
	j["version"] = m.version;
	j["canvas"] = {{"width", m.width}, {"height", m.height}};
	j["grid"] = {{"size", m.grid_size}};
	ordered_json arr = ordered_json::array();
	for (const Surface &s : m.surfaces) {
		ordered_json o = ordered_json::object();
		o["id"] = s.id;
		o["name"] = s.name;
		o["type"] = "quad";
		o["source"] = s.source;
		o["crop"] = {{"x", s.crop.x}, {"y", s.crop.y}, {"width", s.crop.width}, {"height", s.crop.height}};
		ordered_json corners = ordered_json::array();
		for (const Point &p : s.corners)
			corners.push_back(ordered_json::array({p.x, p.y}));
		o["corners"] = corners;
		o["visible"] = s.visible;
		arr.push_back(o);
	}
	j["surfaces"] = arr;
	return j.dump(2);
}

Mapping default_mapping(uint32_t width, uint32_t height)
{
	Mapping m;
	m.width = width;
	m.height = height;
	m.grid_size = 20;
	return m;
}

bool rename_source(Mapping &m, std::string_view from, std::string_view to)
{
	bool changed = false;
	for (Surface &s : m.surfaces) {
		if (s.source == from && from != to) {
			s.source = std::string(to);
			changed = true;
		}
	}
	return changed;
}

} // namespace obs_mapping
