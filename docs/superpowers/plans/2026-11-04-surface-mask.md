# 面の Mask 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 面ごとに「なし / 円 / 多角形」の Mask を 1 つ持たせ、Mask の外側を OBS 出力・ドックのプレビュー・クリック判定のすべてで透明として扱う。

**Architecture:** Mask は面の単位正方形（crop 後の 0〜1、シェーダーの `s`）の座標で `Surface.mask` に保存する。OBS 側は、Mask を CPU でカバレッジ画像（R8 テクスチャ）に焼き、`warp.effect` で `s` の位置をサンプルして `inside` に掛ける。テクスチャは Mask が変わったときだけ作り直す。ドック側は、プレビューを `clip-path`、当たり判定を単位正方形での内外判定、編集を `EditorState.shapeEdit` という Mapping の外の状態で扱う。塗りつぶし規則は全体で **even-odd** に揃える。

**Tech Stack:**
- プラグイン: C++23、nlohmann/json 3.11.3、doctest 2.4.11、libobs（`gs_texture_create` / `gs_effect`）
- UI: React 19、Jotai、react-aria-components、Panda CSS（`styles.css.ts`）、vitest、tsgo、oxlint、oxfmt

**Spec:** `docs/superpowers/specs/2026-11-04-surface-mask-design.md`。日本語で書かれており、この計画より優先する。

## Global Constraints

- **ユーザーから渡された会場資料（チャート画像、会場名、そこから読み取った数値、それを再現した JSON）は、コミットにも docs にもテストにも入れない。** 確認用のデータはリポジトリの外（セッションの scratchpad）に置く。テストの fixture は汎用の数値だけを使う。
- commit はしない。各タスクの最後は `git add` だけにする（stage for review）。タスクが終わったら difit を起動してユーザーにレビューを頼む。
- pnpm を使う。`pnpm -C ui test`、`pnpm -C ui lint`（警告 0）、`pnpm -C ui typecheck`（tsgo）、`pnpm -C ui build` がすべて通ること。
- vitest で red-first の TDD を行う。DOM が要るテストはファイル先頭に `// @vitest-environment jsdom` を書く。
- `oxlint-disable` は使わない。lint に引っかかったら関数を分割する。
- 関数は単一責任にする。コメントは必要なときだけ、3 行以内。
- 暗黙の副作用を作らない。購読・タイマー・I/O は利用側がつなぐ。
- 新しいコンポーネントは `ui/src/components/<kebab-case>/index.tsx` と `styles.css.ts`（と `index.test.tsx`）に置き、`ui/src/colophon/colophon/index.tsx` に追加する。colophon のリンクは `e.preventDefault()` で何もしないようにする。
- 画面の文言は `ui/src/i18n/messages/ja.ts` と `en.ts` の両方に足す（`messages.test.ts` がキーの一致を検査する）。
- 色は既存の token を使い、WCAG 2.1 AA を満たす。
- C++ は clang-format 19 で整形する。core のテストは `cmake -S core -B build_core -DOBS_MAPPING_TESTS=ON && cmake --build build_core && ctest --test-dir build_core --output-on-failure`。プラグインのビルドは `cmake --preset macos && cmake --build --preset macos`。
- **TS の `Mapping` 型は、core の `serialize_mapping` が書き出すフィールドとちょうど同じにする。** `mask` が無い面では、キー自体を出さない（`mask: undefined` も作らない）。編集モードなどドックだけの状態は `Mapping` に入れない。
- Mask の定数（TS と C++ で同じ値にする）:
  - 多角形の頂点数は 3〜64。
  - 円の width / height は 0 より大きい。座標は有限の数値で、0〜1 の外にはみ出してもよい。
  - 内外判定は even-odd。
- JSON の形（spec どおり）:
  - `"mask": { "type": "ellipse", "x": n, "y": n, "width": n, "height": n }`
  - `"mask": { "type": "polygon", "points": [[x, y], ...] }`

## Review Focus

