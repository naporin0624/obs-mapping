# グループと Auto Layout 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 面を入れ子のグループにまとめ、グループに flex 風の並べ方（direction / gap / align / padding）を持たせて自動で並べ直す。保存形式は mapping JSON v2 にし、v1 も読めるようにする。

**Architecture:** 正となる状態は、これまでどおりプラグインの `mapping_json` が持つ。v2 では `surfaces` をフラットな絶対座標のまま残し、木構造は `groups` と `layers` が持つ。レイアウトの計算は、ドックの純粋関数 `layoutTree` だけが行う。reducer はローカル編集のコミットのたびにこれを通す。プラグイン（C++ core）は v2 を厳しく検証し、祖先グループの表示状態から実際の表示を決めて描くだけにする。レイアウトは計算しない。作業は 4 つの PR に分け、どの PR を merge しても main は green で出荷できる状態に保つ。

**Tech Stack:**
- プラグイン: C++23（`std::expected`）、nlohmann/json 3.11.3、doctest 2.4.11、libobs
- UI: React 19、Jotai 3、react-aria-components 1.22.1、Panda CSS（`styles.css.ts`）、Vite（`data/ui` に IIFE で出力）、vitest 5、tsgo（`@typescript/native-preview`）、oxlint、oxfmt

**Spec:** `docs/superpowers/specs/2026-11-02-groups-auto-layout-design.md`。日本語で書かれており、この計画より優先する。「ユーザーが決めたこと」と「実装前に決めたこと」は確定事項として扱う。

## Global Constraints

- パッケージ管理は pnpm。`pnpm -C ui test`、`pnpm -C ui lint`（警告 0）、`pnpm -C ui typecheck`、`pnpm -C ui build` がすべて通ること。`data/ui` の出力は classic script のままにする（`vite.config.ts` の `classicScript` のチェックを壊さない）。
- 型検査は tsgo（`pnpm -C ui typecheck` = `tsgo --noEmit`）。
- vitest で red-first の TDD を行う。DOM が要るテストはファイル先頭に `// @vitest-environment jsdom` を書く。
- `oxlint-disable` は使わない。lint に引っかかったら関数を分割する。
- 関数は単一責任にする。コメントは必要なときだけ、3 行以内。変更の意図はコードに書かない（git blame で辿る）。
- 暗黙の副作用を作らない。コンストラクタと getter は何もしない。購読、タイマー、I/O は利用側がつなぐ。
- コンポーネントの状態は Jotai の atom から `useAtomValue` / `useSetAtom` で読む。`useReducer`、Context、`useStore` は使わない。既存の `EditorBody` → 子コンポーネントの props の流れは変えない。
- UI は HTML + CSS で作り、難しい場合だけ react-aria-components を使う。WCAG 2.1 AA を満たす。リンクは react-aria-components の `Link` を使う。
- コンポーネントのディレクトリは kebab-case で、`index.tsx`、`styles.css.ts`、`index.test.tsx` を置く。新しいコンポーネントは colophon（`ui/src/colophon/colophon/index.tsx`）にも追加し、colophon のリンクは `onClick={(e) => e.preventDefault()}` で何もしないようにする。
- 新しく足す画面の文言は日本語で、コードに直接書く（i18n はしない）。
- Stage の選択は Figma と同じにする（Task 15）。選択に足すのは Shift+クリックだけにする。今の Cmd+クリックで選択に足す動きはなくなるので、README と `docs/manual-checks.md` に書く。
- C++ は clang-format 19 で整形する。core のテストは `cmake -S core -B build_core -DOBS_MAPPING_TESTS=ON && cmake --build build_core && ctest --test-dir build_core` で実行する。macOS のプラグインは `cmake --preset macos && cmake --build --preset macos` でビルドする。
- commit はしない。各タスクの最後は「stage for review」（`git add` だけ）にする。
- spec の数値: `gap` と `padding` は 0〜4096。`direction` は `row` / `column`、`align` は `start` / `center` / `end`。木の深さは 16 まで（下の定義を参照）。JSON の小数は丸めない。
- 木の深さの定義: 最上位のノードを深さ 1 とし、グループの子は親の深さ + 1 とする。深さが 16 を超えるノードがあればエラーにする。
- TS の `Mapping` 型は、core の `serialize_mapping` が書き出すフィールドとちょうど同じにする。ドックだけが使うフィールド（開閉状態など）を `Mapping` に入れない。入れると echo が `canonicalJson` で一致しなくなり、resync が繰り返し起きる。
- `layoutTree` はローカル編集のコミットと、ドラッグ中のプレビュー（`replaceLive`）でだけ通す。`load`、`remote`、`resynced`、`undo`、`redo` では通さない。外部ツールが書き換えた座標は、次にドックで編集したときに直る（spec の「一貫性の責任」）。

## Review Focus

1. **浮動小数で冪等が崩れて送信が止まらない。** 0.1 刻みの座標を持つグループを 1 回編集したとき、送信は 1 回だけになるべき。→ Task 6 に `layoutTree(layoutTree(m))` が `layoutTree(m)` と `toEqual` になるテストを、小数入力で置く。Task 7 に「レイアウト済みの mapping に対する no-op コミットが `s` をそのまま返す」テストを置く。
2. **グループ ID と面 ID の衝突。** グループの ID が `s-3` の v2 を import してから面を追加・複製しても、ID は重複せず、プラグインが拒否しないべき。→ Task 8 に、`freshId` が両方の名前空間を見るテストを置く。
3. **祖先が非表示の面が、Stage のプレビューで見えてしまう。** OBS で消えている面は、ドックのプレビューでも合成しないべき。→ Task 5 にテストを置く。
4. **入れ子のグループやグループ内の面への移動操作。** ダブルクリックで中に入って選んだ入れ子のグループを、Stage でドラッグする、矢印キーを押す、Align を押す。どれも何も起きず、位置がずれないべき。→ Task 10 と Task 16 にテストを置く。
5. **DnD で自分の子孫の中にグループを落とす。** 拒否され、木が壊れないべき。深さが 16 を超える落とし方も拒否されるべき。→ Task 11 に `canDrop` のテストを置く。

## PR の依存関係と衝突しそうな箇所

- **PR 1** は、fix/echo-request-id（#4）が merge された後の main から始める。その main には次のものがある前提で計画する。どれも PR 1 では形を変えずに使う。
  - `ui/src/editor/state.ts`: `InFlightEntry = { requestId: string; json: string }`。`EditorState.inFlight: readonly InFlightEntry[]`。
  - `ui/src/editor/reducer.ts`: `sent { requestId, json }`、`remote { mapping, requestId }`、`resynced`、`staleEcho`。
  - `ui/src/obs/client.ts`: `setMapping(source, mapping, requestId?)`。
  - `src/mapping-source.cpp`: `set_mapping_json(json, request_id)` と `notify_mapping_changed(ms, request_id)`。Task 2 では `make_snapshot` と `video_render` / `video_tick` だけを触る。
- **PR 2〜4** は、さらに次のブランチが merge された後の main に対して計画する。PR 2 を始める前に、それらが main に入っていることを確認する。
  - feat/snap-extended-edges: `geometry/snap.ts` の `GuideLine` と `SnapHit.guides`、`editor/drag.ts` の `snapTargets` / `Snapped` / `roundedCornerHit` / `roundedOffsetHit`、`use-stage-drag.ts` のガイド表示、`stage-overlay` のガイド描画。
  - feat/align-to-canvas: `geometry/align.ts` の `alignReference(ss, ids, canvas)` と、`alignSurfaces` の 4 番目の引数 `reference`。`toolbar/index.tsx` と `toolbar/index.test.tsx`。
  - feat/stage-underlay: `stage/index.tsx` の下敷きのレイヤーと、`editor/index.tsx` のツールバーにある下敷きのグループ。
  - feat/password-reveal: `connect-panel` だけなので、衝突しない。
- PR 2 は PR 1 に、PR 3 は PR 2 に、PR 4 は PR 3 に依存する。

## ファイル構成

