# obs-mapping 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OBS に「Mapping」ソースを追加する。中の複数の四隅面に別々の OBS ソースを射影変換で貼る。ブラウザドックの編集 UI と JSON でその配置を編集できるようにする。

**Architecture:** 構成は三層に分ける。
- `core/`: libobs に依存しない C++ ライブラリ。データモデル、JSON、ホモグラフィを扱う。
- `src/`: OBS プラグイン本体。ソースの描画、編集オーバーレイ、obs-websocket vendor API を担当する。
- `ui/`: TypeScript の編集 UI。ブラウザドックで動く。

正となる状態は、プラグインのソース設定 `mapping_json` が持つ。UI は obs-websocket の vendor request で全体を送り、`MappingChanged` イベントで受け取る。UI のプレビューは、割り当てソースのスクリーンショットを CSS `matrix3d` でブラウザ側で合成する。そのため、ドラッグ中もサーバーとの往復なしで即座に反映される。

**Tech Stack:**
- プラグイン: C++20/23（`std::expected`）、obs-plugintemplate（CMake、`macos` preset）、libobs graphics（`gs_*`、`.effect`）
- C++ ライブラリ: nlohmann/json、doctest（どちらも FetchContent で取得）
- 通信: obs-websocket vendor API（`obs-websocket-api.h`）
- UI: React + Vite + TypeScript。ツール一式（mise, pnpm, tsgo, oxlint, oxfmt, vitest）は `typescript-project-setup` スキルで用意する。`obs-websocket-js` を使う。

**Spec:** `docs/superpowers/specs/2026-11-01-obs-mapping-design.md`

## Global Constraints

- 対象は macOS のみ（OBS 33.0.0）。ただし、OS 固有の API は使わない。描画は libobs の `gs_*` と `.effect` だけで行う（将来 Windows に移すため）。
- OBS の非公開 API、Qt ウィジェットの横取り、メインプレビューへの割り込みは禁止。プラグインは Qt にも frontend API にも依存しない（`ENABLE_QT OFF`、`ENABLE_FRONTEND_API OFF`）。
- 四角形を三角形 2 枚に分けて affine で描くのは禁止。ピクセルシェーダーで逆ホモグラフィを計算し、対角線の継ぎ目が出ないようにする。
- 編集オーバーレイは、`overlay` が false のときに一切描かない。
- 状態はソース設定 `mapping_json` に保存し、シーンコレクションと一緒に永続化する。
- 正となる状態はプラグインが持つ。UI からの変更は、必ず `SetMapping` を通してプラグインで検証する。
- Mapping ソースは音声を出さない（`OBS_SOURCE_AUDIO` フラグなし）。
- 座標は Mapping ソースの座標系の px。crop は割り当てソースに対する 0〜1 の正規化値（設計書で実装者に任されていたフィールドの決定）。
- 面の種別は `"type": "quad"` のみ。未知の type は検証エラーにする。
- ソース種別 ID は `obs_mapping_source`、表示名は `Mapping`。vendor 名は `obs-mapping`。

## JSON 形式（v1、本計画で確定）

```json
{
  "version": 1,
  "canvas": { "width": 1920, "height": 1080 },
  "grid": { "size": 20 },
  "surfaces": [
    {
      "id": "s-1",
      "name": "左壁",
      "type": "quad",
      "source": "VJ A",
      "crop": { "x": 0, "y": 0, "width": 1, "height": 1 },
      "corners": [[100, 100], [900, 120], [880, 700], [120, 680]],
      "visible": true
    }
  ]
}
```

- `corners` の順序は 左上, 右上, 右下, 左下。元映像の (0,0)→左上、(1,0)→右上、(1,1)→右下、(0,1)→左下 に対応する。
- 配列の順番が重なり順になる（後ろの面ほど手前）。
- 未知のフィールドは無視する（前方互換のため）。

**検証ルール**（エラーメッセージには JSON パスを含める。例: `surfaces[2].corners: expected 4 points`）

| 項目 | 条件 |
|---|---|
| `version` | `1` のみ |
| `canvas.width` / `canvas.height` | 1〜16384 の整数 |
| `grid.size` | 0 より大きく、1024 以下 |
| `surfaces[].id` | 空でない文字列で、重複しない |
| `name` / `source` | 文字列（`source` は空文字を許す） |
| `crop` | x, y ≥ 0、width, height > 0、x+width ≤ 1、y+height ≤ 1 |
| `corners` | 有限数の 4 点 |
| `visible` | bool（省略時は true） |

## Review Focus

1. **OBS で割り当てソースの名前を変えたとき**: 面が真っ黒になるのではなく、新しい名前に追従してほしい。→ Task 4 で `source_rename` シグナルを扱い、`mapping_json` を書き換える。手動確認項目あり。
2. **角を動かして、三点が一直線になる・つぶれる・ねじれる形にしたとき**: クラッシュや NaN の描画は起きず、その面だけ描画が止まり、UI に警告が出てほしい。→ Task 3 の退化ケースのテスト、Task 8 の `quadWarning` テスト。
3. **割り当てたソースのサイズが 0×0 のとき**（読み込み前のメディア、再生が終わった動画、存在しないソース）: ゼロ除算をせず、その面を描かずに残してほしい。→ Task 4 の手動確認と `should_draw_surface` のテスト。
4. **ドックを開いたまま OBS を再起動した、または websocket が切れたとき**: UI が自動で再接続し、ドラッグ中の変更を黙って捨てない（再接続後に再送する）でほしい。→ Task 7 の接続状態機械テスト。
5. **ドックを二つ開いた、または外部から `SetMapping` されたとき**: もう一方の UI に変更が反映され、ドラッグ中の自分の操作は上書きされないでほしい。→ Task 9 の `applyRemote` テスト。

