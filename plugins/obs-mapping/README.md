# obs-mapping plugin

Claude Code skills for using [obs-mapping](https://github.com/naporin0624/obs-mapping) — an OBS Studio plugin whose Mapping source warps other OBS sources onto quads for projection and LED mapping, controlled by a dock over obs-websocket.

## Install

### Claude Code (plugin)

```
/plugin marketplace add naporin0624/obs-mapping
/plugin install obs-mapping@obs-mapping
```

### Any other agent (Skills CLI)

Works with Codex, GitHub Copilot, Amp, Cursor, Antigravity, and others via [skills.sh](https://skills.sh/naporin0624/obs-mapping). **Install one skill per command** — passing several at once only installs the first:

```bash
npx skills add naporin0624/obs-mapping@driving-obs-mapping-over-websocket
npx skills add naporin0624/obs-mapping@writing-mapping-json
npx skills add naporin0624/obs-mapping@mapping-led-pixel-maps
```

Add `-g` to install globally instead of into the current project.

## Skills

Skills activate automatically from conversation context — no commands to learn.

| Skill | Fires when you ask about |
|-------|--------------------------|
| `driving-obs-mapping-over-websocket` | Reading or changing a Mapping source from a script or agent: the `obs-mapping` vendor requests (`ListMappingSources` / `GetMapping` / `SetMapping` / `SetOverlay`), `MappingChanged` / `OverlayChanged` events, creating the source, `ok: false` replies, verifying with screenshots and scene item transforms |
| `writing-mapping-json` | Authoring or reviewing mapping JSON v2: surfaces, `crop` vs `corners`, ellipse / polygon masks, groups and layers, and the plugin's path-prefixed validation errors |
| `mapping-led-pixel-maps` | Turning an LED pixel-map chart into a mapping: canvas = processor input, one surface per screen, round-screen masks, and crop recipes (pixel-for-pixel, centre cut, full squeeze) |

## Requirements

- OBS Studio 28+ with obs-websocket enabled (Tools > WebSocket Server Settings)
- obs-mapping installed (see the [repository README](https://github.com/naporin0624/obs-mapping#readme))
