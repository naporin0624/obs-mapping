---
name: upgrading-from-0-6
description: Use when updating from obs-mapping (0.6.x or earlier) to Surface Mapper (0.7.0 or later) and existing Mapping sources broke — a Mapping source shows an error, appears as a missing or unknown source type, or its mapping disappeared after the update, a scene collection JSON still references "obs_mapping_source", or a CallVendorRequest to vendor "obs-mapping" fails.
---

# Upgrading from 0.6.x

## Overview

0.7.0 renamed the plugin from obs-mapping to Surface Mapper and changed its identifiers. OBS stores each source with its type id, so scene collections saved by 0.6.x still point at `obs_mapping_source`, a type that no longer exists — OBS keeps the source but cannot load it. The settings keys (`mapping_json`, `mapping_json_last_valid`, `overlay`) and the mapping JSON format did not change, so renaming the type id restores the sources with their mappings intact.

| | obs-mapping (≤ 0.6.x) | Surface Mapper (≥ 0.7.0) |
|---|---|---|
| Source type id (`id`, `versioned_id`) | `obs_mapping_source` | `surface_mapper_source` |
| obs-websocket vendor name | `obs-mapping` | `surface-mapper` |
| Plugin folder | `obs-mapping` / `obs-mapping.plugin` | `surface-mapper` / `surface-mapper.plugin` |

The installers already remove the old plugin folder. Scene collections and external scripts need the steps below.

## Where the scene collections are

| OS | Folder |
|---|---|
| macOS | `~/Library/Application Support/obs-studio/basic/scenes/*.json` |
| Windows | `%APPDATA%\obs-studio\basic\scenes\*.json` |
| Other / portable OBS | Pass the folder as an argument to the script |

## Procedure

`scripts/migrate.py` (in this skill's folder) is Python 3, standard library only. It rewrites every `id` / `versioned_id` equal to `obs_mapping_source` in every `*.json` of the folder, and nothing else.

1. **Quit OBS.** OBS rewrites the current scene collection when it quits, which would undo the migration. The script refuses `--apply` while OBS is running.
2. **Dry run** — lists each file to change, the number of fields, and the Mapping source names:
   - macOS: `python3 scripts/migrate.py`
   - Windows: `py scripts\migrate.py`
   - Other folder: `python3 scripts/migrate.py /path/to/basic/scenes`
3. **Apply** — the same command with `--apply`. Each changed file is first copied to `<name>.json.pre-surface-mapper-<YYYYmmdd-HHMMSS>.bak`.
4. **Start OBS and verify**: the Mapping sources load, their properties show the mapping, and the dock lists them.

To roll back, quit OBS and copy the `.bak` over the `.json` (drop the `.pre-surface-mapper-….bak` suffix).

The script never touches `mapping_json` or any other setting, and it is idempotent: running it again reports `Nothing to migrate.`

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Sources still missing after `--apply` | OBS was running and overwrote the file on quit. Quit OBS, restore the `.bak`, run `--apply` again |
| Source loads but draws nothing | Each surface's `source` is an OBS source **name**; it no longer matches a current input. Rename the input back or fix `source` (see `writing-mapping-json`) |
| External scripts / agents fail | They still call vendor `obs-mapping` or create `obs_mapping_source`. Use `surface-mapper` and `surface_mapper_source` (see `driving-surface-mapper-over-websocket`) |
| Dry run lists nothing but sources are broken | Wrong folder (portable OBS, other profile path). Pass the folder that holds the collection's `.json` |