---

## ファイル構成

```
obs-mapping/
  buildspec.json, CMakeLists.txt, CMakePresets.json   ← obs-plugintemplate 由来
  core/                       ← libobs 非依存。プラグインとテストの両方がリンクする
    CMakeLists.txt
    include/obs-mapping/model.hpp
    include/obs-mapping/mapping_json.hpp
    include/obs-mapping/homography.hpp
    src/mapping_json.cpp
    src/homography.cpp
    tests/CMakeLists.txt, tests/test_mapping_json.cpp, tests/test_homography.cpp
  src/
    plugin-main.cpp           ← モジュール登録
    mapping-source.hpp/.cpp   ← obs_source_info とライフサイクル
    source-cache.hpp/.cpp     ← 名前→weak ref 解決、1 フレーム 1 回の texrender
    overlay.hpp/.cpp          ← 編集オーバーレイの描画
    vendor-api.hpp/.cpp       ← obs-websocket vendor
    draw-rules.hpp            ← 描画可否の純粋関数（core/tests でテスト）
  third_party/obs-websocket-api.h
  data/effects/warp.effect
  data/locale/en-US.ini
  ui/                         ← React + Vite
    src/model/mapping.ts
    src/geometry/{snap,align,rect,homography,quad}.ts (+ .test.ts)
    src/editor/{state,reducer}.ts (+ reducer.test.ts)
    src/obs/{client,connection}.ts (+ connection.test.ts)
    src/io/{import,export}.ts (+ import.test.ts)
    src/components/{ConnectPanel,SourcePicker,Stage,SurfaceList,Inspector,Toolbar,ImportDialog}.tsx
  scripts/install-macos.sh
  scripts/vendor-smoke.mjs    ← vendor API の手動スモークテスト
  README.md
```

---

### Task 1: リポジトリとプラグインの雛形

**Files:**
- Create: obs-plugintemplate 一式、`src/plugin-main.cpp`、`src/mapping-source.hpp/.cpp`、`data/locale/en-US.ini`、`scripts/install-macos.sh`、`.gitignore`
- Modify: `buildspec.json`（`name: "obs-mapping"`、`displayName: "OBS Mapping"`）、`CMakeLists.txt`（`ENABLE_QT OFF`、`ENABLE_FRONTEND_API OFF`）

**Interfaces:**
- Produces:
  - `extern struct obs_source_info mapping_source_info;`（`mapping-source.hpp`）
  - `id = "obs_mapping_source"`、`type = OBS_SOURCE_TYPE_INPUT`、`output_flags = OBS_SOURCE_VIDEO | OBS_SOURCE_CUSTOM_DRAW`
  - 設定 `width`（int、既定 1920）、`height`（int、既定 1080）

- [ ] **Step 1:** `git init`。obs-plugintemplate の最新 master をコピーする（git 履歴は持ち込まない）。`buildspec.json` の obs-studio バージョンがテンプレートの既定で 33.0.0 以下であれば、そのまま使う。
- [ ] **Step 2:** `mapping_source_info` を実装する。get_width/get_height は設定値を返す。video_render は何もしない。get_properties には width/height の int 入力を置く。`obs_module_load` で登録する。
- [ ] **Step 3:** `scripts/install-macos.sh` を作る。`build_macos/RelWithDebInfo/obs-mapping.plugin` を `~/Library/Application Support/obs-studio/plugins/` にコピーし、既存のものは置き換える。
- [ ] **Step 4:** ビルドする。Run: `cmake --preset macos && cmake --build --preset macos`。Expected: `obs-mapping.plugin` が生成される。
- [ ] **Step 5:** インストールして OBS を起動する。Expected: ソースの追加メニューに「Mapping」が出る。追加すると 1920×1080 の透明なソースになる。OBS のログに `[obs-mapping] loaded` が出る。
- [ ] **Step 6:** Commit `chore: scaffold obs-mapping plugin from obs-plugintemplate`。すでにある `docs/superpowers/` の設計書と計画もこのコミットに含める。

### Task 2: core ライブラリ: モデルと JSON

**Files:**
- Create: `core/CMakeLists.txt`、`core/include/obs-mapping/model.hpp`、`core/include/obs-mapping/mapping_json.hpp`、`core/src/mapping_json.cpp`、`core/tests/CMakeLists.txt`、`core/tests/test_mapping_json.cpp`
- Modify: ルートの `CMakeLists.txt`（`add_subdirectory(core)` を追加し、プラグインを `obs_mapping_core` にリンクする）

**Interfaces:**
- Produces（名前空間 `obs_mapping`）:
  ```cpp
  struct Point { double x; double y; };
  struct CropRect { double x, y, width, height; };
  enum class SurfaceType { Quad };
  struct Surface { std::string id, name; SurfaceType type; std::string source;
                   CropRect crop; std::array<Point, 4> corners; bool visible; };
  struct Mapping { int version; uint32_t width, height; double grid_size;
                   std::vector<Surface> surfaces; };
  struct ParseError { std::string message; };
  std::expected<Mapping, ParseError> parse_mapping(std::string_view json);
  std::string serialize_mapping(const Mapping&);
  Mapping default_mapping(uint32_t width, uint32_t height); // grid 20、面なし
  bool rename_source(Mapping&, std::string_view from, std::string_view to); // 1 件以上変えたら true
  ```