| ファイル | 役割 | PR |
|---|---|---|
| `core/include/obs-mapping/model.hpp` | `Layout`、`Group`、`LayerNode` を足し、`Mapping` を v2 にする | 1 |
| `core/src/json_read.hpp`（新規、内部用） | `Fail`、`fail`、`require`、`number`、`str`、`join` を `mapping_json.cpp` から移す | 1 |
| `core/src/layers_json.hpp` / `.cpp`（新規、内部用） | `groups` と `layers` の parse・検証・serialize、`surfaces` の並び順の検査 | 1 |
| `core/include/obs-mapping/visibility.hpp` / `core/src/visibility.cpp`（新規） | `effective_visibility(const Mapping&)` | 1 |
| `src/draw-rules.hpp`、`src/mapping-source.{hpp,cpp}` | 実際の表示状態を snapshot に持たせ、描画で使う | 1 |
| `ui/src/model/mapping.ts` | v2 の型と `MappingV1` | 1 |
| `ui/src/model/layers.ts`（新規） | 木の純粋な操作（DFS、削除、挿入、移動、親の検索、子孫） | 1〜4 |
| `ui/src/model/read.ts`（新規） | JSON → v2 `Mapping` の構造検査と、v1 → v2 の変換 | 1 |
| `ui/src/model/validate-tree.ts`（新規） | core と同じ文言で、木の整合性を検査する | 1 |
| `ui/src/model/visibility.ts`（新規） | `effectiveVisibleIds(m)` | 1 |
| `ui/src/layout/frame.ts`（新規） | 各要素の大きさ、グループの外枠 | 2 |
| `ui/src/layout/layout-tree.ts`（新規） | `layoutTree(m)` | 2 |
| `ui/src/layout/follow-corner.ts`（新規） | 角がカーソルに付いていくための `origin` の補正 | 2 |
| `ui/src/layout/group-inference.ts`（新規） | Cmd+G のときの設定の推定 | 2 |
| `ui/src/editor/ids.ts`（新規） | 名前空間をまたいで重複しない ID を作る | 2 |
| `ui/src/editor/grouping.ts`、`ui/src/editor/structure.ts`（新規） | グループ化と解除、削除と複製 | 2 |
| `ui/src/editor/items.ts`（新規） | 移動できる要素（最上位の面とグループ）の解決と移動 | 2 |
| `ui/src/components/layer-tree/`（新規） | レイヤーの木（react-aria-components の Tree と DnD） | 3 |
| `ui/src/atoms/layers/index.ts`（新規） | 折りたたんだグループの集合（ドックの中だけ） | 3 |
| `ui/src/components/stage-group-frame/`（新規） | Stage に描くグループの外枠とハンドル | 4 |
| `ui/src/components/group-inspector/`（新規） | グループの設定 | 4 |

---

# PR 1: JSON v2 のモデルとプラグイン

この PR の後も、グループは編集できない。v1 の mapping は「すべての面が最上位に並ぶ v2」として読み込む。v2 の JSON を import したり外部ツールが書き込んだりすれば、グループを持つ mapping がドックに届く。そのため、木を保ったまま面を追加・削除・複製・並べ替えできるようにし、プレビューでも表示状態を正しく扱う。

### Task 1: core の v2 モデル、parse、厳しい検証、v1 からの変換、v2 での書き出し

**Files:**
- Modify: `core/include/obs-mapping/model.hpp`
- Create: `core/src/json_read.hpp`（`mapping_json.cpp` の無名名前空間にある補助関数を移す）
- Create: `core/src/layers_json.hpp`、`core/src/layers_json.cpp`
- Modify: `core/src/mapping_json.cpp`、`core/CMakeLists.txt`（`src/layers_json.cpp` を足す）
- Test: `core/tests/test_mapping_json.cpp`

**Interfaces:**
- Produces（`model.hpp`）:
  ```cpp
  enum class Direction { Row, Column };
  enum class Align { Start, Center, End };
  struct Layout { Direction direction = Direction::Row; double gap = 0; Align align = Align::Start; double padding = 0; bool operator==(const Layout &) const = default; };
  struct Group { std::string id, name; bool visible = true; Point origin; Layout layout; bool operator==(const Group &) const = default; };
  struct LayerNode { enum class Kind { Surface, Group } kind = Kind::Surface; std::string id; std::vector<LayerNode> children; bool operator==(const LayerNode &) const = default; };
  // Mapping: int version = 2; ... surfaces; std::vector<Group> groups; std::vector<LayerNode> layers;
  ```
- Produces（`layers_json.hpp`、`namespace obs_mapping::detail`）: `std::vector<Group> parse_groups(const nlohmann::json &, std::set<std::string> &ids)`、`std::vector<LayerNode> parse_layers(const nlohmann::json &, const Mapping &)`、`void check_surface_order(const Mapping &)`、`std::vector<LayerNode> flat_layers(const std::vector<Surface> &)`、`nlohmann::ordered_json groups_to_json(const std::vector<Group> &)`、`nlohmann::ordered_json layers_to_json(const std::vector<LayerNode> &)`。
- `parse_mapping` / `serialize_mapping` / `default_mapping` の宣言は変えない。`parse_mapping` が返す `Mapping` は常に `version == 2`。`serialize_mapping` は常に v2 を書き出す。

- [ ] **Step 1: 失敗するテストを書く。** `kValidV2` を足す（`kValid` の 2 面に、`groups: [{ id: "g-1", name: "列", visible: true, origin: [100, 100], layout: { direction: "row", gap: 20, align: "start", padding: 0 } }]` と `layers: [{ group: "g-1", children: [{ surface: "s-1" }] }, { surface: "s-2" }]` を加えたもの）。

  ```cpp
  TEST_CASE("v1 reads as flat v2")
  {
  	auto m = parse_mapping(kValid);
  	REQUIRE(m.has_value());
  	CHECK(m->version == 2);
  	CHECK(m->groups.empty());
  	REQUIRE(m->layers.size() == 2);
  	CHECK(m->layers[0] == LayerNode{LayerNode::Kind::Surface, "s-1", {}});
  	CHECK(serialize_mapping(*m).find("\"version\": 2") != std::string::npos);
  }
  TEST_CASE("v2 round_trip")      // parse → serialize → parse が等しく、2 回目の serialize が同じ文字列
  TEST_CASE("v2 group defaults")  // groups[0] から "visible" を消すと visible == true
  TEST_CASE("v2 empty group allowed") // { "group": "g-1", "children": [] } が通り、s-1 は最上位に移す
  TEST_CASE("v2 validation errors")
  {
  	// error_of(...) が次の文字列で始まること:
  	// "groups: missing"、"layers: missing"
  	// "groups[0].id: duplicate id \"s-1\""（グループと面は同じ名前空間）
  	// "groups[0].layout.gap: must be between 0 and 4096"（-1 と 4097）、padding も同じ
  	// "groups[0].layout.direction: unknown direction \"wrap\""
  	// "groups[0].layout.align: unknown align \"stretch\""
  	// "groups[0].origin: expected [x, y]"
  	// "layers[0]: expected exactly one of \"surface\" or \"group\""（両方ある / どちらもない）
  	// "layers[1].surface: unknown surface \"s-9\""
  	// "layers[0].group: unknown group \"g-9\""
  	// "layers[1].surface: surface \"s-1\" appears more than once"
  	// "layers[0].children: expected array"
  	// "layers: surface \"s-2\" is missing from the tree"
  	// "layers: group \"g-2\" is missing from the tree"（groups にはあるが木にない）
  	// "surfaces: order must match the depth-first order of layers"（s-1 と s-2 を入れ替える）
  	// "layers[0]...: depth exceeds 16"（17 段の入れ子を生成して確かめる。16 段は通る）
  	// "version: unsupported version 3"
  }
  ```
  既存の `validation errors` にある `"version": 2` → `unsupported` の行は、`version 3` に書き換える。

- [ ] **Step 2: テストが失敗することを確かめる。**
  Run: `cmake -S core -B build_core -DOBS_MAPPING_TESTS=ON && cmake --build build_core && ctest --test-dir build_core --output-on-failure`
  Expected: コンパイルエラー（`LayerNode` が未定義）。

- [ ] **Step 3: 実装する。** 補助関数を `json_read.hpp` に移す（`inline`、`namespace obs_mapping::detail`）。`parse_mapping` は `version` が 1 なら `groups` / `layers` を見ずに `layers = flat_layers(surfaces)` とし、2 なら `parse_groups` → `parse_layers` → `check_surface_order` の順で検査する。`parse_layers` は再帰の関数 `parse_node(const json&, const std::string &path, int depth, Ctx&)` で書く。`Ctx` は既知の面とグループ、木に出てきた ID の集合を持つ。木を最後までたどったあとで、木に出てこなかった面とグループを調べる。ノードの道筋は `layers[i]` と `.children[j]` をつないで表す。未知のフィールドは無視する。

- [ ] **Step 4: テストが通ることを確かめる。** Step 2 と同じコマンドで、Expected: 全テストが PASS。

- [ ] **Step 5: 整形して stage for review。** `clang-format-19 -i core/src/*.cpp core/src/*.hpp core/include/obs-mapping/*.hpp core/tests/*.cpp` を実行し、`git add core/` する。

### Task 2: 祖先グループを含めた表示状態で描画する

**Files:**
- Create: `core/include/obs-mapping/visibility.hpp`、`core/src/visibility.cpp`、`core/tests/test_visibility.cpp`
- Modify: `core/CMakeLists.txt`、`core/tests/CMakeLists.txt`
- Modify: `src/draw-rules.hpp`、`core/tests/test_draw_rules.cpp`
- Modify: `src/mapping-source.hpp`（`MappingSnapshot` に `std::vector<bool> visible; // parallel to mapping.surfaces` を足す）、`src/mapping-source.cpp`（`make_snapshot`、`video_tick`、`video_render`）

**Interfaces:**
- Consumes: Task 1 の `Mapping::groups` と `Mapping::layers`
- Produces: `std::vector<bool> effective_visibility(const Mapping &m); // parallel to m.surfaces`
- Produces: `inline bool should_draw_surface(const Surface &surface, bool visible, uint32_t src_w, uint32_t src_h, bool has_homography)`。`visible` は `surface.visible` の代わりに使う。

