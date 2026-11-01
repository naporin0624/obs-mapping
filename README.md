# obs-mapping

OBS Studio 用のプロジェクションマッピング・プラグインです。「Mapping ソース」を追加し、OBS 内の別ソース（カメラ、メディア、シーンなど）を四角形の面にワープして貼り付けます。面の配置は、OBS のカスタムブラウザドックで動く専用 UI から、obs-websocket 経由で操作します。

- 現在の対応は macOS（Apple Silicon / Intel のユニバーサルビルド）のみです。
- ドックの UI の見た目は、自作のデザインシステム Cannelloni（Panda CSS）で組んでいます。

仕様と実装計画は [docs/superpowers/](docs/superpowers/) にあります（[spec](docs/superpowers/specs/2026-11-01-obs-mapping-design.md) / [plan](docs/superpowers/plans/2026-11-01-obs-mapping.md)）。OBS の実機でしか確認できない項目は [docs/manual-checks.md](docs/manual-checks.md) のチェックリストにまとめています。

## ビルド

必要なもの: Xcode、CMake、pnpm（Node.js）。

```sh
# UI（出力先は data/ui。プラグインのビルド時に Contents/Resources/ui へコピーされる）
pnpm -C ui install --frozen-lockfile
pnpm -C ui build

# プラグイン
cmake --preset macos
cmake --build --preset macos
```

UI を先にビルドしておかないと、バンドルに UI が入りません。UI を作り直したあと（開発ビルドで確認するとき）は、`cmake --preset macos` をもう一度実行してから `cmake --build --preset macos` を行ってください。UI の出力先が変わると、バンドルへのコピー対象が更新されません。

コア（JSON の検証など、OBS に依存しない部分）の単体テスト:

```sh
cmake -S core -B build_core -DOBS_MAPPING_TESTS=ON
cmake --build build_core
ctest --test-dir build_core --output-on-failure
```

UI のテストと検査:

```sh
pnpm -C ui test
pnpm -C ui lint
pnpm -C ui typecheck
```

## インストール

OBS を終了してから実行します。

```sh
bash scripts/install-macos.sh
```

スクリプトは、UI のビルド、プラグインのビルド（`cmake --preset macos`）、バンドル内の `Contents/Resources/ui/index.html` の存在確認を順に行い、`~/Library/Application Support/obs-studio/plugins/` に `obs-mapping.plugin` をコピーします。

## obs-websocket の有効化

UI は obs-websocket のベンダーリクエストでプラグインと通信します（OBS 28 以降は標準搭載です）。

1. OBS の「ツール > WebSocket サーバー設定」を開く。
2. 「WebSocket サーバーを有効にする」をオンにする。
3. 「サーバーパスワード」を設定（または生成）する。ポート（既定は 4455）を確認する。

## UI をカスタムブラウザドックに登録する

1. 「ドック > カスタムブラウザドック」を開く。
2. ドック名（例: `obs-mapping`）と次の URL を登録する（スペースは `%20`）。

```
file:///Users/<ユーザー名>/Library/Application%20Support/obs-studio/plugins/obs-mapping.plugin/Contents/Resources/ui/index.html
```

3. ドックに URL（既定 `ws://127.0.0.1:4455`）とパスワードを入れて Connect を押す。URL とパスワードは保存され、次回以降は自動で再接続します。

`file://` で開けない場合（ドックが空白のままになる場合）は、開発用サーバーで代用します。

```sh
pnpm -C ui preview   # http://localhost:4173
```

ドックの URL に `http://localhost:4173` を登録してください（このときは `pnpm preview` を起動したままにします）。

## 基本操作

1. OBS で「ソースを追加」から Mapping ソースを作る。
2. ドックの Source で、そのソースを選ぶ。
3. Add で面を追加し、Stage 上で四隅をドラッグして位置を決める。面ごとに元映像（OBS のソース）とクロップを指定できる。
4. 配列の順番が重なり順になる（後ろの面ほど手前）。

主な操作:

| 操作 | 内容 |
|---|---|
| 角のドラッグ | グリッド、他の面の角、他の面の辺に吸着する。Option を押している間は吸着しない |
| 矢印キー | 1px 移動（Shift で 10px）。Stage をクリックしてフォーカスしておく |
| Delete / Backspace | 選択中の面を削除 |
| Cmd+D | 面を複製 |
| Shift+クリック / Cmd+クリック | 複数選択。Align / Distribute で整列・等間隔配置 |
| Undo / Redo | ツールバーのボタン、または Cmd+Z / Cmd+Shift+Z。OBS 本体が Cmd+Z を取る場合があるので、ボタンを使うのが確実 |
| Export / Import | JSON の書き出し・読み込み（後述） |
| Overlay | OBS の出力に輪郭とハンドルを描く編集用オーバーレイのオン・オフ |