- CMake ターゲット: `obs_mapping_core`（静的ライブラリ）。テストは単独でビルドできる: `cmake -S core -B build_core -DOBS_MAPPING_TESTS=ON && cmake --build build_core && ctest --test-dir build_core --output-on-failure`

- [ ] **Step 1: 失敗するテストを書く**（doctest）
  - `round_trip`: 上の JSON 例を parse→serialize→parse した結果が、最初の parse 結果と等しい。
  - `defaults`: `visible` を省略すると true になる。
  - `unknown_fields_ignored`: トップレベルと surface に `"foo": 1` があっても成功する。
  - 検証表の各ルールに 1 件ずつエラーテストを書き、メッセージの前方一致で確認する。
    - `version: 2` → `version: unsupported version 2`
    - `width: 0` → `canvas.width: ...`
    - `grid.size: 0` → `grid.size: ...`
    - id の重複 → `surfaces[1].id: duplicate id "s-1"`
    - crop の x+width が 1.2 → `surfaces[0].crop: ...`
    - corners が 3 点 → `surfaces[0].corners: expected 4 points`
    - corner に `null` → `surfaces[0].corners[2]: ...`
    - `type: "mesh"` → `surfaces[0].type: unknown type "mesh"`
    - JSON として壊れている → `json: ...`
  - `rename_source_updates_all`: 同じソースを使う 2 面がどちらも書き換わり、true を返す。
- [ ] **Step 2: 実行して失敗を確認する。** Run: 上の ctest コマンド。Expected: リンクエラーまたは FAIL。
- [ ] **Step 3: 実装する。** nlohmann/json で読み、検証表の順に確認する。最初のエラーで返す。serialize は上の形式でキー順を固定し、出力を安定させる。
- [ ] **Step 4: 実行して PASS を確認する。**
- [ ] **Step 5:** Commit `feat(core): mapping model and JSON v1 parse/serialize/validate`

### Task 3: core ライブラリ: ホモグラフィ

**Files:**
- Create: `core/include/obs-mapping/homography.hpp`、`core/src/homography.cpp`、`core/tests/test_homography.cpp`

**Interfaces:**
- Produces:
  ```cpp
  using Mat3 = std::array<double, 9>; // row-major
  // (0,0)->q[0], (1,0)->q[1], (1,1)->q[2], (0,1)->q[3]
  std::optional<Mat3> unit_square_to_quad(const std::array<Point, 4>& q);
  std::optional<Mat3> invert(const Mat3&);   // |det| < 1e-12 なら nullopt
  std::optional<Point> apply(const Mat3&, Point); // w が 0 に近いと nullopt
  bool is_convex_quad(const std::array<Point, 4>& q); // 自己交差や凹形なら false
  ```

- [ ] **Step 1: 失敗するテストを書く**
  - `identity_like`: 角が (0,0),(1,0),(1,1),(0,1) のとき、H は単位行列（誤差 1e-9）。
  - `maps_corners`: 任意の凸四角形で、単位正方形の 4 隅が各 q[i] に移る。
  - `projective_center`: q = (0,0),(4,0),(3,2),(1,2) のとき、(0.5,0.5) は対角線の交点に移る。affine では一致しないので、射影変換であることの確認になる。
  - `inverse_round_trip`: `apply(invert(H), apply(H, p)) ≈ p`。
  - `degenerate_collinear`: 3 点が一直線上にあるとき nullopt。
  - `degenerate_same_point`: 4 点がすべて同じとき nullopt。
  - `convexity`: 凸なら true。凹（1 点が内側）とねじれ（角の順序が交差）なら false。
- [ ] **Step 2:** 実行して FAIL を確認する。
- [ ] **Step 3: 実装する。** 標準の 4 点射影変換（Heckbert の square-to-quad 公式）を使う。分母 `den = dx1*dy2 - dx2*dy1` が |den| < 1e-12 なら nullopt を返す。
- [ ] **Step 4:** PASS を確認する。
- [ ] **Step 5:** Commit `feat(core): homography for quad corner pin`

### Task 4: Mapping ソースの描画（ワープ、ソース解決、アクティブ化）

**Files:**
- Create: `data/effects/warp.effect`、`src/source-cache.hpp/.cpp`、`src/draw-rules.hpp`、`core/tests/test_draw_rules.cpp`（draw-rules.hpp は libobs 非依存にし、core のテストから include する）
- Modify: `src/mapping-source.cpp`

**Interfaces:**
- Consumes: `parse_mapping`、`serialize_mapping`、`default_mapping`、`rename_source`、`unit_square_to_quad`、`invert`
- Produces:
  - 設定キー `mapping_json`（string）。width/height の設定は廃止し、`canvas` から取る。ソース作成時に JSON が空なら `default_mapping(1920,1080)` を入れる。
  - `struct MappingSource`（`mapping-source.hpp`）。以下を持つ。
    - `Mapping current() const;`
    - `std::expected<void, ParseError> set_mapping_json(std::string_view)`: 検証してから適用し、設定を保存する。失敗時は何も変えない。
    - `obs_source_t* source`
    - `set_overlay` は Task 5 で追加する
  - `MappingSource* mapping_source_from(obs_source_t*)`: 種別が違えば nullptr。
  - コールバック `std::function<void(MappingSource&)> on_mapping_changed`。Task 6 がイベント発行に使う。
  - `draw-rules.hpp`: `bool should_draw_surface(const Surface&, uint32_t src_w, uint32_t src_h, bool has_homography);`
  - **スレッドモデル**: video_render と video_tick はグラフィックススレッドで、`set_mapping_json` は vendor のスレッドと rename シグナルのスレッドから呼ばれる。そのため、次のように扱う。
    - 状態は `std::shared_ptr<const Mapping>`（とキャッシュした逆行列）として持ち、mutex の下で差し替える。
    - video_render は、フレームの最初に一度だけポインタのローカルコピーを取り、そのフレームの間はそれだけを使う。
    - `set_mapping_json` は検証に成功したら `obs_data` に書き、`obs_source_update` を通す。こうして、書き込みの経路を `update` コールバック一本にする。
    - `current()` はロックして中身のコピーを返す。
    - `on_mapping_changed` は任意のスレッドから呼ばれうる（Task 6 のイベント発行はそれで問題ない）。
