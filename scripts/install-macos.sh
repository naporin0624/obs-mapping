#!/usr/bin/env bash
# Install the built obs-mapping.plugin into the user's OBS plugin directory.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="${root}/build_macos/RelWithDebInfo/obs-mapping.plugin"
dest_dir="${HOME}/Library/Application Support/obs-studio/plugins"

# Order matters: the UI is emitted to data/ui, and cmake copies data/ into Contents/Resources.
pnpm -C "${root}/ui" install --frozen-lockfile
pnpm -C "${root}/ui" build
(cd "${root}" && cmake --preset macos && cmake --build --preset macos)

if [[ ! -d "${src}" ]]; then
	echo "not found: ${src} (the cmake build did not produce the plugin)" >&2
	exit 1
fi
if [[ ! -f "${src}/Contents/Resources/ui/index.html" ]]; then
	echo "UI missing from the bundle: ${src}/Contents/Resources/ui/index.html" >&2
	exit 1
fi

mkdir -p "${dest_dir}"
rm -rf "${dest_dir}/obs-mapping.plugin"
cp -R "${src}" "${dest_dir}/"
echo "installed: ${dest_dir}/obs-mapping.plugin"
