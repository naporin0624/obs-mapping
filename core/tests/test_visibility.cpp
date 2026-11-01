#include <doctest/doctest.h>

#include "obs-mapping/visibility.hpp"

using namespace obs_mapping;

namespace {

Surface surface(const char *id, bool visible = true)
{
	Surface s;
	s.id = id;
	s.visible = visible;
	return s;
}

Group group(const char *id, bool visible = true)
{
	Group g;
	g.id = id;
	g.visible = visible;
	return g;
}

LayerNode leaf(const char *id)
{
	return {LayerNode::Kind::Surface, id, {}};
}

LayerNode branch(const char *id, std::vector<LayerNode> children)
{
	return {LayerNode::Kind::Group, id, std::move(children)};
}

} // namespace

TEST_CASE("effective visibility hides surfaces under a hidden group")
{
	Mapping m;
	m.surfaces = {surface("s-1"), surface("s-2")};
	m.groups = {group("g-1", false)};
	m.layers = {branch("g-1", {leaf("s-1")}), leaf("s-2")};
	CHECK(effective_visibility(m) == std::vector<bool>{false, true});
}

TEST_CASE("effective visibility needs every ancestor visible")
{
	Mapping m;
	m.surfaces = {surface("s-1")};
	m.groups = {group("g-1", false), group("g-2")};
	m.layers = {branch("g-1", {branch("g-2", {leaf("s-1")})})};
	CHECK(effective_visibility(m) == std::vector<bool>{false});
}

TEST_CASE("effective visibility keeps the surface flag")
{
	Mapping m;
	m.surfaces = {surface("s-1", false)};
	m.groups = {group("g-1")};
	m.layers = {branch("g-1", {leaf("s-1")})};
	CHECK(effective_visibility(m) == std::vector<bool>{false});
}

TEST_CASE("effective visibility treats unknown tree ids as hidden")
{
	Mapping m;
	m.surfaces = {surface("s-1")};
	m.layers = {branch("g-9", {leaf("s-1")}), leaf("s-9")};
	CHECK(effective_visibility(m) == std::vector<bool>{false});
}
