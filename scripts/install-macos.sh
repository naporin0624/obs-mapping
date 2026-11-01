#!/usr/bin/env bash
# Install the built obs-mapping.plugin into the user's OBS plugin directory.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="${root}/build_macos/RelWithDebInfo/obs-mapping.plugin"
dest_dir="${HOME}/Library/Application Support/obs-studio/plugins"

# Build the UI first: it is emitted to data/ui, which the cmake build copies into Contents/Resources/ui.
pnpm -C "${root}/ui" install --frozen-lockfile
pnpm -C "${root}/ui" build

if [[ ! -d "${src}" ]]; then
	echo "not found: ${src} (run: cmake --preset macos && cmake --build --preset macos)" >&2
	exit 1
fi

mkdir -p "${dest_dir}"
rm -rf "${dest_dir}/obs-mapping.plugin"
cp -R "${src}" "${dest_dir}/"
echo "installed: ${dest_dir}/obs-mapping.plugin"
