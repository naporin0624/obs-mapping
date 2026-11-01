#include "mapping-source.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <set>
#include <string>

#include <graphics/matrix4.h>

#include "draw-rules.hpp"
#include "plugin-support.h"

using obs_mapping::Mapping;
using obs_mapping::ParseError;

namespace {

constexpr uint32_t kDefaultWidth = 1920;
constexpr uint32_t kDefaultHeight = 1080;
constexpr const char *kJsonKey = "mapping_json";

std::mutex g_hook_mutex;
std::function<void(MappingSource &)> g_on_mapping_changed;

void notify_mapping_changed(MappingSource &ms)
{
	std::function<void(MappingSource &)> handler;
	{
		std::lock_guard lock(g_hook_mutex);
		handler = g_on_mapping_changed;
	}
	if (handler)
		handler(ms);
}

std::shared_ptr<const MappingSnapshot> make_snapshot(Mapping mapping)
{
	auto snap = std::make_shared<MappingSnapshot>();
	snap->inv_h.reserve(mapping.surfaces.size());
	for (const auto &surface : mapping.surfaces) {
		std::optional<obs_mapping::Mat3> inv;
		if (obs_mapping::is_convex_quad(surface.corners)) {
			if (auto h = obs_mapping::unit_square_to_quad(surface.corners))
				inv = obs_mapping::invert(*h);
		}
		snap->inv_h.push_back(inv);
	}
	snap->mapping = std::move(mapping);
	return snap;
}

// The shader multiplies mul(inv_h, v); libobs uploads matrix4 rows transposed, so store H^-1 transposed.
matrix4 to_shader_matrix(const obs_mapping::Mat3 &m)
{
	matrix4 out;
	matrix4_identity(&out);
	vec4_set(&out.x, static_cast<float>(m[0]), static_cast<float>(m[3]), static_cast<float>(m[6]), 0.0f);
	vec4_set(&out.y, static_cast<float>(m[1]), static_cast<float>(m[4]), static_cast<float>(m[7]), 0.0f);
	vec4_set(&out.z, static_cast<float>(m[2]), static_cast<float>(m[5]), static_cast<float>(m[8]), 0.0f);
	vec4_set(&out.t, 0.0f, 0.0f, 0.0f, 1.0f);
	return out;
}

struct PixelBox {
	int x = 0, y = 0, w = 0, h = 0;
};

PixelBox canvas_bounds(const obs_mapping::Surface &s, uint32_t canvas_w, uint32_t canvas_h)
{
	double min_x = s.corners[0].x, max_x = min_x, min_y = s.corners[0].y, max_y = min_y;
	for (const auto &p : s.corners) {
		min_x = std::min(min_x, p.x);
		max_x = std::max(max_x, p.x);
		min_y = std::min(min_y, p.y);
		max_y = std::max(max_y, p.y);
	}
	const double x0 = std::clamp(std::floor(min_x), 0.0, static_cast<double>(canvas_w));
	const double x1 = std::clamp(std::ceil(max_x), 0.0, static_cast<double>(canvas_w));
	const double y0 = std::clamp(std::floor(min_y), 0.0, static_cast<double>(canvas_h));
	const double y1 = std::clamp(std::ceil(max_y), 0.0, static_cast<double>(canvas_h));
	return {static_cast<int>(x0), static_cast<int>(y0), static_cast<int>(x1 - x0), static_cast<int>(y1 - y0)};
}

void rename_signal_cb(void *param, calldata_t *cd)
{
	const char *prev = calldata_string(cd, "prev_name");
	const char *next = calldata_string(cd, "new_name");
	if (prev && next)
		static_cast<MappingSource *>(param)->on_source_renamed(prev, next);
}

} // namespace

MappingSource::MappingSource(obs_source_t *src, obs_data_t *settings) : source(src), cache_(src)
{
	snapshot_ = make_snapshot(obs_mapping::default_mapping(kDefaultWidth, kDefaultHeight));

	const char *json = obs_data_get_string(settings, kJsonKey);
	if (!json || !*json) {
		const std::string text = obs_mapping::serialize_mapping(snapshot_->mapping);
		obs_data_set_string(settings, kJsonKey, text.c_str());
	} else {
		std::lock_guard lock(write_mutex_);
		if (auto applied = apply_json(json); !applied)
			obs_log(LOG_WARNING, "invalid mapping_json, using the default mapping: %s",
				applied.error().message.c_str());
	}

	load_effect();
	signal_handler_connect(obs_get_signal_handler(), "source_rename", rename_signal_cb, this);
}