1. **Mask 付きの mapping で echo が一致せず、resync が繰り返される。** C++ が書き出す `mask` と TS の `Mapping` が `canonicalJson` で一致するべき。→ Task 5 に、C++ の `serialize_mapping` の出力と同じ形の JSON を `readMapping` して `canonicalJson` で往復が一致するテストを置く。Task 1 に C++ の往復テストを置く。
2. **自己交差した多角形で、OBS とドックの見た目、クリック判定が食い違う。** 星形（5 点を 1 つ飛ばしで結ぶ）の中心は、3 か所すべてで外側になるべき。→ Task 2（C++ の `mask_contains` と `rasterize_mask`）と Task 6（TS の `maskContains` と `maskClipPath` が `evenodd` を含むこと）に同じ星形のテストを置く。
3. **歪ませた（台形の）面の Mask の上でのクリック。** 台形の面で、円の外側にあたる四隅をクリックすると、下の面が選ばれるべき。→ Task 7 の `surfaceAt` のテストに、台形の面に内接円を付けた場合を置く。
4. **形の編集中に、元に戻す・やり直す・リモートからの更新で面や Mask が消える。** 編集モードは自動で抜け、例外は出ないべき。→ Task 8 に、`undo` / `remote` で対象の面が消えたとき、または `mask` が無くなったときに `shapeEdit` が `null` になるテストを置く。
5. **多角形の頂点を 3 つから消そうとする、64 を超えて足そうとする。** 何も起きないべき。→ Task 8 の `removeVertex` / `insertVertex` のテストに置く。

---

## ファイル構成

| ファイル | 役割 | Task |
|---|---|---|
| `core/include/obs-mapping/model.hpp` | `Mask`（`std::variant<EllipseMask, PolygonMask>`）と `Surface::mask` | 1 |
| `core/src/mapping_json.cpp` | `mask` の検証と書き出し | 1 |
| `core/include/obs-mapping/mask.hpp`, `core/src/mask.cpp` | 内外判定、カバレッジ画像、輪郭の点列（純粋関数） | 2 |
| `data/effects/warp.effect` | Mask テクスチャを掛ける | 3 |
| `src/mask-textures.hpp`, `src/mask-textures.cpp` | 面ごとの Mask テクスチャを作る・捨てる | 3 |
| `src/draw-rules.hpp` | Mask テクスチャの解像度を決める純粋関数 | 3 |
| `src/mapping-source.cpp` / `.hpp` | 描画で Mask テクスチャを渡す | 3 |
| `src/overlay-geometry.hpp`, `src/overlay.cpp` | OBS オーバーレイに Mask の輪郭を描く | 4 |
| `ui/src/model/mapping.ts`, `ui/src/model/read.ts` | TS の `Mask` 型と読み込み・検証 | 5 |
| `ui/src/geometry/homography.ts` | 逆変換と点の写像を足す | 6 |
| `ui/src/geometry/mask.ts` | 内外判定、輪郭、clip-path、px との換算 | 6 |
| `ui/src/components/stage-surface/index.tsx` | プレビューに clip-path を掛ける | 7 |
| `ui/src/editor/stage-pick.ts`, `ui/src/components/stage-overlay/index.tsx` | Mask を見た当たり判定と輪郭 | 7 |
| `ui/src/editor/mask-edit.ts` | 初期形・頂点の追加と削除・移動・円のリサイズ（純粋関数） | 8 |
| `ui/src/editor/state.ts`, `reducer.ts`, `keys.ts` | `shapeEdit` の状態と Mask のアクション | 8 |
| `ui/src/components/stage-mask-handles/` | 形の編集ハンドル（新規） | 9 |
| `ui/src/editor/use-stage-drag.ts` | 形の編集に入る・ハンドルのドラッグ | 9 |
| `ui/src/components/mask-fields/` | Inspector の Mask 欄（新規） | 10 |
| `README.md`, `docs/manual-checks.md` | 使い方と実機の確認項目 | 11 |

PR は 2 つに分ける。**PR 1 = Task 1〜4（プラグイン）**、**PR 2 = Task 5〜11（ドック）**。PR 1 だけを merge しても、`mask` を含む JSON を Import すれば OBS 出力は切り抜かれる。

---

### Task 1: core の Mask モデルと JSON

**Files:**
- Modify: `core/include/obs-mapping/model.hpp`
- Modify: `core/src/mapping_json.cpp`（`parse_surface`, `serialize_mapping`）
- Test: `core/tests/test_mapping_json.cpp`