- warp.effect の uniform:
  - `image`
  - `float4x4 inv_h`: 3×3 を左上に埋める。キャンバス px → 単位正方形への変換。
  - `float4 crop`: x, y, w, h。
  - 頂点は面のバウンディングボックス。ピクセルシェーダーで `uv = inv_h * (pos.xy, 1)` を w で割り、[0,1] の外なら discard する。最終的なサンプル座標は `crop.xy + uv * crop.zw`。

- [ ] **Step 1: 失敗するテストを書く**（`test_draw_rules.cpp`）
  - `should_draw_surface` が false になる場合: visible が false、src が 0×0、`source` が空、`has_homography` が false。
  - 上のどれにも当たらなければ true。
- [ ] **Step 2:** FAIL を確認してから実装し、PASS を確認する。
- [ ] **Step 3: `source-cache` を実装する。** 面の source 名ごとに `obs_weak_source_t` を保持し、video_tick で再解決する。見つからない名前は毎 tick 探し直す（後から作られたソースに対応するため）。
  - 再解決で参照先が変わったら、古い参照は `obs_source_remove_active_child`、新しい参照は `obs_source_add_active_child(mapping, child)` で付け替える。これで、どのシーンにも置かれていないメディアやブラウザソースも再生される。
  - 自分自身や、自分を active tree に含むソース（`obs_source_enum_active_tree` で確認）は解決しない（再帰の防止）。
  - `enum_active_sources` コールバックを実装する。
  - video_render では、1 フレームにつきソース名ごとに 1 回だけ `gs_texrender` に描く。同じソースを複数の面で使う場合は再生を共有する。
- [ ] **Step 4: video_render を実装する。** 面リストの順に、`should_draw_surface` が true の面だけを warp.effect で描く。`inv_h` は面と mapping が変わったときだけ再計算してキャッシュする。手動確認のため、get_properties に `mapping_json` の複数行テキスト入力を置く。保存時は `set_mapping_json` を通し、検証エラーはログに出す。この入力は UI 完成後も、緊急時の手段として残す。
- [ ] **Step 5: 名前の変更に追従する。** グローバルシグナル `source_rename` を購読し、`rename_source` で JSON を書き換えて保存し、`on_mapping_changed` を呼ぶ。destroy 時に購読を解除する。
- [ ] **Step 6:** ビルドしてインストールする。
- [ ] **Step 7: OBS で手動確認する。** `mapping_json` はプロパティのテキスト入力から編集する。
  - (a) 白黒の市松模様画像を割り当て、角を (100,100),(1700,50),(1300,1000),(300,900) にする。マス目の線がまっすぐで、対角線に折れがない。
  - (b) どのシーンにも置いていない動画のメディアソースを割り当て、Mapping ソースをプログラム（本番）側のシーンに置く。再生される。`obs_source_add_active_child` は親がアクティブなときだけ子をアクティブにするので、ソースプロジェクターに出しているだけでは子は「表示中」にしかならない。そのため、「アクティブ化で再開する」設定のメディアは再生されない。この仕様を README に書く。add/remove_active_child はグラフィックススレッドから呼んでよい（OBS 標準の source-clone も同じことをしている）。
  - (c) 同じソースを 2 面に割り当てる。同じフレームが出る。
  - (d) 割り当てソースの名前を変える。表示が続き、JSON の `source` が新しい名前になる。
  - (e) 存在しない名前を割り当て、後からその名前のソースを作る。表示される。
  - (f) 3 点を一直線に並べる。クラッシュせず、その面だけ消える。
  - (g) OBS を再起動し、シーンコレクションを切り替えて戻す。マッピングが残っている。
- [ ] **Step 8:** Commit `feat: render quad surfaces with per-pixel homography`

### Task 5: 編集オーバーレイ

**Files:**
- Create: `src/overlay.hpp/.cpp`
- Modify: `src/mapping-source.cpp`

**Interfaces:**
- Produces:
  ```cpp
  struct OverlayState {
    bool enabled = false;
    std::vector<std::string> selected_surface_ids;
    std::optional<std::pair<std::string, int>> selected_corner; // (surface id, 0..3)
  };
  void draw_overlay(const Mapping&, const OverlayState&); // gs の solid effect を使う
  // MappingSource に追加
  void MappingSource::set_overlay(OverlayState);
  ```
  - 設定キー `overlay`（bool、プロパティにチェックボックスを置く）。`enabled` と同期させる。選択状態は保存しない。
  - ソースの作成時（OBS の起動時やシーンコレクションの読み込み時を含む）は、`overlay` を常に false に戻す。本番前の再起動で、ハンドルが出たままになるのを防ぐため（設計書の「やってはいけないこと」）。

