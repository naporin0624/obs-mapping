#include "vendor-api.hpp"

#include <obs-module.h>

#include <cassert>
#include <cstring>
#include <optional>

#include <string>

#include <obs-websocket-api.h>

#include "mapping-source.hpp"
#include "obs-mapping/mapping_json.hpp"
#include "obs-mapping/selection.hpp"
#include "plugin-support.h"

namespace {

constexpr const char *kVendorName = "obs-mapping";

obs_websocket_vendor g_vendor = nullptr;

struct SourceRef {
	obs_source_t *source = nullptr;
	explicit SourceRef(const char *name) : source(obs_get_source_by_name(name)) {}
	~SourceRef() { obs_source_release(source); }
	SourceRef(const SourceRef &) = delete;
	SourceRef &operator=(const SourceRef &) = delete;
};

void respond_error(obs_data_t *response, const std::string &message)
{
	obs_data_set_bool(response, "ok", false);
	obs_data_set_string(response, "error", message.c_str());
}

void respond_ok(obs_data_t *response)
{
	obs_data_set_bool(response, "ok", true);
}

// Runs `fn(MappingSource&)` for request.sourceName; replies with an error if it is not a Mapping source.
template<typename Fn> void with_mapping_source(obs_data_t *request, obs_data_t *response, Fn fn)
{
	const std::string name = obs_data_get_string(request, "sourceName");
	SourceRef ref(name.c_str());
	if (!ref.source)
		return respond_error(response, "source not found: " + name);
	MappingSource *ms = mapping_source_from(ref.source);
	if (!ms)
		return respond_error(response, "not a mapping source: " + name);
	fn(*ms);
}

bool collect_mapping_source(void *param, obs_source_t *source)
{
	auto *out = static_cast<obs_data_array_t *>(param);
	if (obs_source_get_type(source) != OBS_SOURCE_TYPE_INPUT)
		return true;
	MappingSource *ms = mapping_source_from(source);
	if (!ms)
		return true;
	obs_data_t *item = obs_data_create();
	obs_data_set_string(item, "name", obs_source_get_name(source));
	obs_data_set_int(item, "width", ms->width());
	obs_data_set_int(item, "height", ms->height());
	obs_data_array_push_back(out, item);
	obs_data_release(item);
	return true;
}

void list_mapping_sources(obs_data_t *, obs_data_t *response, void *)
{
	obs_data_array_t *sources = obs_data_array_create();
	obs_enum_sources(collect_mapping_source, sources);
	obs_data_set_array(response, "sources", sources);
	obs_data_array_release(sources);
	respond_ok(response);
}

void get_mapping(obs_data_t *request, obs_data_t *response, void *)
{
	with_mapping_source(request, response, [&](MappingSource &ms) {
		const std::string json = obs_mapping::serialize_mapping(ms.current());
		obs_data_set_string(response, "mappingJson", json.c_str());
		obs_data_set_bool(response, "overlayEnabled", ms.overlay_enabled());
		respond_ok(response);
	});
}

void set_mapping(obs_data_t *request, obs_data_t *response, void *)
{
	with_mapping_source(request, response, [&](MappingSource &ms) {
		if (!obs_data_has_user_value(request, "mappingJson"))
			return respond_error(response, "mappingJson: missing");
		if (auto applied = ms.set_mapping_json(obs_data_get_string(request, "mappingJson")); !applied)
			return respond_error(response, applied.error().message);
		respond_ok(response);
	});
}

void set_overlay(obs_data_t *request, obs_data_t *response, void *)
{
	with_mapping_source(request, response, [&](MappingSource &ms) {
		OverlayState state;
		// `enabled` is optional: absent keeps the current flag and only the selection is updated.
		std::optional<bool> enabled;
		if (obs_data_has_user_value(request, "enabled"))
			enabled = obs_data_get_bool(request, "enabled");

		// An absent selectionJson means an empty selection.
		if (obs_data_has_user_value(request, "selectionJson")) {
			auto selection = obs_mapping::parse_selection(obs_data_get_string(request, "selectionJson"));
			if (!selection)
				return respond_error(response, selection.error().message);
			state.selected_surface_ids = std::move(selection->surface_ids);
			state.selected_corner = std::move(selection->corner);
		}

		ms.set_overlay(std::move(state), enabled);
		respond_ok(response);
	});
}

void emit_mapping_changed(MappingSource &ms)
{
	if (!g_vendor)
		return;
	const std::string json = obs_mapping::serialize_mapping(ms.current());
	obs_data_t *event = obs_data_create();
	obs_data_set_string(event, "sourceName", obs_source_get_name(ms.source));
	obs_data_set_string(event, "mappingJson", json.c_str());
	obs_data_set_bool(event, "overlayEnabled", ms.overlay_enabled());
	obs_websocket_vendor_emit_event(g_vendor, "MappingChanged", event);
	obs_data_release(event);
}

void emit_overlay_changed(MappingSource &ms)
{
	if (!g_vendor)
		return;
	obs_data_t *event = obs_data_create();
	obs_data_set_string(event, "sourceName", obs_source_get_name(ms.source));
	obs_data_set_bool(event, "enabled", ms.overlay_enabled());
	obs_websocket_vendor_emit_event(g_vendor, "OverlayChanged", event);
	obs_data_release(event);
}

} // namespace

void register_vendor()
{
	g_vendor = obs_websocket_register_vendor(kVendorName);
	if (!g_vendor) {
		obs_log(LOG_WARNING, "obs-websocket not found; the %s vendor API is unavailable", kVendorName);
		return;
	}

	struct Request {
		const char *type;
		obs_websocket_request_callback_function callback;
	};
	const Request requests[] = {
		{"ListMappingSources", list_mapping_sources},
		{"GetMapping", get_mapping},
		{"SetMapping", set_mapping},
		{"SetOverlay", set_overlay},
	};
	for (const Request &r : requests) {
		if (!obs_websocket_vendor_register_request(g_vendor, r.type, r.callback, nullptr))
			obs_log(LOG_WARNING, "failed to register vendor request %s", r.type);
	}

	set_on_mapping_changed(emit_mapping_changed);
	set_on_overlay_changed(emit_overlay_changed);
	obs_log(LOG_INFO, "obs-websocket vendor \"%s\" registered", kVendorName);
}

void unregister_vendor()
{
	set_on_mapping_changed(nullptr);
	set_on_overlay_changed(nullptr);
	g_vendor = nullptr;
}
