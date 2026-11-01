#include "mapping-source.hpp"

#include <cstdint>

namespace {

constexpr int kDefaultWidth = 1920;
constexpr int kDefaultHeight = 1080;

struct MappingSource {
	obs_source_t *source = nullptr;
	uint32_t width = kDefaultWidth;
	uint32_t height = kDefaultHeight;
};

const char *mapping_get_name(void *)
{
	return obs_module_text("MappingSource");
}

void mapping_update(void *data, obs_data_t *settings)
{
	auto *ctx = static_cast<MappingSource *>(data);
	ctx->width = static_cast<uint32_t>(obs_data_get_int(settings, "width"));
	ctx->height = static_cast<uint32_t>(obs_data_get_int(settings, "height"));
}

void *mapping_create(obs_data_t *settings, obs_source_t *source)
{
	auto *ctx = new MappingSource;
	ctx->source = source;
	mapping_update(ctx, settings);
	return ctx;
}

void mapping_destroy(void *data)
{
	delete static_cast<MappingSource *>(data);
}

uint32_t mapping_get_width(void *data)
{
	return static_cast<MappingSource *>(data)->width;
}

uint32_t mapping_get_height(void *data)
{
	return static_cast<MappingSource *>(data)->height;
}

void mapping_get_defaults(obs_data_t *settings)
{
	obs_data_set_default_int(settings, "width", kDefaultWidth);
	obs_data_set_default_int(settings, "height", kDefaultHeight);
}

obs_properties_t *mapping_get_properties(void *)
{
	obs_properties_t *props = obs_properties_create();
	obs_properties_add_int(props, "width", obs_module_text("Width"), 1, 16384, 1);
	obs_properties_add_int(props, "height", obs_module_text("Height"), 1, 16384, 1);
	return props;
}

void mapping_video_render(void *, gs_effect_t *)
{
	// Task 1: transparent source, nothing to draw yet.
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
	info.get_defaults = mapping_get_defaults;
	info.get_properties = mapping_get_properties;
	info.video_render = mapping_video_render;
	return info;
}();