- [ ] **Step 1: 失敗するテストを書く。** `test_visibility.cpp` に次を書く。
  - `effective visibility hides surfaces under a hidden group`: g-1（`visible=false`）の下に s-1 を、最上位に s-2 を置くと `{false, true}` になる。
  - `effective visibility needs every ancestor visible`: g-1 > g-2 > s-1 で、g-1 だけが非表示なら false になる。
  - `effective visibility keeps the surface flag`: グループが表示中で、面の `visible=false` なら false になる。

  `test_draw_rules.cpp` は既存のテストを新しい引数に合わせ、`should_draw_surface is false when an ancestor hides it`（`s.visible == true` かつ `visible = false` なら false）を足す。
- [ ] **Step 2: 失敗することを確かめる。** core のテストのコマンドで、Expected: コンパイルエラー。
- [ ] **Step 3: 実装する。** `effective_visibility` は `layers` を一度 DFS し、祖先がすべて表示中かを引き継ぎながら、面の ID から表示状態への対応を作る。その対応を `surfaces` の順に並べて返す。`make_snapshot` で `inv_h` と一緒に一度だけ計算する。`video_render` の子テクスチャの前処理と `should_draw_surface` の呼び出し、`video_tick` のソース名の集合では `snap->visible[i]` を使う。非表示の面のソースは tick しない。オーバーレイ（`overlay.cpp`）は変えない。
- [ ] **Step 4: 通ることを確かめる。** core のテストで PASS になり、`cmake --preset macos && cmake --build --preset macos` が成功する。
- [ ] **Step 5: 整形して stage for review。** clang-format-19 をかけて、`git add core/ src/` する。

### Task 3: UI の v2 の型、木の基本操作、reducer で木を保つ

**Files:**
- Modify: `ui/src/model/mapping.ts`
- Create: `ui/src/model/layers.ts`、`ui/src/model/layers.test.ts`
- Modify: `ui/src/geometry/fixtures.ts`（`mapOf` を足す）
- Modify: `ui/src/editor/reducer.ts`（`addSurface`、`removeSelected`、`duplicateSelected`、`reorder`）、`ui/src/editor/reducer.test.ts`
- Modify（`version: 1` のリテラルを `mapOf` か v2 のリテラルに置き換える）: `ui/src/test/fake-obs.ts`、`ui/src/mock/fake-connection.ts`、`ui/src/io/import.test.ts`、`ui/src/editor/send-queue.test.ts`、`ui/src/app/**/*.test.ts`、`ui/src/atoms/**/*.test.ts`。置き換え漏れは `grep -rn "version: 1" ui/src` で確かめる。

**Interfaces:**
- Consumes（fix/echo-request-id の後の main）: `InFlightEntry`、`sent { requestId, json }`、`remote { mapping, requestId }`、`resynced`、`staleEcho`。これらの handler は変えない。
- Produces（`model/mapping.ts`）:
  ```ts
  export type Direction = 'row' | 'column';
  export type LayoutAlign = 'start' | 'center' | 'end';
  export type GroupLayout = { direction: Direction; gap: number; align: LayoutAlign; padding: number };
  export type Group = { id: string; name: string; visible: boolean; origin: Point; layout: GroupLayout };
  export type SurfaceNode = { surface: string };
  export type GroupNode = { group: string; children: readonly LayerNode[] };
  export type LayerNode = SurfaceNode | GroupNode;
  export type Mapping = { version: 2; canvas: …; grid: …; surfaces: readonly Surface[]; groups: readonly Group[]; layers: readonly LayerNode[] };
  export type MappingV1 = { version: 1; canvas: …; grid: …; surfaces: readonly Surface[] };
  ```
- Produces（`model/layers.ts`。すべて純粋関数で、引数は書き換えない）:
  - `isGroupNode(n: LayerNode): n is GroupNode`、`nodeId(n: LayerNode): string`
  - `flatLayers(surfaces: readonly Surface[]): SurfaceNode[]`
  - `dfsSurfaceIds(layers: readonly LayerNode[]): string[]`
  - `sortSurfacesByLayers(m: Mapping): Mapping`（`surfaces` を DFS の順に並べ直す）
  - `findParent(layers: readonly LayerNode[], id: string): { parentId: string | null; index: number } | null`（最上位なら `parentId: null`）
  - `removeNodes(layers: readonly LayerNode[], ids: ReadonlySet<string>): LayerNode[]`（指定したノードを部分木ごと外す）
  - `insertAfterNode(layers: readonly LayerNode[], anchorId: string, node: LayerNode): LayerNode[]`
  - `moveWithinParent(layers: readonly LayerNode[], id: string, toIndex: number): LayerNode[]`
  - `subtreeIds(layers: readonly LayerNode[], id: string): { surfaceIds: string[]; groupIds: string[] }`（自分自身も含む）
- Produces（`geometry/fixtures.ts`）: `mapOf(...surfaces: Surface[]): Mapping`（`version: 2`、canvas 1920×1080、grid 10、`groups: []`、`layers: flatLayers(surfaces)`）

- [ ] **Step 1: 失敗するテストを書く。** `layers.test.ts` に次を書く。
  - `dfsSurfaceIds` は `[g1[s1, g2[s2]], s3]` に対して `['s1','s2','s3']` を返す。
  - `removeNodes(…, {'g2'})` は s2 を含めて外し、`g1.children` は `[s1]` になる。
  - `insertAfterNode` は、グループの中にある anchor の直後の兄弟として挿入する。
  - `moveWithinParent(…, 's1', 1)` は同じ親の中だけで並べ替える。
  - `findParent` は s2 に対して `{ parentId: 'g2', index: 0 }` を、s3 に対して `{ parentId: null, index: 1 }` を返す。
  - `subtreeIds(…, 'g1')` は `{ surfaceIds: ['s1','s2'], groupIds: ['g1','g2'] }` を返す。

  `reducer.test.ts` に次を足す。
  - `addSurface appends a root layer node`
  - `removeSelected keeps the tree valid`: グループの中の面を消すと、`layers` からも消え、`surfaces` が DFS の順に並ぶ。
  - `duplicateSelected inserts the copy right after the original in the same parent`
  - `reorder moves within the parent and ignores a target under another parent`: 対象を、ドラッグしている面と同じ親の中の位置に変える。親が違えば `s` をそのまま返す。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/model/layers.test.ts src/editor/reducer.test.ts`、Expected: FAIL（import できない、または期待と違う）。
- [ ] **Step 3: 実装する。** 型を v2 にし、`layers.ts` を書き、`mapOf` を足す。テストと mock の `version: 1` を置き換える。reducer では、木を変える 4 つの handler が `sortSurfacesByLayers` を通った mapping を `commit` するようにする。`reorder` は `{ surfaceId, toIndex }` のまま受ける。`toIndex` は今の `surfaces` の位置として解釈し、その位置にある面の親の中での index に直してから `moveWithinParent` を呼ぶ。
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint`、Expected: すべて PASS で、警告 0。
- [ ] **Step 5: stage for review。** `git add ui/src`

### Task 4: JSON の読み込み（v1 → v2）、木の検証、import、client、export

**Files:**
- Create: `ui/src/model/read.ts`、`ui/src/model/read.test.ts`
- Create: `ui/src/model/validate-tree.ts`、`ui/src/model/validate-tree.test.ts`
- Modify: `ui/src/io/import.ts`（`checkStructure` を `readMapping` に置き換える）、`ui/src/io/import.test.ts`
- Modify: `ui/src/obs/client.ts`（`parseMapping` で `readMapping` を使う）、`ui/src/obs/client.test.ts`
- Test: `ui/src/io/export.test.ts`（新規）

**Interfaces:**
- Consumes: Task 3 の型、`flatLayers`、`dfsSurfaceIds`
- Produces: `readMapping(json: unknown): { kind: 'ok'; mapping: Mapping } | { kind: 'error'; message: string }`。今の `checkStructure` と同じ構造検査（version、canvas、surfaces が配列かどうか）を行う。`version` は 1 か 2 だけを受け付ける。v1 は `upgradeV1` で変換する。v2 は `validateTree` を通す。
- Produces: `upgradeV1(m: MappingV1): Mapping`（`groups: []`、`layers: flatLayers(m.surfaces)`。`version: 1` 以外のフィールドはそのまま）
- Produces: `validateTree(m: Mapping): string | null`。Task 1 のうち木に関わる検査（`groups` / `layers` が必須、ID の重複、存在しない参照、ちょうど 1 回の出現、深さ、`layout` の範囲、`surfaces` の並び順）を、core と同じ文字列で返す。面の crop や corners は検査しない（プラグインが検証する）。

