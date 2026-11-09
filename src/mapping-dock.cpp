#include "mapping-dock.hpp"

#include <obs-frontend-api.h>
#include <obs-module.h>
#include <util/util.hpp>

#include <QDockWidget>
#include <QString>
#include <QUrl>
#include <QVBoxLayout>
#include <QWidget>

#include <optional>
#include <string>

#include <obs-browser/browser-panel.hpp>

#include "plugin-support.h"

namespace {

constexpr const char *kDockId = "obs-mapping";
constexpr const char *kDockTitle = "OBS Mapping";
// Relative to obs-browser's cookie root, like OBS's own "obs_profile_cookies/<id>".
constexpr const char *kCookieStoragePath = "obs_mapping_dock";

QCef *g_cef = nullptr;
QWidget *g_container = nullptr;
QCefCookieManager *g_cookies = nullptr;
QCefWidget *g_browser = nullptr;

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

void attach_browser()
{
	if (!g_container || g_browser)
		return;
	const auto url = ui_url();
	if (!url) {
		obs_log(LOG_WARNING, "ui/index.html not found; dock left empty");
		return;
	}
	if (!ensure_browser_initialized()) {
		obs_log(LOG_WARNING, "browser init failed; dock left empty");
		return;
	}
	g_cookies = g_cef->create_cookie_manager(kCookieStoragePath, true);
	if (!g_cookies)
		obs_log(LOG_WARNING, "cookie manager unavailable; dock settings will not persist");
	g_browser = g_cef->create_widget(g_container, *url, g_cookies);
	g_container->layout()->addWidget(g_browser);
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

void on_frontend_event(enum obs_frontend_event event, void *)
{
	switch (event) {
	case OBS_FRONTEND_EVENT_FINISHED_LOADING:
		attach_browser();
		break;
	case OBS_FRONTEND_EVENT_EXIT:
		release_browser();
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
	obs_frontend_add_event_callback(on_frontend_event, nullptr);
}

void unregister_mapping_dock()
{
	obs_frontend_remove_event_callback(on_frontend_event, nullptr);
}

QDockWidget *mapping_dock_widget()
{
	if (!g_container)
		return nullptr;
	return qobject_cast<QDockWidget *>(g_container->parentWidget());
}
