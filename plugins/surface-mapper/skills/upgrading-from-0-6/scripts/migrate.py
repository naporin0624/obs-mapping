#!/usr/bin/env python3
"""Rename obs-mapping sources to Surface Mapper in OBS scene collections.

Dry run by default. Pass --apply (with OBS closed) to write the files.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

OLD_ID = "obs_mapping_source"
NEW_ID = "surface_mapper_source"
ID_KEYS = ("id", "versioned_id")
BACKUP_INFIX = ".pre-surface-mapper-"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scenes_dir", nargs="?", type=Path, help="scene collection folder (default: OBS's)")
    parser.add_argument("--apply", action="store_true", help="write changes (OBS must be closed)")
    return parser.parse_args()


def default_scenes_dir():
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/obs-studio/basic/scenes"
    if sys.platform == "win32":
        return Path(os.environ["APPDATA"]) / "obs-studio/basic/scenes"
    return None


def iter_dicts(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from iter_dicts(value)
    elif isinstance(node, list):
        for item in node:
            yield from iter_dicts(item)


def migrate_document(doc):
    """Rename ids in place. Returns (replaced field count, names of the migrated sources)."""
    count = 0
    names = []
    for obj in iter_dicts(doc):
        keys = [key for key in ID_KEYS if obj.get(key) == OLD_ID]
        for key in keys:
            obj[key] = NEW_ID
        count += len(keys)
        if keys:
            names.append(str(obj.get("name", "?")))
    return count, names


def load_json(path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def write_json(path, doc):
    # Write next to the target, then swap, so a crash never leaves a half-written collection.
    tmp = path.with_name(path.name + ".tmp")
    with tmp.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=4, ensure_ascii=False)
    os.replace(tmp, path)


def backup(path, stamp):
    target = path.with_name(f"{path.name}{BACKUP_INFIX}{stamp}.bak")
    shutil.copy2(path, target)
    return target


def run_quiet(command):
    """Returns stdout, or None if the command is unavailable."""
    try:
        result = subprocess.run(command, capture_output=True, text=True, errors="replace")
    except OSError:
        return None
    return result.stdout if result.returncode in (0, 1) else None


def obs_running():
    """True / False, or None when it cannot be checked."""
    if sys.platform == "darwin":
        out = run_quiet(["pgrep", "-x", "OBS"])
        return None if out is None else out.strip() != ""
    if sys.platform == "win32":
        out = run_quiet(["tasklist", "/FI", "IMAGENAME eq obs64.exe", "/NH"])
        return None if out is None else "obs64.exe" in out.lower()
    return None


def ensure_obs_closed():
    running = obs_running()
    if running:
        print("OBS is running. Quit OBS first: it rewrites scene collections on exit.", file=sys.stderr)
        sys.exit(1)
    if running is None:
        print("warning: could not check for OBS. Make sure it is closed.", file=sys.stderr)


def resolve_scenes_dir(arg):
    scenes_dir = arg or default_scenes_dir()
    if scenes_dir is None:
        print("error: unknown platform. Pass the scene collection folder as an argument.", file=sys.stderr)
        sys.exit(2)
    if not scenes_dir.is_dir():
        print(f"error: folder not found: {scenes_dir}", file=sys.stderr)
        sys.exit(2)
    return scenes_dir


def migrate_file(path, apply, stamp):
    """Returns True if the file needed changes."""
    try:
        doc = load_json(path)
    except (OSError, ValueError) as e:
        print(f"skip {path.name}: {e}", file=sys.stderr)
        return False
    count, names = migrate_document(doc)
    if count == 0:
        return False
    print(f"{path.name}: {count} field(s); Mapping sources: {', '.join(names)}")
    if apply:
        print(f"  backup: {backup(path, stamp).name}")
        write_json(path, doc)
    return True


def main():
    # Source names can contain characters the Windows console code page cannot print.
    sys.stdout.reconfigure(errors="replace")
    args = parse_args()
    scenes_dir = resolve_scenes_dir(args.scenes_dir)
    if args.apply:
        ensure_obs_closed()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    print(f"Scene collections: {scenes_dir}")
    changed = [p for p in sorted(scenes_dir.glob("*.json")) if migrate_file(p, args.apply, stamp)]
    if not changed:
        print("Nothing to migrate.")
    elif args.apply:
        print(f"Migrated {len(changed)} file(s). Start OBS and check the Mapping sources.")
    else:
        print(f"Dry run: {len(changed)} file(s) to migrate. Quit OBS, then re-run with --apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