**Interfaces:**
- Produces:
  ```cpp
  struct EllipseMask { double x = 0, y = 0, width = 1, height = 1; bool operator==(const EllipseMask &) const = default; };
  struct PolygonMask { std::vector<Point> points; bool operator==(const PolygonMask &) const = default; };
  using Mask = std::variant<EllipseMask, PolygonMask>;
  constexpr size_t kMaskMinPoints = 3, kMaskMaxPoints = 64;
  // Surface に追加
  std::optional<Mask> mask;
  ```

- [ ] **Step 1: 失敗するテストを書く**（`TEST_CASE("mask ...")` を 5 つ）
  - 楕円の往復: `{"type":"ellipse","x":0.1,"y":-0.2,"width":0.8,"height":1.4}` を parse → `std::get<EllipseMask>(*s.mask)` の各値が一致する。`serialize_mapping` → parse で `Mapping` が `==` になる。
  - 多角形の往復: 4 点の `points` が一致し、往復で `==` になる。
  - `mask` が無い面は `s.mask == std::nullopt`。`serialize_mapping` の出力に `"mask"` の文字列が含まれない。
  - 不正な入力はエラーになる。メッセージにパスが入る:
    - `points` が 2 点 → `surfaces[0].mask.points`
    - 65 点 → `surfaces[0].mask.points`
    - `width: 0` → `surfaces[0].mask.width`
    - `type: "star"` → `surfaces[0].mask.type`
    - 点が `[1]` → `surfaces[0].mask.points[0]`
- [ ] **Step 2: 実行して失敗を確認する。** `ctest --test-dir build_core --output-on-failure` → コンパイルエラー（`EllipseMask` が無い）。
- [ ] **Step 3: `model.hpp` に型を足す。** `mapping_json.cpp` に `Mask parse_mask(const json &m, const std::string &path)` と `ordered_json mask_to_json(const Mask &)` を足す。`parse_surface` の最後で `mask` キーがあれば読む。`serialize_mapping` は `visible` の後に、値があるときだけ `o["mask"]` を書く。キーの順は `type` を先頭にする。
- [ ] **Step 4: 実行して通ることを確認する。** 既存のテストも含めて全部 PASS。
- [ ] **Step 5: stage する。** `git add core/`

### Task 2: core の Mask 幾何

**Files:**
- Create: `core/include/obs-mapping/mask.hpp`, `core/src/mask.cpp`
- Modify: `core/CMakeLists.txt`（`src/mask.cpp` を追加）, `core/tests/CMakeLists.txt`（`test_mask.cpp` を追加）
- Test: `core/tests/test_mask.cpp`

**Interfaces:**
- Consumes: Task 1 の `Mask`
- Produces:
  ```cpp
  bool mask_contains(const Mask &m, Point unit);                                     // even-odd
  std::vector<uint8_t> rasterize_mask(const Mask &m, uint32_t width, uint32_t height); // row-major, 0..255
  std::vector<Point> mask_outline(const Mask &m, int ellipse_segments);              // unit 空間の閉じた点列（先頭を末尾に繰り返さない）
  ```

- [ ] **Step 1: 失敗するテストを書く**
  - `mask_contains`: 楕円 `{0,0,1,1}` で `(0.5,0.5)` は true、`(0.02,0.02)` は false、`(1.2,0.5)` は false。楕円 `{-0.25,0,1.5,1}` で `(0.02,0.5)` は true（はみ出す円）。
  - 星形 `[[0.5,0],[0.79,0.9],[0.02,0.35],[0.98,0.35],[0.21,0.9]]` で、中心 `(0.5,0.5)` は false、先端付近 `(0.5,0.1)` は true。
  - `rasterize_mask(ellipse{0,0,1,1}, 16, 16)`: サイズが 256、`[8*16+8]` が 255、`[0]` が 0、輪郭上の画素（`[8*16+0]`）は 0 と 255 の間。
  - `rasterize_mask(polygon 全面の矩形, 4, 4)` はすべて 255。
  - `mask_outline(ellipse, 32)` は 32 点で、すべて `(x-0.5)^2/0.25+(y-0.5)^2/0.25 ≈ 1`（誤差 1e-9）。`mask_outline(polygon, 32)` は頂点そのまま。