- [ ] **Step 1: 失敗するテストを書く。**
  - `read.test.ts`: v1 の JSON が `{ kind: 'ok' }` になり、`version` が 2 で `layers` がフラットになる。`version: 3` は `'version: unsupported version 3'` になる。v2 で `layers` がなければ `'layers: missing'` になる。
  - `validate-tree.test.ts`: Task 1 の Step 1 の v2 のエラーのうち、木に関わる行を同じ文字列で確かめる（同じ入力表を使う）。
  - `import.test.ts`: v1 のファイルを `parseImport` すると、v2 の mapping が `ok` で返る。`surfaces` の並びが DFS と違う v2 は `error` になる。
  - `client.test.ts`: `GetMapping` が v1 の文字列を返しても、`mapping.version === 2` になる。`MappingChanged` のイベント（`requestId` 付き）でも同じになり、`requestId` はそのまま渡る。`setMapping(source, mapping, requestId)` の呼び出し方は変えない。
  - `export.test.ts`: `exportMapping(upgradeV1(v1))` を `JSON.parse` すると、`version: 2` と `groups: []` と `layers` を持つ。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/model src/io src/obs`、Expected: FAIL。
- [ ] **Step 3: 実装する。** `validateTree` は、ノードを訪ねる関数（道筋と深さを受け取る）と、出現を数える関数に分ける。`parseImport` の `mismatch` / `ok` の判定は変えない。
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint`、Expected: PASS で、警告 0。
- [ ] **Step 5: stage for review。** `git add ui/src`

### Task 5: ドックのプレビューで実際の表示状態を使う。README の JSON v2 の節

**Files:**
- Create: `ui/src/model/visibility.ts`、`ui/src/model/visibility.test.ts`
- Modify: `ui/src/components/stage/index.tsx`（`useScreenshots` に渡すソースの絞り込み）、`ui/src/components/stage-surface/index.tsx`（`visible: boolean` を props で受ける）、`ui/src/components/stage-overlay/index.tsx`（`hiddenCls` の判定）
- Test: `ui/src/components/stage-surface/index.test.tsx`（新規）
- Modify: `README.md`（「JSON v1 形式」を「JSON v2 形式」に書き換える。v1 との互換の注記、検証ルールの表への行の追加、ベンダー API のエラーの箇条書きを「JSON v2 の検証エラー」にする）

**Interfaces:**
- Produces: `effectiveVisibleIds(m: Mapping): ReadonlySet<string>`（面自身が表示中で、祖先のグループもすべて表示中の面の ID）

- [ ] **Step 1: 失敗するテストを書く。**
  - `visibility.test.ts`: Task 2 と同じ 3 つのケースを書く。
  - `stage-surface/index.test.tsx`（jsdom）: `visible={false}` のとき何も描かない（`container.firstChild === null`）。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/model/visibility.test.ts src/components/stage-surface`、Expected: FAIL。
- [ ] **Step 3: 実装する。** `Stage` で `effectiveVisibleIds(mapping)` を一度だけ計算し、`StageSurface` と `StageOverlay` に渡す。README には spec の v2 の例をそのまま載せ、検証ルールの表に `groups[].id`、`groups[].layout.*`、`layers`、`surfaces` の並び順の行を足す。「古いプラグインに v2 を送るとエラーになる（ドックとプラグインは同じバンドルで配る）」とも書く。
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint && pnpm -C ui build`、Expected: PASS で、build が `classic-script` のエラーなしで終わる。
- [ ] **Step 5: stage for review。** `git add ui/src README.md`

---

# PR 2: `layoutTree` と reducer への組み込み

> **依存:** PR 1 と、feat/snap-extended-edges、feat/align-to-canvas、feat/stage-underlay の merge が済んだ main から始める。足す UI は、キーボードショートカット、ツールバーのボタン「グループ化」と「グループ解除」、グループ化できないときのトーストだけにする。ボタンがあるので、CEF が Cmd+G を横取りしても、PR 2 の時点でグループ化できる。

### Task 6: `layoutTree` 純粋関数

**Files:**
- Create: `ui/src/layout/frame.ts`、`ui/src/layout/frame.test.ts`
- Create: `ui/src/layout/layout-tree.ts`、`ui/src/layout/layout-tree.test.ts`

**Interfaces:**
- Consumes: `boundsOf`、`Bounds`（`geometry/rect.ts`）、`isGroupNode`、`sortSurfacesByLayers`
- Produces（`frame.ts`）:
  - `type Size = { width: number; height: number }`
  - `nodeSize(m: Mapping, node: LayerNode): Size | null`。非表示の要素は `null`（レイアウトから外す）。面は bbox の大きさ。グループは「中身の大きさ + padding×2」で、中身がない（または全部非表示の）ときは `padding×2`。
  - `groupFrame(m: Mapping, groupId: string): Bounds`（`origin` と `nodeSize` から作る外枠。padding を含む）
- Produces（`layout-tree.ts`）: `layoutTree(m: Mapping): Mapping`。面を平行移動し、入れ子のグループの `origin` を上書きし、`surfaces` を DFS の順に並べる。spec の `layoutTree(mapping) → surfaces` と違い、`Mapping` を返す。入れ子の `origin` も結果に含めるため。
- 定数: `const NO_MOVE_EPS = 1e-9`

配置の手順（シグネチャとテストだけでは決まらない部分）:
```
placeGroup(group, at):            // at はグループの左上
  origin を at にする（入れ子なら、差が NO_MOVE_EPS 以上のときだけ上書きする）
  cursor = at の主軸の座標 + padding
  crossStart = at の交差軸の座標 + padding
  maxCross = 表示中の子のうち、交差軸の長さが最大のもの
  表示中の子ごとに:
    offset = start: 0 / center: (maxCross - 子の交差軸の長さ) / 2 / end: maxCross - 子の交差軸の長さ
    target = (主軸: cursor, 交差軸: crossStart + offset)
    子が面なら translateTo(surface, target)、グループなら placeGroup(child, target)
    cursor += 子の主軸の長さ + gap
translateTo(surface, target):     // 各軸について、|bbox.min - target| < NO_MOVE_EPS なら動かさない
  新しい座標 = (p - bbox.min) + target    // この順で計算すると、bbox の最小の角がちょうど target に来る
最上位のグループは、自分の origin で placeGroup する。最上位の面は動かさない。非表示の要素とその部分木は触らない。
```

- [ ] **Step 1: 失敗するテストを書く。** 共通の入力は、`g`（origin `[100, 100]`、row、gap 20、align start、padding 0）の中に `a = surf('a', 0, 0, 100, 50)` と `b = surf('b', 500, 500, 100, 80)` を入れたもの。
  ```ts
  it('row/start packs children from the origin with gap', () => {
    const out = layoutTree(m);
    expect(boundsOf(get(out, 'a'))).toEqual({ x: 100, y: 100, width: 100, height: 50 });
    expect(boundsOf(get(out, 'b'))).toEqual({ x: 220, y: 100, width: 100, height: 80 });
  });
  ```
  さらに次を確かめる。
  - align `center` のとき `a.y = 115`、`end` のとき `a.y = 130`。
  - `column` のとき `b.y = 170`。
  - padding 10 のとき `a` が `(110, 110)` から始まる。
  - 入れ子の場合。`g`（row、gap 10）の中に `a` と `h`（column、gap 5、padding 4、origin `[0, 0]`）を入れ、`h` の中に 20×20 の面を 2 つ入れる。`h.origin` が `[210, 100]` に上書きされ、`h` の大きさが 28×53（`20 + 4×2`、`20 + 5 + 20 + 4×2`）になる。
  - 歪んだ四角形（`[[0,0],[100,10],[90,60],[5,50]]`）を動かしても、四隅の相対位置は変わらない。
  - `visible: false` の面は位置が変わらず、後ろの要素が詰まる。非表示のグループは、部分木ごと変わらない。
  - 空のグループと、中身が全部非表示のグループは、`nodeSize` が `{ width: 2 * padding, height: 2 * padding }` になる。
  - 最上位の面は動かない。
  - `surfaces` の並びが `dfsSurfaceIds(layers)` と同じになる。
  - **冪等:** corners が `0.1` や `0.7` のような小数の入力で `expect(layoutTree(layoutTree(m))).toEqual(layoutTree(m))` が成り立つ。center 揃えで、子の交差軸の長さが奇数のときも成り立つ。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/layout`、Expected: FAIL。
- [ ] **Step 3: 実装する。** 上の手順のとおりに書く。主軸と交差軸の読み書きは、小さな関数 `mainOf(size, dir)`、`crossOf(size, dir)`、`pointAt(main, cross, dir)` に分ける。
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test src/layout && pnpm -C ui typecheck && pnpm -C ui lint`、Expected: PASS。
- [ ] **Step 5: stage for review。** `git add ui/src/layout`

### Task 7: reducer の各コミットで `layoutTree` を通す。`Selection.groupIds`。角がカーソルに付いていく補正

**Files:**
- Modify: `ui/src/editor/state.ts`（`Selection` に `groupIds: string[]`、`emptySelection`）
- Modify: `ui/src/editor/reducer.ts`（`commit`、`replaceLive`、`pruneSelection`、`dragCorner`、`setCorner`、`dragSurface`）
- Modify: `ui/src/app/mapping-sync/source-session.ts`（`selectionChanged` が `groupIds` も比べる）
- Create: `ui/src/layout/follow-corner.ts`、`ui/src/layout/follow-corner.test.ts`
- Create: `ui/src/editor/items.ts`、`ui/src/editor/items.test.ts`
- Modify: `ui/src/editor/reducer.test.ts`。`select` を作るヘルパーと、`Selection` を作っているすべての箇所（`use-stage-drag.ts`、`surface-list`）に `groupIds: []` を足す。