- [ ] **Step 1: `draw_overlay` を実装する。** libobs の線プリミティブ（`GS_LINES`）は太さや破線を指定できない。そのため、線はすべて細い長方形（2 三角形の帯）として描き、太さは px で指定する。見た目は固定値で決める。
  - グリッド: `grid_size` 間隔の線。白、alpha 0.25、太さ 1px。
  - 面の輪郭: シアン、2px。選択中の面は黄色。
  - 角のハンドル: 一辺 12px の正方形。選択中の角は 18px で赤。
  - 凸でない面（`is_convex_quad` が false）: 輪郭を赤の破線（8px 描いて 6px 空ける）にする。
- [ ] **Step 2:** video_render の最後で、`enabled` のときだけ `draw_overlay` を呼ぶ。
- [ ] **Step 3: 手動確認する。** チェックを入れると、ソースプロジェクターにグリッドとハンドルが出る。外すと完全に消える（Global Constraints）。
- [ ] **Step 4:** Commit `feat: edit overlay (grid, outlines, handles)`

### Task 6: obs-websocket vendor API

**Files:**
- Create: `third_party/obs-websocket-api.h`（obs-websocket リポジトリの `lib/obs-websocket-api.h`）、`src/vendor-api.hpp/.cpp`、`scripts/vendor-smoke.mjs`
- Modify: `src/plugin-main.cpp`（`obs_module_post_load` で `register_vendor()` を呼ぶ）

**Interfaces:**
- Consumes: `mapping_source_from`、`MappingSource::set_mapping_json`、`set_overlay`、`on_mapping_changed`
- Produces（vendor 名 `obs-mapping`。応答はすべて `{ ok: boolean, error?: string, ... }`）:

| requestType | 入力 | 成功時の応答 |
|---|---|---|
| `ListMappingSources` | なし | `{ ok, sources: [{ name, width, height }] }` |
| `GetMapping` | `{ sourceName }` | `{ ok, mapping }`（mapping は JSON v1 のオブジェクト） |
| `SetMapping` | `{ sourceName, mapping }` | `{ ok }`（検証エラーなら `ok: false, error`） |
| `SetOverlay` | `{ sourceName, enabled, selectedSurfaceIds: string[], selectedCorner: { surfaceId, index } \| null }` | `{ ok }` |

  - イベント `MappingChanged`: `{ sourceName, mapping }`。SetMapping と rename による変更で発行する。
  - obs-websocket が入っていない場合は、ログに警告を出して登録をスキップする。それ以外の機能は動かす。

- [ ] **Step 1:** `scripts/vendor-smoke.mjs` を書く。`obs-websocket-js` で接続し（URL とパスワードは環境変数 `OBS_WS_URL` / `OBS_WS_PASSWORD`）、`CallVendorRequest` で次を順に実行して結果を出力する。
  1. List
  2. Get
  3. 面を 1 つ追加した Set
  4. 再 Get して反映を確認
  5. 不正な JSON（corners が 3 点）で Set し、`ok:false` と `surfaces[0].corners` を含むエラーを確認
  6. `MappingChanged` を 1 回受信したことを確認

  どれか一つでも期待と違えば exit 1。
- [ ] **Step 2:** 実行して失敗を確認する。Run: `node scripts/vendor-smoke.mjs`。Expected: vendor が見つからず exit 1。
- [ ] **Step 3:** `vendor-api.cpp` を実装する。mapping の受け渡しは obs_data と JSON 文字列の変換（`obs_data_get_json` / `obs_data_create_from_json`）で行い、検証は `parse_mapping` に任せる。
- [ ] **Step 4:** ビルド、インストール、OBS 再起動のあと再実行する。Expected: `smoke: all passed` で exit 0。
- [ ] **Step 5:** Commit `feat: obs-websocket vendor API for mapping`

### Task 7: UI の雛形と接続

**Files:**
- Create: `ui/`（`typescript-project-setup` スキルで React アプリとして作る）、`ui/src/model/mapping.ts`、`ui/src/obs/client.ts`、`ui/src/obs/connection.ts`、`ui/src/obs/connection.test.ts`、`ui/src/components/ConnectPanel.tsx`、`ui/src/components/SourcePicker.tsx`
- Modify: `ui/vite.config.ts`（`base: './'` にして file:// で開けるようにする）

**Interfaces:**
- Produces:
  ```ts
  // model/mapping.ts: JSON v1 と同じ形
  type Point = readonly [number, number];
  type Surface = { id: string; name: string; type: 'quad'; source: string;
    crop: { x: number; y: number; width: number; height: number };
    corners: readonly [Point, Point, Point, Point]; visible: boolean };
  type Mapping = { version: 1; canvas: { width: number; height: number };
    grid: { size: number }; surfaces: readonly Surface[] };

  // obs/client.ts
  type VendorResult<T> = { ok: true } & T | { ok: false; error: string };
  interface ObsClient {
    listMappingSources(): Promise<VendorResult<{ sources: { name: string; width: number; height: number }[] }>>;
    getMapping(sourceName: string): Promise<VendorResult<{ mapping: Mapping }>>;
    setMapping(sourceName: string, mapping: Mapping): Promise<VendorResult<{}>>;
    setOverlay(sourceName: string, state: { enabled: boolean; selectedSurfaceIds: string[];
      selectedCorner: { surfaceId: string; index: number } | null }): Promise<VendorResult<{}>>;
    screenshot(sourceName: string, width: number): Promise<string>; // data URL（GetSourceScreenshot、jpg）
    onMappingChanged(cb: (sourceName: string, mapping: Mapping) => void): () => void;
  }

  // obs/connection.ts: 純粋な状態機械
  type ConnState = { kind: 'idle' } | { kind: 'connecting'; attempt: number }
    | { kind: 'open' } | { kind: 'waiting'; attempt: number; retryInMs: number }
    | { kind: 'auth_failed' };
  function nextConnState(s: ConnState, ev: 'connect' | 'opened' | 'closed' | 'auth_error' | 'retry'): ConnState;
  ```
  - 接続先の URL（既定 `ws://127.0.0.1:4455`）とパスワードは localStorage に保存する（try/catch で囲む）。