- [ ] **Step 2: 実行して失敗を確認する。**
- [ ] **Step 3: 実装する。** `rasterize_mask` は 1 画素を 4×4 にサンプルし、`mask_contains` の数を数えて 255 倍する。画素 `(i, j)` のサンプル点は `((i + (a + 0.5) / 4) / width, (j + (b + 0.5) / 4) / height)`。多角形の判定は `ui/src/editor/stage-pick.ts` の `crosses` と同じ半直線の交差数で行う。
- [ ] **Step 4: 実行して通ることを確認する。**
- [ ] **Step 5: stage する。** `git add core/`

### Task 3: OBS 出力に Mask を掛ける

**Files:**
- Modify: `data/effects/warp.effect`
- Create: `src/mask-textures.hpp`, `src/mask-textures.cpp`
- Modify: `src/draw-rules.hpp`, `src/mapping-source.hpp`, `src/mapping-source.cpp`, `CMakeLists.txt`（`src/mask-textures.cpp` を追加）
- Test: `core/tests/test_draw_rules.cpp`

**Interfaces:**
- Consumes: Task 2 の `rasterize_mask`
- Produces:
  ```cpp
  // draw-rules.hpp: 面の描画サイズ（canvas px）から Mask テクスチャの辺の長さを決める。各辺を [16, 2048] に収める。
  std::pair<uint32_t, uint32_t> mask_texture_size(double box_w, double box_h);
  // mask-textures.hpp: graphics スレッドだけで使う。
  class MaskTextures {
  public:
    gs_texture_t *get(const std::string &surface_id, const Mask &mask, uint32_t w, uint32_t h); // 同じ (mask, w, h) なら作り直さない
    void retain(const std::set<std::string> &surface_ids); // それ以外を破棄する
    void clear();                                          // 全部破棄する（graphics context の中で呼ぶ）
  };
  ```

- [ ] **Step 1: 失敗するテストを書く。** `mask_texture_size(500, 500) == {500, 500}`、`(4, 3000) == {16, 2048}`、`(0.4, 10.2) == {16, 16}`（切り上げ後に範囲へ収める）。
- [ ] **Step 2: 実行して失敗を確認する。**
- [ ] **Step 3: `mask_texture_size` を実装する。**
- [ ] **Step 4: 実行して通ることを確認する。**
- [ ] **Step 5: シェーダーを変える。** `uniform texture2d mask_image;` と `uniform float use_mask;` を足し、`PSWarp` の戻り値に `lerp(1.0, mask_image.Sample(textureSampler, s).r, use_mask)` を掛ける。Mask の無い面では `use_mask = 0` にし、`mask_image` には `image` と同じテクスチャを渡す（未設定のサンプラーを避けるため）。
- [ ] **Step 6: `MaskTextures` を実装する。** テクスチャは `gs_texture_create(w, h, GS_R8, 1, &data, 0)`。`MappingSource` のメンバーにし、`video_render` の中で `get` と `retain` を呼ぶ。デストラクタでは `obs_enter_graphics()` / `obs_leave_graphics()` の間で `clear()` を呼ぶ。`video_render` では面ごとに `mask_image` と `use_mask` を設定する。
- [ ] **Step 7: ビルドして、実機で確認する。** `cmake --build --preset macos` が通ること。そのあと、scratchpad に置いた確認用 JSON（汎用の数値。内接円、はみ出す円、星形）を Import し、次の 3 点を目で確かめる。
  - 円の外側が透明になり、下の面が見える。
  - 輪郭にギザギザが目立たない。
  - 四隅をワープすると Mask も一緒に歪む。
- [ ] **Step 8: stage する。** `git add data/effects src CMakeLists.txt core/tests`

### Task 4: OBS オーバーレイに Mask の輪郭を描く

**Files:**
- Modify: `src/overlay-geometry.hpp`, `src/overlay.cpp`
- Test: `core/tests/test_overlay_geometry.cpp`

**Interfaces:**
- Consumes: Task 2 の `mask_outline`、既存の `unit_square_to_quad` / `Mat3`
- Produces: `std::vector<Point> warp_points(const Mat3 &h, const std::vector<Point> &unit);`（`overlay-geometry.hpp`）

