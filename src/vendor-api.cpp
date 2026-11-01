#include "vendor-api.hpp"

#include <obs-module.h>

#include <cassert>
#include <cstring>

#include <string>

#include <obs-websocket-api.h>

#include "mapping-source.hpp"
#include "obs-mapping/mapping_json.hpp"
#include "obs-mapping/wire.hpp"
#include "plugin-support.h"

namespace {

constexpr const char *kVendorName = "obs-mapping";

obs_websocket_vendor g_vendor = nullptr;

// Wire notes (see obs-mapping/wire.hpp): obs_data cannot hold arrays of arrays or arrays of strings,
// so `corners` travels as [{x, y}] and `selectedSurfaceIds` as [{id}].

struct SourceRef {
	obs_source_t *source = nullptr;
	explicit SourceRef(const char *name) : source(obs_get_source_by_name(name)) {}
	~SourceRef() { obs_source_release(source); }
	SourceRef(const SourceRef &) = delete;
	SourceRef &operator=(const SourceRef &) = delete;
};

struct DataRef {
	obs_data_t *data = nullptr;
	explicit DataRef(obs_data_t *d) : data(d) {}
	~DataRef() { obs_data_release(data); }
	DataRef(const DataRef &) = delete;
	DataRef &operator=(const DataRef &) = delete;
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

// Wire-form object for a mapping. Null only if the JSON text cannot be turned into obs_data.
obs_data_t *mapping_to_obs_data(const obs_mapping::Mapping &mapping)
{
	const std::string wire = obs_mapping::mapping_json_to_wire(obs_mapping::serialize_mapping(mapping));
	return obs_data_create_from_json(wire.c_str());
}

// Runs `fn(MappingSource&)` for request.sourceName; replies with an error if it is not a Mapping source.
template <typename Fn>
void with_mapping_source(obs_data_t *request, obs_data_t *response, Fn fn)
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
		obs_data_t *mapping = mapping_to_obs_data(ms.current());
		if (!mapping)
			return respond_error(response, "mapping: could not be encoded");
		obs_data_set_obj(response, "mapping", mapping);
		obs_data_release(mapping);
		respond_ok(response);
	});
}

void set_mapping(obs_data_t *request, obs_data_t *response, void *)
{
	with_mapping_source(request, response, [&](MappingSource &ms) {
		DataRef mapping(obs_data_get_obj(request, "mapping"));
		if (!mapping.data)
			return respond_error(response, "mapping: missing");
		const std::string wire = obs_data_get_json(mapping.data);
		if (auto applied = ms.set_mapping_json(obs_mapping::wire_to_mapping_json(wire)); !applied)
			return respond_error(response, applied.error().message);
		respond_ok(response);
	});
}

void set_overlay(obs_data_t *request, obs_data_t *response, void *)
{
	with_mapping_source(request, response, [&](MappingSource &ms) {
		OverlayState state;
		state.enabled = obs_data_get_bool(request, "enabled");

		if (obs_data_array_t *ids = obs_data_get_array(request, "selectedSurfaceIds")) {
			for (size_t i = 0, n = obs_data_array_count(ids); i < n; ++i) {
				obs_data_t *item = obs_data_array_item(ids, i);
				state.selected_surface_ids.emplace_back(obs_data_get_string(item, "id"));
				obs_data_release(item);
			}
			obs_data_array_release(ids);
		}

		// JSON null arrives as an absent key.
		DataRef corner(obs_data_get_obj(request, "selectedCorner"));
		if (corner.data) {
			const int index = static_cast<int>(obs_data_get_int(corner.data, "index"));
			if (index < 0 || index > 3)
				return respond_error(response, "selectedCorner.index: expected 0..3");
			state.selected_corner.emplace(obs_data_get_string(corner.data, "surfaceId"), index);
		}

		ms.set_overlay(std::move(state));
		respond_ok(response);
	});
}

void emit_mapping_changed(MappingSource &ms)
{
	if (!g_vendor)
		return;
	obs_data_t *mapping = mapping_to_obs_data(ms.current());
	if (!mapping)
		return;
	obs_data_t *event = obs_data_create();
	obs_data_set_string(event, "sourceName", obs_source_get_name(ms.source));
	obs_data_set_obj(event, "mapping", mapping);
	obs_websocket_vendor_emit_event(g_vendor, "MappingChanged", event);
	obs_data_release(event);
	obs_data_release(mapping);
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
	obs_log(LOG_INFO, "obs-websocket vendor \"%s\" registered", kVendorName);
}

void unregister_vendor()
{
	set_on_mapping_changed(nullptr);
	g_vendor = nullptr;
}