**Interfaces:**
- Consumes: Task 6 の `layoutTree`、`findParent`
- Produces（`items.ts`）: `isLaidOut(m: Mapping, id: string): boolean`（親がグループなら true）、`leadingRoot(m: Mapping, surfaceId: string): string | null`（面から最上位までのどの段でも、その要素が親の表示中の子の先頭にあるなら、最上位のグループの ID を返す。そうでなければ null）
- Produces（`follow-corner.ts`）: `followCorner(m: Mapping, surfaceId: string, index: CornerIndex, to: Point): Mapping`。角を `to` に置いて `layoutTree` を通す。`leadingRoot` が null でなければ、`d = to - レイアウト後の角` を求め、`d` の負の成分だけを最上位のグループの `origin` に足して、もう一度 `layoutTree` を通す。
- 確定事項（ユーザーが決めたこと。Figma と同じ）: 先頭でない要素の角を外へ引くと、要素の幅が広がり、後ろの要素がずれる。要素の先頭の辺は「前の要素 + gap」に固定されたままなので、つかんだ角はカーソルから離れて戻る。`origin` の補正は、`leadingRoot` が null でない（どの段でも先頭にある）ときだけ行う。
- Produces（reducer）: `commit(s, next)` は `layoutTree(next)` を比べて保存する。`replaceLive(s, next)` も `layoutTree` を通す。`dragCorner` と `setCorner` は `followCorner` を使う。`dragSurface` は `isLaidOut` の面に対しては何もしない。

- [ ] **Step 1: 失敗するテストを書く。**
  - `follow-corner.test.ts`: Task 6 の `g`（row、`a` が先頭）で、`a` の角 0 を `[90, 95]` へドラッグする。結果の `a.corners[0]` は `[90, 95]`、`g.origin` は `[90, 95]` になり、`b` の bbox は `(90 + 110 + 20, 95) = (220, 95)` になる（`a` の幅が 110 に増え、origin が 10 左へ動くため）。
  - `b`（先頭でない）の角 0 を `[200, 90]` へ引くと、`g.origin` は変わらず、`b` の bbox の左上は `(220, 100)` に固定されたままで、`b.corners[0]` は `[200, 90]` にならない（カーソルから離れて戻る）。
  - `a` の角 2（右下）を `[230, 160]` へ引いても `origin` は変わらず、`b` が後ろへずれる。
  - 先頭の角を内側（`d > 0`）へ動かしても、`origin` は変わらない。
  - 入れ子で、`g > h > a` の 2 段とも先頭なら、`g.origin` が動く。
  - `reducer.test.ts`:
    - `no-op commit on a laid-out mapping returns the same state`（`patchSurface` で同じ名前を入れると `s` がそのまま返る）
    - `dragSurface on a grouped surface does nothing`
    - `remote does not run layoutTree`（レイアウトとずれた座標の mapping を `remote` で受けても、そのまま入る）
    - `dragCorner previews the layout live`（ドラッグ中に `b` がずれる）
    - `pruneSelection drops missing group ids`
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/layout src/editor`、Expected: FAIL。
- [ ] **Step 3: 実装する。** `commit` の no-op 判定は、`canonicalJson(layoutTree(next))` と今の mapping を比べる今の形を保つ。送信されるのは `next.mapping !== prev.mapping` のときだけなので、送信の経路は変えなくてよい。
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint`、Expected: PASS。
- [ ] **Step 5: stage for review。** `git add ui/src`

### Task 8: グループ化（Cmd+G）と解除（Cmd+Shift+G）、ID の生成

**Files:**
- Create: `ui/src/editor/ids.ts`、`ui/src/editor/ids.test.ts`
- Create: `ui/src/layout/group-inference.ts`、`ui/src/layout/group-inference.test.ts`
- Create: `ui/src/editor/grouping.ts`、`ui/src/editor/grouping.test.ts`
- Modify: `ui/src/editor/reducer.ts`（`group` / `ungroup` を足し、`addSurface` と `duplicateSelected` を `freshId` に切り替え、`nextSurfaceNumber` を消す。`group` / `ungroup` は `DRAG_BLOCKED` に入れる）
- Modify: `ui/src/editor/keys.ts`、`ui/src/editor/keys.test.ts`
- Modify: `ui/src/atoms/mapping/index.ts`、`ui/src/atoms/mapping/index.test.ts`（`groupSelectionAtom`）、`ui/src/components/stage/index.tsx`（`onStageKey`）
- Modify: `ui/src/components/toolbar/index.tsx`、`ui/src/components/toolbar/index.test.tsx`、`ui/src/components/editor/index.tsx`（ボタン「グループ化」と「グループ解除」）
- Modify: `docs/manual-checks.md`（CEF が Cmd+G を横取りしないかの確認項目）

**Interfaces:**
- Produces: `freshId(m: Mapping, prefix: 's' | 'g', taken?: ReadonlySet<string>): string`（`${prefix}-${n}` の形。`n` は、面とグループの両方の ID で使われている同じ接頭辞の最大値 + 1。`taken` にある ID も避ける）
- Produces: `inferGroup(m: Mapping, itemIds: readonly string[]): { layout: GroupLayout; origin: Point; order: string[] }`
  - 要素の矩形は、面なら `boundsOf`、グループなら `groupFrame`。
  - 全体の bbox の幅が高さ以上なら `row`、そうでなければ `column`。
  - `order` は主軸の bbox の最小値の昇順。同じ値なら今の木の順。
  - `gap` は `Math.max(0, Math.round(平均(next.min - (prev.min + prev.size))))`。要素が 1 つなら 0。
  - `align: 'start'`、`padding: 0`、`origin` は全体の bbox の左上。
- Produces: `groupProblem(m: Mapping, sel: Selection): string | null`。何も選んでいなければ `''`（何もせず、トーストも出さない）、親が揃っていなければ `'同じ階層のものを選んでください'`、グループ化できるなら null。
- Produces（`ui/src/atoms/mapping/index.ts`）: `groupSelectionAtom: WritableAtom<null, [], void>`。`groupProblem` が空でない文字列なら `reportErrorAtom` でトーストを出し、null なら `{ type: 'group' }` を dispatch する。Stage の Cmd+G と、ツールバーのボタン「グループ化」はこれを呼ぶ。reducer は純粋なままにする。
- Produces: `groupItems(m: Mapping, itemIds: readonly string[], groupId: string): Mapping | null`。要素が 1 つ以上あり、親が揃っていればグループにする。そうでなければ null。新しいグループは、木の順で最初の要素があった位置に入れる。名前は `グループ ${n}`（`n` は ID の番号）、`visible: true`。
- Produces: `ungroupItems(m: Mapping, groupIds: readonly string[]): { mapping: Mapping; childIds: string[] }`。グループのノードを、その子で同じ位置に置き換える。`groups` からも消す。最上位に出た入れ子のグループは、今保存されている `origin` を使う。
- Produces（Action）: `{ type: 'group' }`、`{ type: 'ungroup' }`。選択中の `surfaceIds` と `groupIds` を対象にする。`group` の後は `{ surfaceIds: [], groupIds: [新しい ID], corner: null }` を選ぶ。`ungroup` の後は、元の子を種類ごとに選ぶ。
- Produces（keys）: Cmd/Ctrl + `g` → `group`、Cmd/Ctrl + Shift + `g` → `ungroup`
- ツールバーのボタン（`Toolbar` に `canGroup: boolean`、`canUngroup: boolean`、`onGroup: () => void` の props を足す。`EditorBody` が atom から渡す）:
  - 「グループ化」は、`surfaceIds` か `groupIds` が空でなければ押せる（何も選んでいなければ `disabled`）。押すと `groupSelectionAtom` を呼ぶ。
  - 「グループ解除」は、`groupIds` が空でなければ押せる。押すと `{ type: 'ungroup' }` を dispatch する。
- 何も選ばずに Cmd+G を押したときは、何もせずトーストも出さない（確定事項）。