- [ ] **Step 1: 失敗するテストを書く**（`connection.test.ts`）
  - `closed` → `waiting`。retryInMs は 500, 1000, 2000, 4000 と増え、上限は 5000。
  - `waiting` + `retry` → `connecting`（attempt+1）。
  - `opened` で attempt がリセットされる。
  - `auth_error` → `auth_failed`。再試行しない。
- [ ] **Step 2:** FAIL を確認してから実装し、PASS を確認する（`pnpm vitest run`）。
- [ ] **Step 3:** `client.ts` を `obs-websocket-js` で実装する。ConnectPanel（URL、パスワード、状態表示）と SourcePicker（`listMappingSources` の結果から選ぶ）を作る。
- [ ] **Step 4: UI をプラグインに同梱する。** `ui/vite.config.ts` の `build.outDir` を `../data/ui` にする（`data/ui/` は .gitignore に入れる）。obs-plugintemplate は `data/` をプラグインの `Contents/Resources/` にコピーするので、UI は `~/Library/Application Support/obs-studio/plugins/obs-mapping.plugin/Contents/Resources/ui/index.html` に固定される。`scripts/install-macos.sh` は、cmake のビルドの前に `pnpm -C ui build` を実行する。これは将来の一式配布で、ドックの URL を固定するための下準備（設計書「次の段階」）。
- [ ] **Step 5: 手動確認する。** インストールのあと、OBS の「ドック → カスタムブラウザドック」に、上の index.html の `file://` URL を登録する。接続でき、Mapping ソースの一覧が出る。OBS を再起動すると自動で再接続する。file:// が使えなかった場合は、`pnpm preview`（http://localhost:4173）に切り替え、その旨を README に書く。
- [ ] **Step 6:** Commit `feat(ui): scaffold, obs-websocket connection, source picker`

### Task 8: UI の幾何ロジック（snap、整列、数値、警告）

**Files:**
- Create: `ui/src/geometry/snap.ts`、`align.ts`、`rect.ts`、`quad.ts`、`homography.ts`、それぞれの `.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function snapToGrid(p: Point, size: number): Point;
  type SnapHit = { point: Point; kind: 'corner' | 'edge' | 'grid' | 'none' };
  // 優先順位は corner > edge > grid。threshold はキャンバス px
  function snapPoint(p: Point, opts: { grid: number | null; others: readonly Surface[]; threshold: number }): SnapHit;
  type Bounds = { x: number; y: number; width: number; height: number };
  function boundsOf(s: Surface): Bounds;
  function rectCorners(b: Bounds): Surface['corners']; // 左上, 右上, 右下, 左下
  type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY';
  // 選択面全体のバウンディングボックスに揃える
  function alignSurfaces(ss: readonly Surface[], ids: readonly string[], mode: AlignMode): Surface[];
  // 3 面以上。両端を固定し、間隔を等しくする。2 面以下なら変化なし
  function distributeSurfaces(ss: readonly Surface[], ids: readonly string[], axis: 'x' | 'y'): Surface[];
  function translateSurface(s: Surface, dx: number, dy: number): Surface;
  type QuadWarning = 'degenerate' | 'not_convex' | null;
  function quadWarning(c: Surface['corners']): QuadWarning;
  // 元映像 (w×h) を四角形に貼る CSS matrix3d。退化していれば null
  function cssMatrix3d(srcW: number, srcH: number, c: Surface['corners']): string | null;
  ```

- [ ] **Step 1: 失敗するテストを書く**
  - `snapToGrid([13, 27], 10)` → `[10, 30]`
  - corner snap: 他の面の角 (100,100) から 5px 以内（threshold 8）の点は (100,100)、kind は corner。同じ距離にグリッドがあっても corner が勝つ。
  - edge snap: 辺 (0,0)-(100,0) の近く (50,4) → (50,0)、kind は edge。
  - threshold の外 (50,20)、かつ grid が null → kind は none で、点は変わらない。
  - `alignSurfaces` の left: 面の左端がすべて最小の x に揃う。形は変わらない（平行移動のみ）。
  - `distributeSurfaces` の x: 幅 10 の 3 面が x=0, 30, 100 にあるとき、真ん中が x=50 に移る（間隔 40 で均等）。
  - `rectCorners({x:10,y:20,width:100,height:50})` → `[[10,20],[110,20],[110,70],[10,70]]`
  - `quadWarning`: 3 点が一直線 → degenerate。凹形 → not_convex。正方形 → null。
  - `cssMatrix3d`: 結果を手で適用し、元映像の 4 隅 (0,0),(w,0),(w,h),(0,h) が corners に移る（誤差 1e-6）。退化していれば null。
- [ ] **Step 2:** FAIL を確認してから実装し、PASS を確認する。ホモグラフィの計算は core と同じ公式を TS に移す。
- [ ] **Step 3:** Commit `feat(ui): geometry — snapping, align, distribute, quad checks`

### Task 9: UI のエディタ状態（reducer、undo、同期）

**Files:**
- Create: `ui/src/editor/state.ts`、`ui/src/editor/reducer.ts`、`ui/src/editor/reducer.test.ts`

