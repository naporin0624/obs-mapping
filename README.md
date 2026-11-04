# obs-mapping

OBS Studio 用のプロジェクションマッピング・プラグインです。「Mapping ソース」を追加し、OBS 内の別ソース（カメラ、メディア、シーンなど）を四角形の面にワープして貼り付けます。面の配置は、OBS のカスタムブラウザドックで動く専用 UI から、obs-websocket 経由で操作します。

- 動作を確認しているのは macOS（Apple Silicon / Intel のユニバーサルビルド）です。Windows（x64）版もリリースに含めていますが、実機での確認はまだです。
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

どの方法でも、OBS を終了してから行います。パッケージは [Releases](https://github.com/naporin0624/obs-mapping/releases) から入手します。ファイル名の `<version>` はリリースのバージョンです。

### macOS（リリースから）

プラグインには Apple の署名と公証がありません。そのため、初回は Gatekeeper に止められます。

- `obs-mapping-<version>-macos-universal.pkg`: インストーラーです。開けない場合は「システム設定 > プライバシーとセキュリティ」で「このまま開く」を押すか、次のコマンドで隔離属性を外してから開きます。インストール先は `~/Library/Application Support/obs-studio/plugins/obs-mapping.plugin` です。

  ```sh
  xattr -dr com.apple.quarantine ~/Downloads/obs-mapping-<version>-macos-universal.pkg
  ```

- `obs-mapping-<version>-macos-universal.tar.xz`: プラグイン本体の圧縮ファイルです。展開した `obs-mapping.plugin` を `~/Library/Application Support/obs-studio/plugins/` に置き、隔離属性を外します。

  ```sh
  xattr -dr com.apple.quarantine ~/Library/Application\ Support/obs-studio/plugins/obs-mapping.plugin
  ```

OBS がプラグインを読み込まない場合は、置いた `obs-mapping.plugin` に対して上の `xattr` を実行してから、OBS を起動し直してください。

### Windows（リリースから）

`obs-mapping-<version>-windows-x64.zip` を展開し、中の `obs-mapping` フォルダーを `C:\ProgramData\obs-studio\plugins\` に置きます（フォルダーがなければ作ります）。次の配置になれば正しく置けています。

```
C:\ProgramData\obs-studio\plugins\obs-mapping\bin\64bit\obs-mapping.dll
C:\ProgramData\obs-studio\plugins\obs-mapping\data\ui\index.html
```

### macOS（ソースから）

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

Windows では次の URL です。

```
file:///C:/ProgramData/obs-studio/plugins/obs-mapping/data/ui/index.html
```

3. ドックに URL（既定 `ws://127.0.0.1:4455`）とパスワードを入れて「接続」（English では Connect）を押す。ドックの表示言語は OBS の言語に従い、日本語以外は英語になる。URL とパスワードは保存され、次回以降は自動で再接続します。

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
| キャンバス外の余白 | Stage はキャンバスの周りに長辺の 1/8 の余白を表示する。キャンバスからはみ出した角も、この範囲ならドラッグできる |
| Delete / Backspace | 選択中の面を削除 |
| Cmd+D | 面を複製 |
| クリック | 一番外側のグループを選ぶ（グループに入っていない面は面そのもの）。グループの中の階層を選んだ後は、同じ階層のまま選び直す |
| ダブルクリック | 選択を 1 段ずつ中に入れる（グループ → 入れ子のグループ → 面） |
| Cmd+クリック | 一番深い面を直接選ぶ（選択には足さない） |
| Shift+クリック | 選択に足す、または外す。ツールバーの整列・等間隔のアイコンボタン（名前はツールチップに出る。左揃え、横に等間隔など）で整列・等間隔配置 |
| 敷き詰め（Tile） | ツールバーのアイコンボタンでポップオーバーを開き、列・行・間隔（px）を決めて「適用」。キャンバス全体を均等なマスに分け、選んだ面を左上から読む順にマスへ収める（四隅を長方形に戻すので台形補正は消える）。マスより多い面はそのまま。グループを 1 つだけ選んだときは「横一列 / 縦一列」と間隔を選び、キャンバスをグループの面の数で等分して面をレイヤー順に収め、グループの並び方・間隔もそれに合わせる（余白 0、原点は左上）。中にグループがあるグループと、グループの中のグループは敷き詰められない。あとから面を足したときはもう一度「敷き詰め」を押す。1 回の Undo で戻る |
| 元に戻す / やり直す（Undo / Redo） | ツールバーのアイコンボタン（ツールチップに名前が出る）、または Cmd+Z / Cmd+Shift+Z。OBS 本体が Cmd+Z を取る場合があるので、ボタンを使うのが確実 |
| エクスポート / インポート（Export / Import） | ツールバーのアイコンボタン（ツールチップに名前が出る）。JSON の書き出し・読み込み（後述） |
| オーバーレイ（Overlay） | OBS の出力に輪郭とハンドルを描く編集用オーバーレイのオン・オフ |

インポートは元に戻せません（履歴が消えます）。JSON と現在のソースで解像度が違う場合は、スケール（Scale、比率で伸縮）、上書き（Overwrite、JSON の解像度で上書き）、キャンセル（Cancel）を選べます。

### 面の形（Mask）

面は円や多角形で切り抜けます。外側は透明になり、下の面が見えて、クリックも下の面に通ります。台形にワープすると形も一緒に歪みます。

1. 面を選び、インスペクターの「形」で「なし / 円 / 多角形」を選ぶ（English では Shape）。
2. 「形を編集」を押すか、選択中の面をダブルクリックして形の編集に入る。四隅のハンドルは隠れる。
3. 円は 4 辺のハンドルで大きさ、本体のドラッグで移動する。多角形は頂点をドラッグし、辺をクリックして頂点を足し、頂点を選んで Delete で消す（3〜64 点）。数値は X / Y / W / H でも直せる。
4. Esc か面の外のクリックで編集を終える（面は選択されたまま）。

OBS の出力では、形を小さなテクスチャ（一辺 16〜1024px の 2 のべき乗）にして使います。形を変えたときと、面の大きさが段階をまたいだときだけ作り直します。

## 運用上の注意

- **オーバーレイは配信や録画にも映ります。** 編集用の輪郭とハンドルは Mapping ソースの出力に直接描かれるため、本番中は Overlay をオフにしてください。OBS を起動した時点で、オーバーレイは必ずオフに戻ります。ドックを表示したまま OBS を再起動しても、ドックが勝手にオンにすることはありません（オン・オフの値はプラグインが持ち、ドックはそれに従います）。
- どのシーンにも入っていないソースを面に割り当てた場合、そのソースは Mapping ソースが Program でアクティブなときだけ再生されます。
- 「アクティブになったときに再生を最初から」を有効にしたメディアは、ソースプロジェクターだけでは再生されません。
- 凸でない四角形もそのまま描画されます（オーバーレイでは赤い破線の輪郭になります）。退化した四角形（3 点が一直線上）は表示されなくなります。
- Stage は子ソースのスクリーンショットをブラウザ上で合成して表示しています。最終的な見た目は、プロジェクター出力で確認してください。

## JSON v2 形式

```json
{
  "version": 2,
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
  ],
  "groups": [
    {
      "id": "g-1",
      "name": "パネル列",
      "visible": true,
      "origin": [100, 100],
      "layout": { "direction": "row", "gap": 20, "align": "start", "padding": 0 }
    }
  ],
  "layers": [
    { "group": "g-1", "children": [{ "surface": "s-1" }] }
  ]
}
```

- `corners` の順序は 左上, 右上, 右下, 左下。元映像の (0,0)→左上、(1,0)→右上、(1,1)→右下、(0,1)→左下 に対応する。
- 木の各ノードは `{ "surface": id }` か `{ "group": id, "children": [...] }` のどちらか。`layers` を深さ優先でたどった順番が重なり順になる（後ろほど手前）。
- `surfaces` の並び順は、`layers` を深さ優先でたどった順番と同じにする。
- グループの `visible` が false なら、その下の面は描画されない。描画しないだけで、割り当てたソースの扱いは変わらない。
- 未知のフィールドは無視する（前方互換のため）。
- v1（`groups` と `layers` を持たない形式）も読める。すべての面が最上位に並ぶ v2 として扱い、ドックが保存すると v2 で書き出す。
- 古いプラグインに v2 を送るとエラーになる（ドックとプラグインは同じバンドルで配る）。

検証ルール（エラーメッセージには JSON パスを含みます。例: `surfaces[2].corners: expected 4 points`）

| 項目 | 条件 |
|---|---|
| `version` | `1` か `2` |
| `canvas.width` / `canvas.height` | 1〜16384 の整数 |
| `grid.size` | 0 より大きく、1024 以下 |
| `surfaces[].id` | 空でない文字列で、重複しない |
| `name` / `source` | 文字列（`source` は空文字を許す） |
| `crop` | x, y ≥ 0、width, height > 0、x+width ≤ 1、y+height ≤ 1 |
| `corners` | 有限数の 4 点 |
| `visible` | bool（省略時は true） |
| `groups`（v2） | 必須。配列 |
| `groups[].id` | 空でない文字列で、面の ID とも重複しない |
| `groups[].visible` | bool（省略時は true） |
| `groups[].name` / `origin` | `name` は文字列、`origin` は有限数の `[x, y]`（どちらも必須） |
| `groups[].layout.*` | `direction` は `row` / `column`、`align` は `start` / `center` / `end`、`gap` と `padding` は 0〜4096（どれも必須） |
| `layers`（v2） | 必須。ノードは `surface` か `group` のどちらか 1 つ。存在しない ID、同じ ID の 2 回目の出現、木にない面とグループはエラー。深さは 16 まで。子のないグループは許す |
| `surfaces` の並び順（v2） | `layers` を深さ優先でたどった順番と同じ |

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
- JSON v2 の検証エラー（上の表のパスつきメッセージ）、または `selectionJson` のパースエラー

`requestId` は `SetMapping` が任意の文字列で渡せます。その `SetMapping` が起こした `MappingChanged` は同じ `requestId` を持ちます。ドックは、これで自分の送信のエコーを見分けます。内容が変わらない `SetMapping` でも、`requestId` があれば `MappingChanged` を 1 回発行します（`requestId` がなければ従来どおり発行しません）。プロパティ欄の編集、ソース名の変更、`requestId` なしの `SetMapping` が起こした `MappingChanged` には `requestId` が付きません。空文字と、文字列でない値（数値や null など）は、付いていないものとして扱います。検証に失敗した `SetMapping` は `requestId` があっても `MappingChanged` を発行しません。イベントの `mappingJson` は発行時点の現在値なので、並行した別のクライアントの変更を含むことがあります。

`selectionJson` を省略すると、選択なしとして扱います。`enabled` を省略すると、現在のオン・オフはそのままで、選択だけを更新します（ドックは選択の変更ではこの形で送ります）。

## デモサイト

`site/` に、面の貼り付けを試せるデモサイト（Astro + three.js、日本語と英語）があります。

```sh
pnpm -C site install --frozen-lockfile
pnpm -C site test        # unit と browser のテスト
pnpm -C site test:dist   # build して dist のページを検査
pnpm -C site dev         # 開発サーバー
```

Cloudflare Workers（静的アセット）へのデプロイは `cf` CLI で行います。`cf` は Astro プロジェクトから切り離して `site/deploy/` に入れています。デプロイは手元からだけで、GitHub Actions には載せていません。

```sh
export CLOUDFLARE_ACCOUNT_ID=<自分のアカウント ID>
pnpm -C site deploy:install
pnpm -C site/deploy exec cf auth login   # 自分でログインする
pnpm -C site deploy:dry                  # build して設定を検証する（認証不要）
pnpm -C site deploy                      # build して公開する
```

公開先は Worker `obs-mapping-site`、ドメインは `obs-mapping.napochaan.dev` です。

## 今後の予定（未実装）

- macOS 版の署名と公証。CI は、リポジトリのシークレットに `MACOS_SIGNING_*`（公証には `MACOS_NOTARIZATION_*` も）を登録すると、自動で署名するようになっています。
- Windows 版の実機での動作確認。

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

## リリース

リリースは [release-please](https://github.com/googleapis/release-please) で作ります。

1. `main` に [Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) 形式のコミット（`feat:`、`fix:` など）が入ると、release-please がリリース用の PR を作成・更新します。PR には次のバージョン番号、`CHANGELOG.md`、`buildspec.json` の `version` の更新が入ります。
2. その PR をマージすると、タグ（`v` なしの `0.1.0` 形式）と GitHub Release が作られます。続けて同じワークフローが Release 構成でビルドし、macOS（`.pkg` と `.tar.xz`）と Windows（`.zip`）のパッケージ、`SHA256SUMS.txt` をリリースに添付します。Ubuntu 版は CI で確認のためにビルドしますが、リリースには含めません。

1.0.0 になるまでは、`feat:` でマイナー、`fix:` でパッチが上がります。破壊的変更（`feat!:`）もマイナーです。

リポジトリの「Settings > Actions > General」で「Allow GitHub Actions to create and approve pull requests」を有効にしておく必要があります。無効だと release-please が PR を作れません。

## ライセンス

[LICENSE](LICENSE) を参照してください。
