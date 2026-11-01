#include <obs-module.h>

#include "mapping-source.hpp"
#include "plugin-support.h"

OBS_DECLARE_MODULE()
OBS_MODULE_USE_DEFAULT_LOCALE(PLUGIN_NAME, "en-US")

bool obs_module_load(void)
{
	obs_register_source(&mapping_source_info);
	// obs_log prefixes "[obs-mapping]" (PLUGIN_NAME).
	obs_log(LOG_INFO, "loaded");
	return true;
}

void obs_module_unload(void)
{
	obs_log(LOG_INFO, "unloaded");
}