- [ ] **Step 1: 失敗するテストを書く。**
  - `ids.test.ts`: グループ `s-3` と面 `s-1` があるとき、`freshId(m, 's')` は `'s-4'` を返す。
  - `group-inference.test.ts`: 横に並んだ 3 面（x = 0, 130, 250、幅 100）は `row` で、`gap` は `round((30 + 20) / 2) = 25` になる。重なった面の `gap` は 0（負を切り上げる）。縦長の選択は `column`。`order` は位置の順（選択の順と違ってもよい）。
  - `grouping.test.ts`: 最上位の 2 面をグループにすると、グループが最初の面の位置に入る。親が違う面を選んだときは null になる。解除すると、子が同じ位置に戻り、`groups` から消え、面の corners は変わらない（親が最上位のとき）。
  - `reducer.test.ts`: `group` の後に undo 1 回で元に戻る。`group` の後にレイアウトが効く（推定した gap で詰まる）。
  - `keys.test.ts`: `{ key: 'g', metaKey: true }` → `group`、`{ key: 'G', metaKey: true, shiftKey: true }` → `ungroup`。
  - `grouping.test.ts`: 面を 1 つだけ選んでもグループにできる。`groupProblem` は、親が違う 2 面に対して `'同じ階層のものを選んでください'` を返す。
  - `atoms/mapping/index.test.ts`: 親が違う選択で `groupSelectionAtom` を呼ぶと、トーストが 1 件増え、mapping は変わらない。何も選んでいないときは、トーストも mapping も変わらない。
  - `toolbar/index.test.tsx`（jsdom）: `canGroup={false}` で「グループ化」が `disabled`。押すと `onGroup` が呼ばれる。「グループ解除」を押すと `ungroup` が dispatch される。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/editor src/layout src/atoms`、Expected: FAIL。
- [ ] **Step 3: 実装する。** `commandAction` に `g` の分岐を足す。Stage の `onStageKey` では、`group` のアクションだけを `useSetAtom(groupSelectionAtom)` に回す。`group` の handler は `freshId` → `inferGroup` → `groupItems` → `commit` の順に組み立て、それぞれは独立した関数にする。
- [ ] **Step 3b: 手動確認の項目を足す。** `docs/manual-checks.md` に「OBS のカスタムブラウザドックで、Stage にフォーカスがある状態で Cmd+G / Cmd+Shift+G を押し、グループ化と解除が起きること。起きなければ CEF が横取りしているので、ツールバーのボタンで同じ操作ができることを確かめる」を足す。この確認は merge を止めない。
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint`、Expected: PASS。
- [ ] **Step 5: stage for review。** `git add ui/src docs/manual-checks.md`

### Task 9: グループの削除と複製

**Files:**
- Create: `ui/src/editor/structure.ts`、`ui/src/editor/structure.test.ts`
- Modify: `ui/src/editor/reducer.ts`（`removeSelected`、`duplicateSelected`）、`ui/src/editor/reducer.test.ts`

**Interfaces:**
- Consumes: `subtreeIds`、`removeNodes`、`insertAfterNode`、`freshId`、`translateSurface`
- Produces: `removeItems(m: Mapping, ids: readonly string[]): Mapping`（グループは子ごと消し、`surfaces` と `groups` からも外す）
- Produces: `duplicateItems(m: Mapping, ids: readonly string[]): { mapping: Mapping; newSurfaceIds: string[]; newGroupIds: string[] }`。部分木を丸ごとコピーし、ID はすべて `freshId` で振り直す（1 回の呼び出しの中でも重複しないよう `taken` を育てる）。名前に ` のコピー` を付けるのは、コピーした一番上のノードだけにする。最上位にできたコピーだけを `COPY_OFFSET`（20）ずらす。面なら corners を、グループなら `origin` と部分木の面を動かす。グループの中にできたコピーは、レイアウトが位置を決める。
- 選択の中に、別の選択の子孫がある場合は、祖先の側だけを対象にする。

- [ ] **Step 1: 失敗するテストを書く。**
  - グループを消すと、子の面もグループも消える。
  - 空になったグループは残る（子をすべて消してもグループは消えない）。
  - グループを複製すると、子までコピーされ、ID はすべて新しくなり、元とも互いとも重ならない。コピーは元の直後の兄弟に入る。
  - 最上位のグループの複製は `origin` が +20, +20 になる。
  - グループの中の面の複製は、ずらさずレイアウトに任せる（直後に並ぶ）。
  - グループとその子を一緒に選んで複製すると、コピーは 1 組だけできる。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/editor`、Expected: FAIL。
- [ ] **Step 3: 実装する。**
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint`、Expected: PASS。
- [ ] **Step 5: stage for review。** `git add ui/src/editor`

### Task 10: Align、Distribute、矢印キーをグループ単位で行う。Import の Scale

**Files:**
- Modify: `ui/src/geometry/align.ts`（要素の矩形を受けてずらす量を返す形に一般化する。`alignReference` は残す）、`ui/src/geometry/align.test.ts`
- Modify: `ui/src/editor/items.ts`（`movableItems`、`moveItem`）、`ui/src/editor/items.test.ts`
- Modify: `ui/src/editor/reducer.ts`（`nudge`、`align`、`distribute`）
- Modify: `ui/src/components/editor/index.tsx`（`Toolbar` の `selectedCount` に `movableItems(...).length` を渡す）
- Modify: `ui/src/io/import.ts`（`scaleMapping`）、`ui/src/io/import.test.ts`

**Interfaces:**
- Produces: `type Item = { id: string; bounds: Bounds }`
- Produces: `alignDeltas(items: readonly Item[], mode: AlignMode, reference?: Bounds): ReadonlyMap<string, Point>`、`distributeDeltas(items: readonly Item[], axis: 'x' | 'y'): ReadonlyMap<string, Point>`。`alignSurfaces` / `distributeSurfaces` は、これらを使う薄いラッパーとして残す。
- Produces: `movableItems(m: Mapping, sel: Selection): Item[]`（選択中の要素のうち、最上位の面とグループだけ。グループの矩形は `groupFrame`）、`moveItem(m: Mapping, id: string, d: Point): Mapping`（面なら `translateSurface`、最上位のグループなら `origin += d`、それ以外は何もしない）
- Produces: `scaleMapping(m, width, height)`。`origin` は軸ごとの比率で伸縮する。`gap` は、そのグループの主軸の比率（row は sx、column は sy）で伸縮する。`padding` は `Math.min(sx, sy)` で伸縮する。最後に `layoutTree` を通す。

- [ ] **Step 1: 失敗するテストを書く。**
  - `nudge moves a top-level group origin by 1/10 px`
  - `nudge ignores grouped surfaces and nested groups`（corners も origin も変わらない）
  - `nudge on a selected corner of a grouped surface still edits the shape`（形の編集は許す。`followCorner` を通る）
  - `align left aligns a group frame and a top-level surface`: グループの外枠の x が面の x に揃う。
  - `align ignores selected grouped surfaces`
  - 単独の要素では、align-to-canvas の基準（canvas）が効く。
  - `distribute` はグループの外枠で 3 要素以上のときに効く。
  - `scaleMapping`（1920×1080 → 960×1080）: `origin [100, 100]` → `[50, 100]`、row の `gap 20` → `10`、`padding 10` → `5`（`min(0.5, 1)`）。結果は `layoutTree` を通した後の座標になる。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/geometry src/editor src/io`、Expected: FAIL。
- [ ] **Step 3: 実装する。**
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint && pnpm -C ui build`、Expected: PASS。
- [ ] **Step 5: stage for review。** `git add ui/src`

---

# PR 3: 面の一覧をレイヤーの木にする

> **依存:** PR 2

### Task 11: Tree の DnD を調べる。木の移動と、DnD の判定を純粋関数で書く

**Files:**
- Modify: `ui/src/model/layers.ts`（`moveNodes`、`depthOf`、`subtreeHeight`）、`ui/src/model/layers.test.ts`
- Create: `ui/src/components/layer-tree/drop.ts`、`ui/src/components/layer-tree/drop.test.ts`
- Modify: `ui/src/editor/reducer.ts`（`moveNodes` と `patchGroup` を足し、`reorder` を消す）、`ui/src/editor/reducer.test.ts`
- Create: `ui/src/atoms/layers/index.ts`、`ui/src/atoms/layers/index.test.ts`

**Interfaces:**
- Produces: `type NodeTarget = { parentId: string | null; index: number }`、`moveNodes(layers: readonly LayerNode[], ids: readonly string[], target: NodeTarget): LayerNode[]`（ids の木の順を保つ。`index` は、動かす前の親の子の並びで数える）
- Produces: `type TreeDrop = { key: string; dropPosition: 'before' | 'after' | 'on' }`、`canDrop(m: Mapping, dragged: ReadonlySet<string>, drop: TreeDrop): boolean`（面の上への `'on'`、自分自身や自分の子孫への移動、深さが 16 を超える移動は拒否する）、`dropAction(m: Mapping, dragged: ReadonlySet<string>, drop: TreeDrop): Action | null`（`'on'` のグループなら最後の子に、`before` / `after` なら key と同じ親の兄弟として入れる）
- Produces（Action）: `{ type: 'moveNodes'; ids: string[]; target: NodeTarget }`、`{ type: 'patchGroup'; groupId: string; patch: Partial<Pick<Group, 'name' | 'visible' | 'layout'>> }`（`layout` の `gap` と `padding` は 0〜4096 に clamp し、有限でない値は無視する）
- Produces: `collapsedGroupsAtom: PrimitiveAtom<ReadonlySet<string>>`（初期値は空の Set。開閉状態はドックの中だけで持ち、JSON には入れない）、`toggleCollapsedAtom: WritableAtom<null, [groupId: string], void>`