- [ ] **Step 1: 失敗するテストを書く。** 矩形 `(100,100)-(300,200)` の面の `h` で `warp_points(h, {{0,0},{1,1},{0.5,0.5}}) == {{100,100},{300,200},{200,150}}`（誤差 1e-9）。
- [ ] **Step 2: 実行して失敗を確認する。**
- [ ] **Step 3: 実装する。** `overlay.cpp` では、`mask` のある面について、輪郭線を描いた後に `warp_points(h, mask_outline(mask, 64))` を閉じた折れ線として `kOutlineThickness` で描く。色は面の輪郭と同じ。ハンドルは描かない。
- [ ] **Step 4: 実行して通ることを確認し、ビルドする。**
- [ ] **Step 5: stage する。** PR 1 はここまで。

---

### Task 5: ドックの Mask モデルと読み込み

**Files:**
- Modify: `ui/src/model/mapping.ts`, `ui/src/model/read.ts`, `ui/src/geometry/fixtures.ts`
- Test: `ui/src/model/read.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type EllipseMask = { type: 'ellipse'; x: number; y: number; width: number; height: number };
  export type PolygonMask = { type: 'polygon'; points: readonly Point[] };
  export type Mask = EllipseMask | PolygonMask;
  export const MASK_MIN_POINTS = 3;
  export const MASK_MAX_POINTS = 64;
  // Surface に追加
  mask?: Mask;
  ```
  `fixtures.ts` に `withMask(s: Surface, mask: Mask): Surface` を足す。

- [ ] **Step 1: 失敗するテストを書く。**
  - 楕円と多角形の `mask` が読み込まれる。
  - `mask` の無い面は、読み込んだ結果に `'mask' in surface === false`。
  - 不正な `mask` は `kind: 'error'` になり、`message` が `surfaces[0].mask` で始まる。不正の種類は、頂点 2 点、65 点、`width: 0`、`type: "star"`、点が `[1]` の 5 つ。
  - C++ が書き出す形（`type` が先頭の楕円 mask を含む v2 JSON）を `readMapping` して `canonicalJson` を取ると、元の JSON を `canonicalJson` したものと一致する。
- [ ] **Step 2: 実行して失敗を確認する。** `pnpm -C ui test src/model/read.test.ts`
- [ ] **Step 3: 実装する。** `readSurface` で `mask` があるときだけキーを足す。検証は `checkMasks(surfaces: unknown[]): string | null` として `readChecked` の前に呼ぶ。
- [ ] **Step 4: 実行して通ることを確認する。** `pnpm -C ui test && pnpm -C ui typecheck`
- [ ] **Step 5: stage する。**

### Task 6: ドックの Mask 幾何

**Files:**
- Modify: `ui/src/geometry/homography.ts`
- Create: `ui/src/geometry/mask.ts`
- Test: `ui/src/geometry/homography.test.ts`, `ui/src/geometry/mask.test.ts`

**Interfaces:**
- Consumes: Task 5 の `Mask`、`Bounds`（`geometry/rect.ts`）
- Produces:
  ```ts
  // homography.ts
  export const invert3 = (m: Mat3): Mat3 | null;
  export const applyH = (m: Mat3, p: Point): Point | null; // w <= 0 なら null
  export const quadToUnit = (corners: Surface['corners'], p: Point): Point | null;
  export const unitToQuad = (corners: Surface['corners'], p: Point): Point | null;
  // mask.ts
  export const maskContains = (mask: Mask, unit: Point): boolean;                  // even-odd
  export const maskOutline = (mask: Mask, ellipseSegments: number): readonly Point[]; // unit 空間
  export const maskClipPath = (mask: Mask, w: number, h: number): string;         // 要素 px での CSS clip-path
  export const maskToPx = (mask: Mask, b: Bounds): Mask;    // 割合 × b.width / b.height（面自身の左上が原点）
  export const maskFromPx = (mask: Mask, b: Bounds): Mask;
  ```