Import は元に戻せません（履歴が消えます）。JSON と現在のソースで解像度が違う場合は、Scale（比率で伸縮）、Overwrite（JSON の解像度で上書き）、Cancel を選べます。

## 運用上の注意

- **オーバーレイは配信や録画にも映ります。** 編集用の輪郭とハンドルは Mapping ソースの出力に直接描かれるため、本番中は Overlay をオフにしてください。OBS を起動した時点で、オーバーレイは必ずオフに戻ります。ドックを表示したまま OBS を再起動しても、ドックが勝手にオンにすることはありません（オン・オフの値はプラグインが持ち、ドックはそれに従います）。
- どのシーンにも入っていないソースを面に割り当てた場合、そのソースは Mapping ソースが Program でアクティブなときだけ再生されます。
- 「アクティブになったときに再生を最初から」を有効にしたメディアは、ソースプロジェクターだけでは再生されません。
- 凸でない四角形もそのまま描画されます（オーバーレイでは赤い破線の輪郭になります）。退化した四角形（3 点が一直線上）は表示されなくなります。
- Stage は子ソースのスクリーンショットをブラウザ上で合成して表示しています。最終的な見た目は、プロジェクター出力で確認してください。

## JSON v1 形式

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

検証ルール（エラーメッセージには JSON パスを含みます。例: `surfaces[2].corners: expected 4 points`）

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

## ベンダー API（obs-websocket）

ベンダー名は `obs-mapping` です。ペイロードの JSON は文字列として渡します（obs_data が、オブジェクト以外の配列を保持できないためです）。

| リクエスト | 入力 | 応答 |
|---|---|---|
| `ListMappingSources` | なし | `{ ok, sources: [{ name, width, height }] }` |
| `GetMapping` | `{ sourceName }` | `{ ok, mappingJson, overlayEnabled }` |
| `SetMapping` | `{ sourceName, mappingJson, requestId? }` | `{ ok }` |
| `SetOverlay` | `{ sourceName, enabled?, selectionJson? }` | `{ ok }` |

| イベント | ペイロード |
|---|---|
| `MappingChanged` | `{ sourceName, mappingJson, overlayEnabled, requestId? }` |
| `OverlayChanged` | `{ sourceName, enabled }`（オーバーレイの有効・無効が変わったとき。`SetOverlay` でもプロパティのチェックボックスでも発行される） |

失敗時は `{ ok: false, error }` を返します。`error` は次のいずれかです。

- `source not found: <name>`
- `not a mapping source: <name>`
- `mappingJson: missing`
- JSON v1 の検証エラー（上の表のパスつきメッセージ）、または `selectionJson` のパースエラー

`requestId` は `SetMapping` が任意の文字列で渡せます。その `SetMapping` が起こした `MappingChanged` は同じ `requestId` を持ちます。ドックは、これで自分の送信のエコーを見分けます。内容が変わらない `SetMapping` でも、`requestId` があれば `MappingChanged` を 1 回発行します（`requestId` がなければ従来どおり発行しません）。プロパティ欄の編集、ソース名の変更、`requestId` なしの `SetMapping` が起こした `MappingChanged` には `requestId` が付きません。空文字と、文字列でない値（数値や null など）は、付いていないものとして扱います。検証に失敗した `SetMapping` は `requestId` があっても `MappingChanged` を発行しません。イベントの `mappingJson` は発行時点の現在値なので、並行した別のクライアントの変更を含むことがあります。

`selectionJson` を省略すると、選択なしとして扱います。`enabled` を省略すると、現在のオン・オフはそのままで、選択だけを更新します（ドックは選択の変更ではこの形で送ります）。

## 今後の予定（未実装）

- 1 つのバンドルにまとめた配布。署名なしのため、初回は「システム設定 > プライバシーとセキュリティ」で「このまま開く」が必要です。
- Windows 対応。

## 開発

`pnpm -C ui install` で husky が入り、`git commit` 時に `ui/.husky/pre-commit` が動きます。staged ファイルに応じて次を検査します。

- `ui/` 配下: `pnpm -C ui lint`（oxlint と oxfmt --check）と `pnpm -C ui typecheck`
- C/C++/Objective-C（`.c` `.h` `.cpp` `.hpp` `.m` `.mm`）: `build-aux/run-clang-format`（clang-format 19.1.1）
- CMake（`CMakeLists.txt` `*.cmake`）: `build-aux/run-gersemi`（gersemi）

C++ と CMake の検査には次のツールが必要です。未インストールの場合、フックは案内を出して失敗します。

```sh
brew install obsproject/tools/clang-format@19
brew install obsproject/tools/gersemi
```

UI のコードは `pnpm -C ui fmt`（oxlint と oxfmt --write）で整形できます。

## ライセンス

[LICENSE](LICENSE) を参照してください。