- [ ] **Step 1: 調べる（コードは書かない）。** context7 か web で、react-aria-components 1.22.1 の `Tree` と `useDragAndDrop` を調べ、次を確かめる。
  - `useDragAndDrop({ getItems, onMove, shouldAcceptItemDrop, renderDropIndicator })` が Tree で使えること。
  - `onMove` の `DroppableCollectionReorderEvent` が `keys` と `target.key` / `target.dropPosition` を持つこと。
  - `'on'` が子を持つ項目に落とせること。
  - `Tree` の `expandedKeys` / `onExpandedChange` が、`TreeProps` の `Expandable` から来ていること。
  - キーボードで DnD できること。

  `node_modules/react-aria-components/dist/types/src/Tree.d.ts` と `@react-types/shared/src/dnd.d.ts` も読む。調べた結果は、このタスクの review 依頼に書く。想定と違えば、Task 12 に進む前に止めて報告する。
- [ ] **Step 2: 失敗するテストを書く。**
  - `moveNodes` は、`g1` の子 `s1` を最上位の index 0 へ移す。
  - `canDrop(m, {'g1'}, { key: 's-in-g1', dropPosition: 'before' })` は false（自分の子孫）。
  - `canDrop` で面の上の `'on'` は false。
  - 深さ 16 のグループの中にグループを入れる移動は false。
  - `dropAction` で `'on'` のグループに落とすと、`{ parentId: 'g2', index: children.length }` になる。
  - `patchGroup` で `gap: 5000` を入れると 4096 になる。
  - `toggleCollapsedAtom` を 2 回呼ぶと元に戻る。
- [ ] **Step 3: 失敗することを確かめる。** Run: `pnpm -C ui test src/model src/components/layer-tree src/editor src/atoms/layers`、Expected: FAIL。
- [ ] **Step 4: 実装する。** `reorder` を使っていたテストは `moveNodes` に書き換える。
- [ ] **Step 5: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint`、Expected: PASS。ただし、`surface-list` が `reorder` を使っている箇所は、この時点で `moveNodes` に置き換えておく。
- [ ] **Step 6: stage for review。** `git add ui/src`

### Task 12: `LayerTree` コンポーネント

**Files:**
- Create: `ui/src/components/layer-tree/index.tsx`、`ui/src/components/layer-tree/styles.css.ts`、`ui/src/components/layer-tree/index.test.tsx`
- Modify: `ui/src/colophon/colophon/index.tsx`（「LayerTree / 入れ子と折りたたみ」と「LayerTree / 非表示のグループ」の 2 例と、Tree のドキュメントへの `Link`（`e.preventDefault`）を足す）

**Interfaces:**
- Consumes: `canDrop`、`dropAction`、`collapsedGroupsAtom`、`toggleCollapsedAtom`、`effectiveVisibleIds`
- Produces: `LayerTree = ({ mapping, selection, dispatch }: { mapping: Mapping; selection: Selection; dispatch: Dispatch<Action> }) => JSX.Element`。props は既存の `SurfaceList` と同じ流れで受ける。開閉状態は `useAtomValue(collapsedGroupsAtom)` と `useSetAtom(toggleCollapsedAtom)` で読み書きする。
- 行の内容:
  - 面: 表示の切り替えボタン、名前、ソース名（未割当なら「未割当」）。
  - グループ: 表示の切り替えボタン、名前、`${n} 個`。
  - 表示の切り替えボタンは `aria-pressed` を持つ。`aria-label` は「`${name}` を非表示にする」か「`${name}` を表示する」。
  - 祖先が非表示の行は、文字色を弱める（AA のコントラストを保つトークンを使う）。
  - 字下げは Tree の `--tree-item-level` を使う。
- 選択: `selectionMode="multiple"`。`selectedKeys` は `surfaceIds` と `groupIds` を合わせたもの。`onSelectionChange` は、キーを種類ごとに分けて `select` に変える。

- [ ] **Step 1: 失敗するテストを書く（jsdom）。** DnD そのものは jsdom では確かめない（Task 11 の純粋関数で確かめる）。
  - 木が `role="treegrid"` で描かれ、グループの下の行が `aria-level=2` になる。
  - グループの行を折りたたむと、子の行が消える。開閉状態は `collapsedGroupsAtom` に入る。
  - グループの表示の切り替えボタンを押すと、`dispatch` が `{ type: 'patchGroup', groupId, patch: { visible: false } }` で呼ばれる。
  - グループの行をクリックすると、`select` に `groupIds: ['g-1']` が入る。
  - `axe` 相当の確認として、ボタンに名前があり、`aria-pressed` が付いている。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/components/layer-tree`、Expected: FAIL。
- [ ] **Step 3: 実装する。** react-aria-components の `Tree` / `TreeItem` / `TreeItemContent` と `useDragAndDrop` を使う。`shouldAcceptItemDrop` には `canDrop` を、`onMove` には `dropAction` を渡す。`renderDropIndicator` は HTML と CSS で作る線にする。Tree が描くのは表示用の木で、`layers` から作る。
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint && pnpm -C ui build`、Expected: PASS。
- [ ] **Step 5: stage for review。** `git add ui/src`

### Task 13: `SurfaceList` に `LayerTree` を組み込む

**Files:**
- Modify: `ui/src/components/surface-list/index.tsx`（`<ul role="listbox">` と HTML5 の DnD を消して `LayerTree` に置き換える。追加・削除のボタンは残す）、`ui/src/components/surface-list/styles.css.ts`
- Create: `ui/src/components/surface-list/index.test.tsx`
- Modify: `ui/src/colophon/colophon/index.tsx`（SurfaceList の例が既にあれば、グループ付きの fixture に替える）

**Interfaces:**
- Consumes: Task 12 の `LayerTree`
- 削除ボタンは、`surfaceIds` か `groupIds` が空でなければ押せる。見出しは「レイヤー」。空のときの案内は今の文言を残す。

- [ ] **Step 1: 失敗するテストを書く（jsdom）。**
  - グループを選んで削除を押すと `removeSelected` が呼ばれる。
  - 面のない mapping では案内が出る。
  - 既存の追加の操作は今までどおり動く。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/components/surface-list`、Expected: FAIL。