- [ ] **Step 1: 失敗するテストを書く。**
  - `quadToUnit` と `unitToQuad` が台形で往復する（誤差 1e-9）。
  - `maskContains` は Task 2 と同じ点と同じ星形で、同じ結果になる。
  - `maskClipPath(ellipse{0,0,1,1}, 1000, 1000) === 'ellipse(500px 500px at 500px 500px)'`。
  - `maskClipPath(polygon, 1000, 500)` は `'polygon(evenodd, '` で始まり、各点が px になっている。
  - `maskToPx(ellipse{0,0,1,1}, {x:50,y:50,width:500,height:500})` の width が 500。`maskFromPx(maskToPx(m, b), b)` で元に戻る。
- [ ] **Step 2〜4: 実装し、通ることを確認する。**
- [ ] **Step 5: stage する。**

### Task 7: プレビューと当たり判定

**Files:**
- Modify: `ui/src/components/stage-surface/index.tsx`, `ui/src/editor/stage-pick.ts`, `ui/src/components/stage-overlay/index.tsx`, `ui/src/components/stage-overlay/styles.css.ts`
- Test: `ui/src/components/stage-surface/index.test.tsx`（無ければ作る）, `ui/src/editor/stage-pick.test.ts`, `ui/src/components/stage-overlay/index.test.tsx`

**Interfaces:**
- Consumes: Task 6 の `maskClipPath` / `maskContains` / `maskOutline` / `quadToUnit` / `unitToQuad`
- Produces: `export const surfaceContains = (s: Surface, p: Point): boolean;`（`stage-pick.ts`。四隅の中で、かつ Mask があれば Mask の中）

- [ ] **Step 1: 失敗するテストを書く。**
  - `StageSurface`: mask のある面の crop div の `style.clipPath` が `maskClipPath(mask, w, h)` と一致する。mask の無い面では `clipPath` が空。
  - `surfaceAt`: 同じ位置に 2 面を重ね、上の面に内接円を付ける。上の面の四隅付近の点では下の面の id が返り、中心では上の面の id が返る。上の面が台形の場合も同じ結果になる。
  - `StageOverlay`: mask のある面について、輪郭の `polygon`（四隅）に `pointer-events: none` が付き、当たり判定用の `polygon` の `points` が Mask の輪郭を四隅ワープした 64 点になっている。`fill-rule` は `evenodd`。
- [ ] **Step 2: 実行して失敗を確認する。**
- [ ] **Step 3: 実装する。**
  - `StageSurface` の crop div に `clipPath: maskClipPath(mask, w, h)` を付ける。
  - `inQuad` を `surfaceContains` に置き換える。
  - `SurfaceOutline` は、Mask があるとき、四隅の polygon を見た目だけにする。そのうえで、透明な塗りの当たり判定用 polygon（Mask の輪郭を `unitToQuad` で写したもの）を重ね、そこに `onPointerDown` を付ける。Mask の輪郭は見た目用の細い線としても描く。
- [ ] **Step 4: 実行して通ることを確認する。**
- [ ] **Step 5: stage する。**

### Task 8: Mask の編集操作と状態

**Files:**
- Create: `ui/src/editor/mask-edit.ts`
- Modify: `ui/src/editor/state.ts`, `ui/src/editor/reducer.ts`, `ui/src/editor/keys.ts`
- Test: `ui/src/editor/mask-edit.test.ts`, `ui/src/editor/reducer.test.ts`, `ui/src/editor/keys.test.ts`

