#include <obs-module.h>

#include "mapping-dock.hpp"
#include "mapping-source.hpp"
#include "plugin-support.h"
#include "vendor-api.hpp"

OBS_DECLARE_MODULE()
OBS_MODULE_USE_DEFAULT_LOCALE(PLUGIN_NAME, "en-US")

bool obs_module_load(void)
{
	obs_register_source(&mapping_source_info);
	// obs_log prefixes "[obs-mapping]" (PLUGIN_NAME).
	obs_log(LOG_INFO, "loaded");
	return true;
}

void obs_module_post_load(void)
{
	register_vendor();
	register_mapping_dock();
}

void obs_module_unload(void)
{
	unregister_mapping_dock();
	unregister_vendor();
	obs_log(LOG_INFO, "unloaded");
}