- [ ] **Step 3: 実装する。**
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint && pnpm -C ui build`、Expected: PASS。`pnpm -C ui dev` の `mock.html` で、DnD による並べ替えと別の親への移動、キーボードでの DnD、折りたたみを目で確かめる。
- [ ] **Step 5: stage for review。** `git add ui/src`

---

# PR 4: Stage でのグループ操作、Inspector のグループ設定、オーバーレイ

> **依存:** PR 3

### Task 14: `selectionJson` に子孫の面の ID を入れる

**Files:**
- Modify: `ui/src/model/layers.ts`（`selectedSurfaceIdsDeep`）、`ui/src/model/layers.test.ts`
- Modify: `ui/src/app/mapping-sync/overlay.ts`（`sendSelection` と `sendToggle`）、`ui/src/app/mapping-sync/index.test.ts`

**Interfaces:**
- Produces: `selectedSurfaceIdsDeep(m: Mapping, sel: Selection): string[]`（`surfaceIds` と、`groupIds` の子孫の面を合わせたもの。重複を除き、DFS の順に並べる）
- C++ のオーバーレイと `parse_selection` は変えない。

- [ ] **Step 1: 失敗するテストを書く。** `g1[s1, g2[s2]]` で `groupIds: ['g1']` を選ぶと、`setOverlay` が `selectedSurfaceIds: ['s1', 's2']` で呼ばれる。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/model src/app/mapping-sync`、Expected: FAIL。
- [ ] **Step 3: 実装する。**
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint`、Expected: PASS。
- [ ] **Step 5: stage for review。** `git add ui/src`

### Task 15: Stage にグループの外枠とハンドルを描き、Figma と同じ方法で選べるようにする

**Files:**
- Create: `ui/src/editor/stage-pick.ts`、`ui/src/editor/stage-pick.test.ts`
- Create: `ui/src/components/stage-group-frame/index.tsx`、`ui/src/components/stage-group-frame/styles.css.ts`、`ui/src/components/stage-group-frame/index.test.tsx`
- Modify: `ui/src/components/stage-overlay/index.tsx`、`ui/src/components/stage-overlay/styles.css.ts`（面そのものが選ばれていて、かつレイアウトされている面のポリゴンに `lockedCls`（`cursor: not-allowed`）を付ける）
- Modify: `ui/src/editor/use-stage-drag.ts`（`onSurfaceDown` を `stage-pick` の規則で書き直す。`onGroupDown` と `onDoubleClick` を足す）、`ui/src/editor/use-stage-drag.test.tsx`
- Modify: `README.md`（Stage の操作の説明）、`docs/manual-checks.md`（選択の手順）。Cmd+クリックが「選択に足す」から「一番深い面を直接選ぶ」に変わり、選択に足すのは Shift+クリックだけになったことを書く。
- Modify: `ui/src/colophon/colophon/index.tsx`（「StageGroupFrame / 選択中」と「StageGroupFrame / 空のグループ」を足す）

**Interfaces:**
- Consumes: `groupFrame`、`isLaidOut`、`findParent`、`effectiveVisibleIds`
- Produces（`stage-pick.ts`。ユーザーが決めた Figma と同じ規則）:
  - `pickPath(m: Mapping, surfaceId: string): string[]`（一番外側のグループから面までの ID の列。最上位の面なら `[surfaceId]`）
  - `clickTarget(path: readonly string[], sel: Selection): string`。選択中のノードのどれかが `path[k]`（k ≥ 1）そのものか、その兄弟なら、そのうち一番深い `path[k]` を返す（中に入った階層のまま選び直す）。そうでなければ `path[0]`（一番外側のグループ）を返す。
  - `drillTarget(path: readonly string[], sel: Selection): string`。選択中のノードが `path[k]` なら `path[min(k + 1, path.length - 1)]` を、なければ `path[0]` を返す（ダブルクリックごとに 1 段ずつ中に入る）。
  - `deepTarget(path: readonly string[]): string` = `path.at(-1)`（Cmd+クリック）
  - `surfaceAt(m: Mapping, p: Point): string | null`（実際に表示中の面のうち、`p` を含む一番手前の面。四角形の内外判定で決める）
- 操作（確定事項。Figma と同じ）:
  - クリック（修飾キーなし）: `clickTarget`。Shift+クリック: `clickTarget` の結果を選択に足す、または外す。Cmd+クリック: `deepTarget`。Cmd+クリックで選択に足す今の動きはなくす。
  - ダブルクリック: `surfaceAt` で面を求め、`drillTarget` を選ぶ。
  - 選ばれていない面を押してドラッグすると、`clickTarget` で一番外側のグループが選ばれ、そのままグループのドラッグを始める（Task 16）。最上位の面なら、今の面のドラッグを始める。レイアウトされている面そのものなら、選ぶだけでドラッグは始めない。
- Produces: `StageGroupFrame = ({ frame, selected, scale, onPointerDown, onDoubleClick }: { frame: Bounds; selected: boolean; scale: number; onPointerDown: (e: PointerEvent<SVGElement>) => void; onDoubleClick: (e: MouseEvent<SVGElement>) => void }) => JSX.Element`。外枠を破線の矩形で描き、四隅にハンドルを描く。ハンドルは見た目だけで、大きさは変えない（spec の「やらないこと」に、グループ単位の拡大縮小がある）。
- 重なり順: 外枠を描くのは、選んだグループだけにする。外枠は面の輪郭より上に、透明の塗りで描く。外枠の中なら、どこを押してもグループのドラッグになる。外枠の中のダブルクリックは、`surfaceAt` で求めた面について `drillTarget` を選ぶ。

- [ ] **Step 1: 失敗するテストを書く。**
  - `stage-pick.test.ts`: 木 `g1[g2[s1, s2]], s3` を使う。
    - 何も選んでいないとき、s1 のクリックは `'g1'` を選ぶ。
    - `g1` を選んだ状態でダブルクリックすると `'g2'`、もう一度で `'s1'`、さらにもう一度でも `'s1'` のまま。
    - `s1` を選んだ状態で s2 をクリックすると `'s2'`（同じ階層の兄弟）。
    - Cmd+クリックは `'s1'`。
    - s3 のクリックは `'s3'`。
    - `surfaceAt` は、重なった 2 面のうち手前の面を返し、非表示のグループの中の面は返さない。
  - `use-stage-drag.test.tsx`:
    - Cmd+クリックが選択に足さず、置き換える。
    - Shift+クリックが選択に足す。
    - レイアウトされている面が選ばれていて、それを押したときは `dragStart` を送らない。
    - 選ばれていない面を押すとグループが選ばれ、`dragStart` が送られる。
  - `stage-group-frame/index.test.tsx`（jsdom）: `frame` の位置に矩形を 1 つ、ハンドルを 4 つ描き、`selected` のときに選択中のクラスが付く。
  - `stage-overlay`: 面そのものが選ばれていて、レイアウトされている面のポリゴンにだけ `lockedCls` が付く。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/editor src/components/stage-group-frame src/components/stage-overlay`、Expected: FAIL。
- [ ] **Step 3: 実装する。** 外枠の線の色は、既存の選択の色のトークンを使う（AA を満たすもの）。ダブルクリックの検出には、SVG の `onDoubleClick` を使う。
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint && pnpm -C ui build`、Expected: PASS。
- [ ] **Step 5: stage for review。** `git add ui/src README.md docs/manual-checks.md`

### Task 16: グループのドラッグ移動と吸着

**Files:**
- Modify: `ui/src/editor/drag.ts`（`roundedGroupOffsetHit`）、`ui/src/editor/drag.test.ts`
- Modify: `ui/src/editor/use-stage-drag.ts`（`Drag` に `{ kind: 'group'; groupId; frame: Bounds; start: Point; applied: Point }` を足す）、`ui/src/editor/use-stage-drag.test.tsx`
- Modify: `ui/src/editor/reducer.ts`（`dragGroup` を足す）、`ui/src/editor/reducer.test.ts`

**Interfaces:**
- Consumes: feat/snap-extended-edges の `snapSurfaceHit`、`snapTargets`、`Snapped`、`rectCorners`、`snapToGrid`
- Produces: `roundedGroupOffsetHit(frame: Bounds, raw: Point, o: SnapOptions): Snapped`。外枠の四隅（`rectCorners(frame)`）に、`grid: null` にした `o` で角・辺・延長線の吸着を効かせる。何にも吸着しなければ、グリッドへの吸着を `origin`（外枠の左上）だけに効かせる。最後に 0.01 px に丸める。
- Produces（Action）: `{ type: 'dragGroup'; groupId: string; dx: number; dy: number }`。最上位のグループなら `moveItem` と `replaceLive` で動かし、入れ子のグループなら何もしない。`DRAG_BLOCKED` には入れない。
- 吸着の対象: `snapTargets` に、グループの子孫の面を除いた、実際に表示中の面（`effectiveVisibleIds`）を渡す。

- [ ] **Step 1: 失敗するテストを書く。**
  - `roundedGroupOffsetHit`: grid 20 で、外枠 `(103, 0)` の `raw [0, 0]` が `[-3, 0]` になる（origin がグリッドに乗る）。外枠の右上の角が他の面の角から 8 px 以内なら、グリッドより角を優先する。
  - `dragGroup` は最上位のグループの `origin` を動かし、子の面も同じだけ動く（`layoutTree` を通る）。
  - 入れ子のグループへの `dragGroup` は何もしない。
  - ドラッグ全体の undo は 1 回で戻る。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/editor`、Expected: FAIL。
- [ ] **Step 3: 実装する。** 矢印キーでの移動は Task 10 の `nudge` で済んでいる。
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint`、Expected: PASS。
- [ ] **Step 5: stage for review。** `git add ui/src`

### Task 17: Inspector のグループ設定と「グループが位置を決めています」

**Files:**
- Create: `ui/src/components/group-inspector/index.tsx`、`ui/src/components/group-inspector/styles.css.ts`、`ui/src/components/group-inspector/index.test.tsx`
- Modify: `ui/src/components/inspector/index.tsx`（グループを 1 つ選んだときは `GroupInspector` を出す。グループの中の面を選んだときは、案内を出し、Bounds の X / Y を `disabled` にする）
- Create: `ui/src/components/inspector/index.test.tsx`
- Modify: `ui/src/colophon/colophon/index.tsx`（「GroupInspector / row」と「Inspector / グループが位置を決めています」を足す）

**Interfaces:**
- Consumes: `patchGroup`、`TextField`、`NumField`、`isLaidOut`
- Produces: `GroupInspector = ({ group, dispatch }: { group: Group; dispatch: Dispatch<Action> }) => JSX.Element`
- 項目と文言（HTML と CSS で作る）:
  - 名前: `TextField label="名前"`
  - 方向: `<fieldset><legend>方向</legend>` の中に、radio の「横に並べる」（row）と「縦に並べる」（column）
  - 間隔: `NumField label="間隔"`（0〜4096。範囲外は reducer で clamp する）
  - 揃え: `<fieldset><legend>揃え</legend>` の中に、radio の「先頭」「中央」「末尾」
  - 余白: `NumField label="余白"`（0〜4096）
- グループの中の面の案内: 「グループが位置を決めています」。角の座標入力は絶対座標のまま編集できる（`followCorner` を通る）。

- [ ] **Step 1: 失敗するテストを書く（jsdom）。**
  - 「縦に並べる」を選ぶと、`patchGroup` に `{ layout: { ...group.layout, direction: 'column' } }` が入る。
  - 「間隔」に 12 を入れて確定すると、`gap: 12` が送られる。
  - グループの中の面を選ぶと、「グループが位置を決めています」が出て、Bounds の X / Y が `disabled` になり、W / H と Corner は編集できる。
  - グループを 1 つ選ぶと、「名前」の値がグループの名前になる。
- [ ] **Step 2: 失敗することを確かめる。** Run: `pnpm -C ui test src/components/group-inspector src/components/inspector`、Expected: FAIL。
- [ ] **Step 3: 実装する。**
- [ ] **Step 4: 通ることを確かめる。** Run: `pnpm -C ui test && pnpm -C ui typecheck && pnpm -C ui lint && pnpm -C ui build`、Expected: PASS。`mock.html` で、グループの選択、移動、吸着、設定の変更、OBS のオーバーレイのハイライト（子孫の面がすべて選択中として描かれること）を目で確かめる。
- [ ] **Step 5: stage for review。** `git add ui/src`