**Interfaces:**
- Consumes: Task 5 の型
- Produces:
  ```ts
  // mask-edit.ts（すべて unit 空間）
  export type MaskKind = 'none' | 'ellipse' | 'polygon';
  export const initialMask = (kind: Exclude<MaskKind, 'none'>): Mask; // ellipse {0,0,1,1} / polygon [[0,0],[1,0],[1,1],[0,1]]
  export const maskKind = (s: Surface): MaskKind;
  export const moveMask = (m: Mask, dx: number, dy: number): Mask;
  export const moveVertex = (m: PolygonMask, i: number, to: Point): PolygonMask;
  export const insertVertex = (m: PolygonMask, edge: number, at: Point): PolygonMask; // edge と edge+1 の間。64 点なら同じ参照を返す
  export const removeVertex = (m: PolygonMask, i: number): PolygonMask;               // 3 点なら同じ参照を返す
  export type EllipseHandle = 'left' | 'right' | 'top' | 'bottom';
  export const resizeEllipse = (m: EllipseMask, handle: EllipseHandle, to: Point): EllipseMask; // 反対側の辺を固定。幅・高さは 1e-3 以上
  // state.ts
  export type ShapeEdit = { surfaceId: string; vertex: number | null };
  // EditorState に追加
  shapeEdit: ShapeEdit | null;
  // reducer の Action に追加
  | { type: 'setMask'; surfaceId: string; mask: Mask | null }    // commit。null でキーを消す
  | { type: 'dragMask'; surfaceId: string; mask: Mask }          // replaceLive
  | { type: 'enterShapeEdit'; surfaceId: string }
  | { type: 'exitShapeEdit' }
  | { type: 'selectVertex'; index: number | null }
  ```

- [ ] **Step 1: `mask-edit.ts` の失敗するテストを書く。** 各関数につき 1〜3 件。次を必ず入れる。
  - `removeVertex` は 3 点の多角形に対して同じ参照を返す。
  - `insertVertex` は 64 点の多角形に対して同じ参照を返す。
  - `resizeEllipse(…, 'left', [x, …])` で、x が右端を越えても幅が 1e-3 になる。
- [ ] **Step 2〜4: 実装し、通ることを確認する。**
- [ ] **Step 5: reducer と keys の失敗するテストを書く。**
  - `enterShapeEdit` は、対象の面が `mask` を持ち、選択がその面だけのときに限り `shapeEdit = { surfaceId, vertex: null }` にする。条件を満たさなければ何もしない。
  - `select` で選択がその面だけでなくなったら `shapeEdit = null`。
  - `setMask(null)` の後は `shapeEdit = null`。
  - `undo` / `remote` / `resynced` / `load` で、面が消えたか `mask` が無くなったら `shapeEdit = null`（Review Focus 4）。
  - `removeSelected` は、`shapeEdit.vertex !== null` のとき面を消さずに頂点を消し、`vertex = null` にする。
  - `keyAction({ key: 'Escape', … })` が `{ type: 'exitShapeEdit' }` を返す。
  - `setMask` と `enterShapeEdit` を `DRAG_BLOCKED` に足す。`dragMask` はドラッグ中に使うので足さない。
- [ ] **Step 6〜7: 実装し、通ることを確認する。** `initialEditorState` に `shapeEdit: null` を足す。
- [ ] **Step 8: stage する。**

### Task 9: ステージでの形の編集

**Files:**
- Create: `ui/src/components/stage-mask-handles/index.tsx`, `styles.css.ts`, `index.test.tsx`
- Modify: `ui/src/editor/use-stage-drag.ts`, `ui/src/components/stage-overlay/index.tsx`, `ui/src/components/stage/index.tsx`, `ui/src/colophon/colophon/index.tsx`
- Test: `ui/src/editor/use-stage-drag.test.tsx`, `ui/src/components/stage-mask-handles/index.test.tsx`

**Interfaces:**
- Consumes: Task 6・Task 8 のすべて
- Produces（`StageDrag` に追加）:
  ```ts
  onMaskHandleDown: (e: Pointer, surfaceId: string, handle: EllipseHandle | { vertex: number } | 'body') => void;
  onMaskEdgeDown: (e: Pointer, surfaceId: string, edge: number) => void;
  ```
  `Drag` に `{ kind: 'mask'; surfaceId: string; handle: …; start: Point; origin: Mask }` を足す。`applyMove` では、ポインターの位置を `quadToUnit` で unit 空間に直し、`dragMask` を送る。スナップはしない。

- [ ] **Step 1: 失敗するテストを書く（use-stage-drag）。**
  - グループの中の面を、ダブルクリック 2 回で選ぶ。もう 1 回ダブルクリックすると `enterShapeEdit` が送られる（奥が無いときだけ）。グループを選んでいる状態のダブルクリックは、今と同じく drill になる。
  - 形の編集中に背景を押すと `exitShapeEdit` が送られる。
  - 楕円の `right` ハンドルをドラッグすると `dragStart`・`dragMask`・`dragEnd` の順に送られ、`dragMask` の width が増えている。
  - 辺を押すと、押した位置に頂点が増えた `setMask` が送られる。
