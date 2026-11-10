#include "mapping-dock.hpp"

#include <obs-frontend-api.h>
#include <obs-module.h>
#include <obs.hpp>
#include <util/util.hpp>

#include <QDockWidget>
#include <QMainWindow>
#include <QString>
#include <QUrl>
#include <QVBoxLayout>
#include <QWidget>

#include <optional>
#include <string>

#include <obs-browser/browser-panel.hpp>

#include "plugin-support.h"

namespace {

constexpr const char *kDockId = "surface-mapper";
constexpr const char *kDockTitle = "Surface Mapper";
// Relative to obs-browser's cookie root, like OBS's own "obs_profile_cookies/<id>".
constexpr const char *kCookieStoragePath = "surface_mapper_dock";
constexpr const char *kRevealFlagFile = "dock.json";
constexpr const char *kRevealedKey = "revealed";

QCef *g_cef = nullptr;
QWidget *g_container = nullptr;
QCefCookieManager *g_cookies = nullptr;
QCefWidget *g_browser = nullptr;
bool g_event_callback_registered = false;

QWidget *create_container()
{
	auto *container = new QWidget();
	auto *layout = new QVBoxLayout(container);
	layout->setContentsMargins(0, 0, 0, 0);
	return container;
}

std::optional<std::string> ui_url()
{
	BPtr<char> path = obs_module_file("ui/index.html");
	if (!path)
		return std::nullopt;
	return QUrl::fromLocalFile(QString::fromUtf8(path.Get())).toString(QUrl::FullyEncoded).toStdString();
}

bool ensure_browser_initialized()
{
	return g_cef->init_browser() || g_cef->wait_for_browser_init();
}

bool attach_browser()
{
	if (!g_container)
		return false;
	if (g_browser)
		return true;
	const auto url = ui_url();
	if (!url) {
		obs_log(LOG_WARNING, "ui/index.html not found; dock left empty");
		return false;
	}
	if (!ensure_browser_initialized()) {
		obs_log(LOG_WARNING, "browser init failed; dock left empty");
		return false;
	}
	g_cookies = g_cef->create_cookie_manager(kCookieStoragePath, true);
	if (!g_cookies)
		obs_log(LOG_WARNING, "cookie manager unavailable; dock settings will not persist");
	g_browser = g_cef->create_widget(g_container, *url, g_cookies);
	if (!g_browser) {
		obs_log(LOG_WARNING, "browser widget creation failed; dock left empty");
		return false;
	}
	g_container->layout()->addWidget(g_browser);
	return true;
}

// Mirrors OBSBasic's shutdown: close the browser, flush and drop cookies, then drop QCef.
void release_browser()
{
	if (g_browser) {
		g_browser->closeBrowser();
		delete g_browser;
		g_browser = nullptr;
	}
	if (g_cookies) {
		g_cookies->FlushStore();
		delete g_cookies;
		g_cookies = nullptr;
	}
	delete g_cef;
	g_cef = nullptr;
	g_container = nullptr;
}

bool is_already_revealed(const char *flag_path)
{
	OBSDataAutoRelease flag = obs_data_create_from_json_file_safe(flag_path, "bak");
	return flag && obs_data_get_bool(flag, kRevealedKey);
}

void save_revealed_flag(const char *flag_path)
{
	BPtr<char> dir = obs_module_config_path("");
	if (dir)
		os_mkdirs(dir.Get());
	OBSDataAutoRelease flag = obs_data_create();
	obs_data_set_bool(flag, kRevealedKey, true);
	if (!obs_data_save_json_safe(flag, flag_path, "tmp", "bak"))
		obs_log(LOG_WARNING, "could not save %s; the dock will be revealed again next launch", flag_path);
}

void dock_on_right_side(QDockWidget *dock)
{
	auto *main_window = static_cast<QMainWindow *>(obs_frontend_get_main_window());
	main_window->addDockWidget(Qt::RightDockWidgetArea, dock);
	dock->setFloating(false);
	dock->show();
}

void reveal_dock_on_first_run()
{
	QDockWidget *dock = mapping_dock_widget();
	if (!dock)
		return;
	BPtr<char> flag_path = obs_module_config_path(kRevealFlagFile);
	if (!flag_path || is_already_revealed(flag_path.Get()))
		return;
	dock_on_right_side(dock);
	save_revealed_flag(flag_path.Get());
}

void on_frontend_event(enum obs_frontend_event event, void *);

void remove_event_callback()
{
	if (!g_event_callback_registered)
		return;
	g_event_callback_registered = false;
	obs_frontend_remove_event_callback(on_frontend_event, nullptr);
}

void on_frontend_event(enum obs_frontend_event event, void *)
{
	switch (event) {
	case OBS_FRONTEND_EVENT_FINISHED_LOADING:
		if (attach_browser())
			reveal_dock_on_first_run();
		break;
	case OBS_FRONTEND_EVENT_EXIT:
		release_browser();
		remove_event_callback();
		break;
	default:
		break;
	}
}

} // namespace

void register_mapping_dock()
{
	g_cef = obs_browser_init_panel();
	if (!g_cef) {
		obs_log(LOG_WARNING, "obs-browser unavailable; dock disabled");
		return;
	}
	QWidget *container = create_container();
	if (!obs_frontend_add_dock_by_id(kDockId, kDockTitle, container)) {
		obs_log(LOG_WARNING, "dock id '%s' already registered; dock disabled", kDockId);
		delete container;
		delete g_cef;
		g_cef = nullptr;
		return;
	}
	g_container = container;
	if (QDockWidget *dock = mapping_dock_widget())
		dock->setAttribute(Qt::WA_NativeWindow);
	obs_frontend_add_event_callback(on_frontend_event, nullptr);
	g_event_callback_registered = true;
}

void unregister_mapping_dock()
{
	remove_event_callback();
}

QDockWidget *mapping_dock_widget()
{
	if (!g_container)
		return nullptr;
	return qobject_cast<QDockWidget *>(g_container->parentWidget());
}