MappingSource::~MappingSource()
{
	signal_handler_disconnect(obs_get_signal_handler(), "source_rename", rename_signal_cb, this);
	cache_.clear();
	if (effect_) {
		obs_enter_graphics();
		gs_effect_destroy(effect_);
		obs_leave_graphics();
	}
}

void MappingSource::load_effect()
{
	char *path = obs_module_file("effects/warp.effect");
	if (!path) {
		obs_log(LOG_ERROR, "effects/warp.effect not found");
		return;
	}
	obs_enter_graphics();
	char *error = nullptr;
	effect_ = gs_effect_create_from_file(path, &error);
	obs_leave_graphics();
	if (!effect_)
		obs_log(LOG_ERROR, "failed to load warp.effect: %s", error ? error : "unknown error");
	bfree(error);
	bfree(path);
}

std::shared_ptr<const MappingSnapshot> MappingSource::snapshot() const
{
	std::lock_guard lock(state_mutex_);
	return snapshot_;
}

Mapping MappingSource::current() const
{
	return snapshot()->mapping;
}

std::expected<bool, ParseError> MappingSource::apply_json(std::string_view json)
{
	auto parsed = obs_mapping::parse_mapping(json);
	if (!parsed)
		return std::unexpected(std::move(parsed.error()));

	auto next = make_snapshot(std::move(*parsed));
	std::lock_guard lock(state_mutex_);
	const bool changed = !(snapshot_->mapping == next->mapping);
	if (changed)
		snapshot_ = std::move(next);
	return changed;
}

std::expected<void, ParseError> MappingSource::set_mapping_json(std::string_view json)
{
	bool changed = false;
	{
		std::lock_guard lock(write_mutex_);
		auto applied = apply_json(json);
		if (!applied)
			return std::unexpected(std::move(applied.error()));
		changed = *applied;

		// OBS_SOURCE_VIDEO sources get their update deferred to the next tick;
		// that update re-parses this same text and finds nothing to change.
		const std::string text(json);
		obs_data_t *patch = obs_data_create();
		obs_data_set_string(patch, kJsonKey, text.c_str());
		obs_source_update(source, patch);
		obs_data_release(patch);
	}
	if (changed)
		notify_mapping_changed(*this);
	return {};
}

void MappingSource::update(obs_data_t *settings)
{
	bool changed = false;
	{
		std::lock_guard lock(write_mutex_);
		const char *json = obs_data_get_string(settings, kJsonKey);
		auto applied = apply_json(json ? json : "");
		if (!applied) {
			obs_log(LOG_WARNING, "ignoring invalid mapping_json: %s", applied.error().message.c_str());
			return;
		}
		changed = *applied;
	}
	if (changed)
		notify_mapping_changed(*this);
}

void MappingSource::on_source_renamed(const char *prev_name, const char *new_name)
{
	Mapping mapping = current();
	if (!obs_mapping::rename_source(mapping, prev_name, new_name))
		return;
	if (auto saved = set_mapping_json(obs_mapping::serialize_mapping(mapping)); !saved)
		obs_log(LOG_WARNING, "failed to save renamed source: %s", saved.error().message.c_str());
}

uint32_t MappingSource::width() const
{
	return snapshot()->mapping.width;
}

uint32_t MappingSource::height() const
{
	return snapshot()->mapping.height;
}

void MappingSource::enum_active_sources(obs_source_enum_proc_t callback, void *param)
{
	cache_.enum_active_sources(callback, param);
}

void MappingSource::video_tick()
{
	const auto snap = snapshot();
	std::set<std::string> names;
	for (const auto &surface : snap->mapping.surfaces) {
		if (!surface.source.empty())
			names.insert(surface.source);
	}
	cache_.tick(names);
}