- [ ] **Step 2: `StageMaskHandles` の失敗するテストを書く。**
  - 楕円は 4 つの辺ハンドルと 1 つの本体を出す。多角形は頂点ハンドルと辺の当たり判定を出す。
  - 選んでいる頂点に `aria-selected` 相当のクラスが付く。
  - 位置はすべて `unitToQuad` で写した canvas 座標。
- [ ] **Step 3: 実装する。** `StageOverlay` に `shapeEdit` を渡す。編集中の面では `Handles`（四隅）を描かず、`StageMaskHandles` を描く。`Stage` は `state.shapeEdit` を渡す。colophon に `StageMaskHandles` を追加する（楕円と多角形の 2 例）。
- [ ] **Step 4: 実行して通ることを確認する。** `pnpm -C ui test && pnpm -C ui lint && pnpm -C ui typecheck`
- [ ] **Step 5: stage する。**

### Task 10: Inspector の Mask 欄

**Files:**
- Create: `ui/src/components/mask-fields/index.tsx`, `styles.css.ts`, `index.test.tsx`
- Modify: `ui/src/components/inspector/index.tsx`, `ui/src/i18n/messages/ja.ts`, `en.ts`, `ui/src/colophon/colophon/index.tsx`

**Interfaces:**
- Consumes: Task 6 の `maskToPx` / `maskFromPx`、Task 8 の `initialMask` / `maskKind` / 各アクション、既存の `Segmented`・`NumField`
- Produces: `export const MaskFields = (props: { surface: Surface; shapeEdit: ShapeEdit | null; dispatch: Dispatch<UiAction> }) => JSX.Element;`
- 文言（ja / en）: `maskHeading: '形' / 'Shape'`、`maskNone: 'なし' / 'None'`、`maskEllipse: '円' / 'Ellipse'`、`maskPolygon: '多角形' / 'Polygon'`、`maskEdit: '形を編集' / 'Edit shape'`、`maskEditDone: '編集を終える' / 'Done'`、`maskVertexHeading: (n: number) => \`頂点 ${String(n)}\` / \`Vertex ${String(n)}\``

- [ ] **Step 1: 失敗するテストを書く。**
  - 「円」を押すと `setMask` が `initialMask('ellipse')` で送られる。「なし」を押すと `mask: null` で送られる。
  - 楕円の W 欄に 500 と入れると、`maskFromPx` を通した値で `setMask` が送られる（bounds 500×500 の面で width が 1）。
  - 多角形で頂点を選んでいるときだけ、頂点の X / Y 欄が出る。
  - 「形を編集」ボタンは `mask` が無いと disabled。押すと `enterShapeEdit` が送られ、編集中は「編集を終える」になる。
- [ ] **Step 2〜3: 実装する。** `SurfaceFields` の `CropFields` の後に置く。`Inspector` は `shapeEdit` を受け取れるように props を足し、`EditorBody` から渡す。
- [ ] **Step 4: 実行して通ることを確認する。** test / lint / typecheck。colophon に、楕円・多角形・なしの 3 例を追加する。
- [ ] **Step 5: stage する。**

### Task 11: ドキュメントと実機確認

**Files:**
- Modify: `README.md`（Mask の使い方を数行）, `docs/manual-checks.md`（実機の確認項目）

- [ ] **Step 1: `docs/manual-checks.md` に確認項目を足す。**
  - 円の外が透明になり、下の面が見える。
  - 台形にワープすると Mask も歪む。
  - 輪郭がなめらか。
  - 星形の中心が抜ける。
  - Mask の外をクリックすると、下の面が選ばれる。
  - 古い版のプラグインで開いても壊れない（Mask は無視される）。
  - **会場名やチャートの数値は書かない。**
- [ ] **Step 2: 確認用 JSON を scratchpad に作り（リポジトリには置かない）、`pnpm -C ui build` → `bash scripts/install-macos.sh` → OBS で Import して確認する。**
- [ ] **Step 3: stage する。** `git status` で、確認用 JSON や会場資料がリポジトリに入っていないことを確かめる。