**Interfaces:**
- Consumes: Task 8 のすべての関数
- Produces:
  ```ts
  type Selection = { surfaceIds: string[]; corner: { surfaceId: string; index: 0 | 1 | 2 | 3 } | null };
  type EditorState = { mapping: Mapping; selection: Selection; dragging: boolean;
    past: Mapping[]; future: Mapping[]; lastSent: string | null; pendingRemote: Mapping | null };
  // lastSent には canonicalJson の結果を入れる
  function canonicalJson(m: Mapping): string;
  type Action =
    | { type: 'load'; mapping: Mapping }
    | { type: 'select'; selection: Selection }
    | { type: 'dragStart' } | { type: 'dragCorner'; surfaceId: string; index: 0|1|2|3; to: Point }
    | { type: 'dragSurface'; surfaceId: string; dx: number; dy: number } | { type: 'dragEnd' }
    | { type: 'nudge'; dx: number; dy: number } // 選択中の角があればその角、なければ選択中の面
    | { type: 'setCorner'; surfaceId: string; index: 0|1|2|3; to: Point }
    | { type: 'setBounds'; surfaceId: string; bounds: Bounds }
    | { type: 'align'; mode: AlignMode } | { type: 'distribute'; axis: 'x' | 'y' }
    | { type: 'addSurface'; source: string } | { type: 'removeSelected' } | { type: 'duplicateSelected' }
    | { type: 'reorder'; surfaceId: string; toIndex: number }
    | { type: 'patchSurface'; surfaceId: string; patch: Partial<Pick<Surface, 'name' | 'source' | 'crop' | 'visible'>> }
    | { type: 'setGrid'; size: number }
    | { type: 'undo' } | { type: 'redo' }
    | { type: 'sent'; json: string }
    | { type: 'remote'; mapping: Mapping };
  function reducer(s: EditorState, a: Action): EditorState;
  ```
  - snap は reducer の外（Stage コンポーネント）で `snapPoint` を通してから `dragCorner` を送る。reducer は snap しない。
  - undo の単位: ドラッグは `dragStart` から `dragEnd` までで 1 単位。それ以外は 1 操作で 1 単位。履歴は最大 100。
  - `addSurface`: キャンバス中央に、幅・高さが canvas の 1/4 の長方形で作る。id は `s-<連番>` で、既存と重ならない番号にする。

- [ ] **Step 1: 失敗するテストを書く**
  - `dragStart` → `dragCorner` ×3 → `dragEnd` のあと undo すると、ドラッグ前に戻る（1 回で戻る）。
  - `nudge` で、選択中の角だけが動く。角を選んでいなければ面全体が動く。
  - `setBounds` で、面がその長方形になる。
  - `remote` を非ドラッグ中に受けると、mapping が置き換わる。
  - `remote` をドラッグ中に受けると `pendingRemote` に保留され、`dragEnd` で自分の結果を残して破棄する。自分の操作が優先される（Review Focus 5）。
  - `remote` の mapping が、最後に送った mapping と構造的に等しければ、何もしない（自分の送信のエコー）。プラグイン側の nlohmann がキーを並べ替えたり数値の書式を変えたりするので、文字列比較は使わない。比較は `canonicalJson(m)`（キーをソートし、数値を `Number` に正規化した stringify）同士で行う。テストでは、キー順の違う同じ内容を `remote` で受けても状態が変わらないことを確認する。
  - `removeSelected` のあと、selection が空になる。
  - `addSurface` を 2 回すると、id が `s-1`、`s-2` になる。
- [ ] **Step 2:** FAIL を確認してから実装し、PASS を確認する。
- [ ] **Step 3:** Commit `feat(ui): editor reducer with undo and remote sync`

### Task 10: UI の画面（Stage、パネル、キーボード、送信）

**Files:**
- Create: `ui/src/components/Stage.tsx`、`SurfaceList.tsx`、`Inspector.tsx`、`Toolbar.tsx`、`ui/src/App.tsx`、`ui/src/editor/useSync.ts`

**Interfaces:**
- Consumes: `ObsClient`、`reducer`、`snapPoint`、`cssMatrix3d`、`quadWarning`
- Produces（画面の振る舞い）:
  - **Stage**: キャンバスと同じ縦横比で幅いっぱいに表示する。各面は、割り当てソースのスクリーンショット（`screenshot(source, 480)`、10fps、ソース名ごとに 1 回）を、crop を反映した `<img>` + CSS `matrix3d` で描く。上に SVG で輪郭とハンドルを重ねる。
    - これは意図した選択。Mapping ソース自体の出力ではなく、子ソースの画像をブラウザで合成するので、ドラッグが往復なしで即座に反映される。その代わり、ドックのプレビューにはワープシェーダーの不具合が映らない。最終的な正しさはプロジェクター出力で確認する。
    - 角をドラッグ → snap → `dragCorner`。面の内側をドラッグ → `dragSurface`。`snapPoint` の `others` には、ドラッグ中の面を除いたすべての面を渡す（自分の角に吸着しないように）。
    - Option キーを押している間は snap を無効にする。snap の threshold は画面上の 8px をキャンバス px に換算する。
    - グリッドを表示する。`quadWarning` が null でない面には、赤い破線と警告アイコンを出す。
  - **キーボード**（Stage にフォーカスがあるとき）:
    - 矢印キー: 1px の nudge。Shift+矢印: 10px。nudge は snap しない。
    - Delete / Backspace: 削除。
    - Cmd+Z: undo。Cmd+Shift+Z: redo。
    - Cmd+D: 複製。
  - **SurfaceList**: 一覧、選択（Shift で複数選択）、ドラッグでの並べ替え、表示切り替え、追加ボタン（割り当てるソースは OBS の入力一覧から選ぶ）。
  - **Inspector**: 名前、割り当てソース、選択中の角の x/y、面の x/y/width/height（`setBounds`）、crop の x/y/width/height（0〜1）。
  - **Toolbar**: 整列 6 種、等間隔 2 種、グリッド間隔、オーバーレイのオン・オフ、書き出し、読み込み。
  - **useSync**:
    - mapping が変わったら `setMapping` を送る。ドラッグ中は最大 30Hz に間引く。dragEnd では必ず送る。
    - 送ったら `sent` を dispatch する。`MappingChanged` を受けたら `remote` を dispatch する。
    - selection やオーバーレイ状態が変わったら `setOverlay` を送る。
    - 送信に失敗したら（切断中など）最新の mapping を保持し、再接続したときに再送する（Review Focus 4）。`ok:false` ならトーストで error を表示する。