void MappingSource::video_render()
{
	if (!effect_)
		return;

	const auto snap = snapshot(); // one mapping for the whole frame
	const Mapping &mapping = snap->mapping;

	// Child textures first: texrender begin/end changes render target and projection.
	std::vector<RenderedChild> frames(mapping.surfaces.size());
	for (size_t i = 0; i < mapping.surfaces.size(); ++i) {
		const auto &surface = mapping.surfaces[i];
		if (surface.visible && snap->inv_h[i])
			frames[i] = cache_.render(surface.source);
	}

	gs_eparam_t *image_param = gs_effect_get_param_by_name(effect_, "image");
	gs_eparam_t *inv_h_param = gs_effect_get_param_by_name(effect_, "inv_h");
	gs_eparam_t *crop_param = gs_effect_get_param_by_name(effect_, "crop");
	gs_eparam_t *bbox_param = gs_effect_get_param_by_name(effect_, "bbox");

	const bool linear = gs_get_linear_srgb();
	const bool previous_srgb = gs_framebuffer_srgb_enabled();
	gs_enable_framebuffer_srgb(linear);
	gs_blend_state_push();
	gs_blend_function(GS_BLEND_ONE, GS_BLEND_INVSRCALPHA);

	for (size_t i = 0; i < mapping.surfaces.size(); ++i) {
		const auto &surface = mapping.surfaces[i];
		const RenderedChild &frame = frames[i];
		const bool has_texture = frame.texture != nullptr;
		if (!obs_mapping::should_draw_surface(surface, has_texture ? frame.width : 0,
						      has_texture ? frame.height : 0, snap->inv_h[i].has_value()))
			continue;

		const PixelBox box = canvas_bounds(surface, mapping.width, mapping.height);
		if (box.w <= 0 || box.h <= 0)
			continue;

		const matrix4 inv_h = to_shader_matrix(*snap->inv_h[i]);
		vec4 crop;
		vec4_set(&crop, static_cast<float>(surface.crop.x), static_cast<float>(surface.crop.y),
			 static_cast<float>(surface.crop.width), static_cast<float>(surface.crop.height));
		vec4 bbox;
		vec4_set(&bbox, static_cast<float>(box.x), static_cast<float>(box.y), static_cast<float>(box.w),
			 static_cast<float>(box.h));

		if (linear)
			gs_effect_set_texture_srgb(image_param, frame.texture);
		else
			gs_effect_set_texture(image_param, frame.texture);
		gs_effect_set_matrix4(inv_h_param, &inv_h);
		gs_effect_set_vec4(crop_param, &crop);
		gs_effect_set_vec4(bbox_param, &bbox);

		gs_matrix_push();
		gs_matrix_translate3f(static_cast<float>(box.x), static_cast<float>(box.y), 0.0f);
		while (gs_effect_loop(effect_, "Draw"))
			gs_draw_sprite(nullptr, 0, static_cast<uint32_t>(box.w), static_cast<uint32_t>(box.h));
		gs_matrix_pop();
	}

	gs_blend_state_pop();
	gs_enable_framebuffer_srgb(previous_srgb);
}

MappingSource *mapping_source_from(obs_source_t *src)
{
	if (!src)
		return nullptr;
	const char *id = obs_source_get_unversioned_id(src);
	if (!id || std::string_view(id) != "obs_mapping_source")
		return nullptr;
	return static_cast<MappingSource *>(obs_obj_get_data(src));
}

void set_on_mapping_changed(std::function<void(MappingSource &)> handler)
{
	std::lock_guard lock(g_hook_mutex);
	g_on_mapping_changed = std::move(handler);
}

namespace {

MappingSource &self(void *data)
{
	return *static_cast<MappingSource *>(data);
}

const char *mapping_get_name(void *)
{
	return obs_module_text("MappingSource");
}

void *mapping_create(obs_data_t *settings, obs_source_t *source)
{
	return new MappingSource(source, settings);
}

void mapping_destroy(void *data)
{
	delete static_cast<MappingSource *>(data);
}

void mapping_update(void *data, obs_data_t *settings)
{
	self(data).update(settings);
}

uint32_t mapping_get_width(void *data)
{
	return self(data).width();
}

uint32_t mapping_get_height(void *data)
{
	return self(data).height();
}

obs_properties_t *mapping_get_properties(void *)
{
	obs_properties_t *props = obs_properties_create();
	obs_properties_add_text(props, kJsonKey, obs_module_text("MappingJson"), OBS_TEXT_MULTILINE);
	return props;
}

void mapping_video_tick(void *data, float)
{
	self(data).video_tick();
}

void mapping_video_render(void *data, gs_effect_t *)
{
	self(data).video_render();
}

void mapping_enum_active_sources(void *data, obs_source_enum_proc_t callback, void *param)
{
	self(data).enum_active_sources(callback, param);
}

} // namespace

struct obs_source_info mapping_source_info = []() {
	obs_source_info info = {};
	info.id = "obs_mapping_source";
	info.type = OBS_SOURCE_TYPE_INPUT;
	info.output_flags = OBS_SOURCE_VIDEO | OBS_SOURCE_CUSTOM_DRAW;
	info.get_name = mapping_get_name;
	info.create = mapping_create;
	info.destroy = mapping_destroy;
	info.update = mapping_update;
	info.get_width = mapping_get_width;
	info.get_height = mapping_get_height;
	info.get_properties = mapping_get_properties;
	info.video_tick = mapping_video_tick;
	info.video_render = mapping_video_render;
	info.enum_active_sources = mapping_enum_active_sources;
	return info;
}();
