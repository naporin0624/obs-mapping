# Surface Mapper plugin

Claude Code skills for using [Surface Mapper](https://github.com/naporin0624/surface-mapper) — an OBS Studio plugin whose Mapping source warps other OBS sources onto quads for projection and LED mapping, controlled by a dock over obs-websocket.

## Install

### Claude Code (plugin)

```
/plugin marketplace add naporin0624/surface-mapper
/plugin install surface-mapper@surface-mapper
```

### Any other agent (Skills CLI)

Works with Codex, GitHub Copilot, Amp, Cursor, Antigravity, and others via [skills.sh](https://skills.sh/naporin0624/surface-mapper). **Install one skill per command** — passing several at once only installs the first:

```bash
npx skills add naporin0624/surface-mapper@driving-surface-mapper-over-websocket
npx skills add naporin0624/surface-mapper@writing-mapping-json
npx skills add naporin0624/surface-mapper@mapping-led-pixel-maps
```

Add `-g` to install globally instead of into the current project.

## Skills

Skills activate automatically from conversation context — no commands to learn.

| Skill | Fires when you ask about |
|-------|--------------------------|
| `driving-surface-mapper-over-websocket` | Reading or changing a Mapping source from a script or agent: the `surface-mapper` vendor requests (`ListMappingSources` / `GetMapping` / `SetMapping` / `SetOverlay`), `MappingChanged` / `OverlayChanged` events, creating the source, `ok: false` replies, verifying with screenshots and scene item transforms |
| `writing-mapping-json` | Authoring or reviewing mapping JSON v2: surfaces, `crop` vs `corners`, ellipse / polygon masks, groups and layers, and the plugin's path-prefixed validation errors |
| `mapping-led-pixel-maps` | Turning an LED pixel-map chart into a mapping: canvas = processor input, one surface per screen, round-screen masks, and crop recipes (pixel-for-pixel, centre cut, full squeeze) |

## Requirements

- OBS Studio 28+ with obs-websocket enabled (Tools > WebSocket Server Settings)
- Surface Mapper installed (see the [repository README](https://github.com/naporin0624/surface-mapper#readme))