- [ ] **Step 1:** 上を実装する。ロジックは Task 8 と 9 の関数に任せ、コンポーネントには計算を書かない。
- [ ] **Step 2:** `pnpm build` と lint と型チェックを通す。Expected: エラー 0。
- [ ] **Step 3: OBS で手動確認する。**
  - (a) 角のドラッグが、プロジェクター出力に 0.1 秒程度で反映される。
  - (b) グリッド、他の面の角、他の面の辺に吸着する。Option を押すと吸着しない。
  - (c) 3 面を選んで左揃えと横等間隔ができる。
  - (d) 矢印キーで 1px、Shift+矢印で 10px 動く。
  - (e) ドラッグ 1 回分が Cmd+Z 1 回で戻る。OBS 本体の undo のショートカットに Cmd+Z を取られてドックに届かない場合に備え、Toolbar にも undo/redo ボタンを置く。
  - (f) ドックを 2 つ開き、片方の変更がもう片方に反映される。
  - (g) OBS を落として再起動すると、ドックが再接続し、未送信の変更が反映される。
- [ ] **Step 4:** Commit `feat(ui): stage, panels, keyboard, sync`

### Task 11: JSON の書き出しと読み込み

**Files:**
- Create: `ui/src/io/import.ts`、`ui/src/io/export.ts`、`ui/src/io/import.test.ts`、`ui/src/components/ImportDialog.tsx`

**Interfaces:**
- Produces:
  ```ts
  type ImportResult =
    | { kind: 'ok'; mapping: Mapping }
    | { kind: 'mismatch'; mapping: Mapping; current: { width: number; height: number } }
    | { kind: 'error'; message: string };
  // 構造の軽い検証のみ。最終的な検証は SetMapping でプラグインが行う
  function parseImport(text: string, current: Mapping['canvas']): ImportResult;
  function scaleMapping(m: Mapping, width: number, height: number): Mapping; // 角を sx, sy 倍、canvas を差し替える。grid と crop はそのまま
  function exportMapping(m: Mapping): string; // 2 スペースのインデント
  ```

- [ ] **Step 1: 失敗するテストを書く**
  - 解像度が同じ JSON → ok。違う JSON → mismatch で、current に現在の値が入る。
  - 壊れた JSON → error。メッセージは `json:` で始まる。
  - `version` がない → error。
  - `scaleMapping` で 1920×1080 → 1280×720 にすると、角 (1920,1080) が (1280,720) になる。
  - `exportMapping` → `parseImport` の往復で同じ mapping に戻る。
- [ ] **Step 2:** FAIL を確認してから実装し、PASS を確認する。
- [ ] **Step 3: 画面をつなぐ。**
  - 読み込みは `<input type="file" accept=".json">` で行う。
  - mismatch のときは ImportDialog で「点を比率で伸縮して合わせる」か「JSON の解像度で上書きする」かを選ぶ。
  - 決まったら `setMapping` を送る。`ok:false` なら error を表示し、現在のマッピングはそのまま残す。
  - 書き出しは Blob と `<a download="mapping.json">` で行う。
- [ ] **Step 4: 手動確認する。**
  - 書き出したファイルを別の Mapping ソースに読み込むと、同じ配置になる。
  - 1280×720 で作った JSON を 1920×1080 のソースに読み込み、伸縮と上書きの両方を試す。
  - corners が 3 点の JSON を読み込むと、プラグインのエラー（`surfaces[0].corners: expected 4 points`）が表示され、既存の配置は変わらない。
  - ブラウザドックで file input とダウンロードが動く。動かない場合は、JSON をテキストエリアに貼り付けて読み込み、クリップボードにコピーして書き出す方式を代わりに入れる。
- [ ] **Step 5:** Commit `feat(ui): JSON import/export with resolution mismatch handling`

### Task 12: README と仕上げ

**Files:**
- Create: `README.md`

- [ ] **Step 1:** README に次を書く（日本語）。
  - ビルド（`cmake --preset macos` など）
  - インストール（`scripts/install-macos.sh`）
  - obs-websocket の有効化とパスワード
  - UI のビルドとカスタムブラウザドックへの登録
  - 基本操作
  - JSON v1 の形式（本計画の表をそのまま）
  - 運用上の注意: オーバーレイは配信や録画にも映るので、本番中はオフにする
- [ ] **Step 2: 最終確認を全部まとめて行う。**
  - `ctest --test-dir build_core`
  - `pnpm -C ui vitest run`
  - `pnpm -C ui build`
  - `node scripts/vendor-smoke.mjs`
  - Expected: すべて成功する。
- [ ] **Step 3:** Commit `docs: README`
