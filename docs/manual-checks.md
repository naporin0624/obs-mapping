# 手動確認項目

## Task 1

OBS の実機でしか確認できない項目。ビルドと `obs_module_load` のエクスポートは Task 1 の時点で確認済み。

前提: OBS を終了してから `bash scripts/install-macos.sh` を実行する（既存の `obs-mapping.plugin` は置き換えられる）。

- [ ] OBS を起動し、ソースの追加メニューに「Mapping」が出る。
- [ ] 追加すると 1920x1080 の透明なソースになる（プロパティの幅・高さが 1920 / 1080）。
- [ ] OBS のログ（ヘルプ > ログファイル）に `[obs-mapping] loaded` が出る。

## Task 4

OBS の実機でしか確認できない項目。ビルドとコアのテストは Task 4 の時点で確認済み。ワープシェーダー（`data/effects/warp.effect`）は OBS 上で初めてコンパイルされるので、まずログに `failed to load warp.effect` が出ていないことを確認する。

前提: OBS を終了してから `bash scripts/install-macos.sh` を実行する。`mapping_json` は Mapping ソースのプロパティにある複数行テキスト欄から編集する（緊急用の手段として UI 完成後も残す）。

(a) 用のサンプル `mapping_json`（`source` は割り当てる白黒の市松模様画像ソースの名前に置き換える。`id` / `name` は任意）:

```json
{
  "version": 1,
  "canvas": {"width": 1920, "height": 1080},
  "grid": {"size": 20},
  "surfaces": [
    {
      "id": "s1",
      "name": "Surface 1",
      "type": "quad",
      "source": "checker",
      "crop": {"x": 0, "y": 0, "width": 1, "height": 1},
      "corners": [[100, 100], [1700, 50], [1300, 1000], [300, 900]],
      "visible": true
    }
  ]
}
```

読み込みに失敗した場合は、ログに `ignoring invalid mapping_json` と原因の JSON パスが出る。

- [ ] (a) 白黒の市松模様画像を割り当て、角を (100,100),(1700,50),(1300,1000),(300,900) にする。マス目の線がまっすぐで、対角線に折れがない。画像の上下左右が反転していない（corners[0] が画像の左上）。
- [ ] (b) どのシーンにも置いていない動画のメディアソースを割り当て、Mapping ソースをプログラム（本番）側のシーンに置く。再生される。ソースプロジェクターに出しているだけでは子は「表示中」にしかならないので、「アクティブ化で再開する」設定のメディアは再生されない（仕様。README は Task 12 で記載）。
- [ ] (c) 同じソースを 2 面に割り当てる。同じフレームが出る（再生が 2 面で同期している）。
- [ ] (d) 割り当てソースの名前を変える。表示が途切れず続き（動画が頭出しされない）、JSON の `source` が新しい名前になる。
- [ ] (e) 存在しない名前を割り当て、後からその名前のソースを作る。表示される。
- [ ] (f) 3 点を一直線に並べる。クラッシュせず、その面だけ消える。凹形や蝶ネクタイ形でも描画され、クラッシュしない。消えるのは 3 点が一直線などで変換が作れないときだけ。
- [ ] (g) OBS を再起動し、シーンコレクションを切り替えて戻す。マッピングが残っている。
- [ ] (h) 追加: 割り当てたソースを削除する。ログにエラーが出ず、そのソースをもう一度作ると表示が復活する。削除後に OBS 側でそのソースのメモリが解放される（削除がブロックされない）。
- [ ] (i) 追加: 自分自身（Mapping ソース）や、Mapping を含むシーンを面のソースに指定する。無限再帰せず、ログに警告が 1 回だけ出る。
- [ ] (j) 追加: 半透明の PNG を割り当てる。縁や半透明部分に黒い縁取りや白飛びが出ない。

## Task 5

OBS の実機でしか確認できない項目。ビルドとコアのテスト（破線の分割など）は Task 5 の時点で確認済み。`set_overlay` を呼ぶ obs-websocket 経由の操作は Task 6 以降なので、ここではプロパティのチェックボックスで確認する。

前提: OBS を終了してから `bash scripts/install-macos.sh` を実行する。Task 4 のサンプル `mapping_json` を使う。

- [ ] (a) Mapping ソースのプロパティで「Edit overlay」にチェックを入れると、ソースプロジェクターにグリッド（白の薄い線、`grid_size` 間隔）、面の輪郭（シアン）、四隅のハンドル（白の小さな正方形）が出る。
- [ ] (b) チェックを外すと、グリッド・輪郭・ハンドルが完全に消える（面の描画だけが残る）。
- [ ] (c) 3 点が一直線に近い凹形・蝶ネクタイ形の面では、輪郭が赤の破線になる。
- [ ] (d) 重要: チェックを入れたまま OBS を終了し、再起動する。「Edit overlay」は外れていて、ハンドルは出ない。シーンコレクションを切り替えて戻した場合も同様に外れている。
- [ ] (e) オーバーレイを出していてもログにエラーが出ない（`failed to load warp.effect` を含む）。
- [ ] (f) 目視: 面の凸形の輪郭が 2px、グリッドが 1px、ハンドルが 12px 四方で出ている（選択状態は Task 6 以降の API から設定するため、ここでは確認しない）。

## Task 6

OBS の実機でしか確認できない項目。ビルドとコアのテスト（`selectionJson` のパーサーを含む）は Task 6 の時点で確認済み。obs-websocket は OBS 33 に同梱されている。スモークテストは Mapping ソースのマッピングを書き換える（最後に元へ戻す）ので、ライブ配信中の OBS には向けないこと。

前提:
- OBS を終了してから `bash scripts/install-macos.sh` を実行し、OBS を起動する。
- OBS の「ツール > WebSocket サーバー設定」でサーバーを有効にし、ポートとパスワードを確認する。
- Mapping ソースを 1 つ作っておく（複数ある場合は `OBS_MAPPING_SOURCE` で指定する）。
- 初回のみ `cd scripts && pnpm install`。

実行:

```sh
OBS_WS_URL=ws://127.0.0.1:4455 OBS_WS_PASSWORD='<パスワード>' OBS_MAPPING_SOURCE='<ソース名>' node scripts/vendor-smoke.mjs
```

- [ ] (a) `smoke: all passed` が出て終了コードが 0 になる。途中で失敗した場合も `restored the original mapping` が出て、マッピングが元に戻っている。
- [ ] (b) OBS のログに `obs-websocket vendor "obs-mapping" registered` が出ていて、警告 `obs-websocket not found` は出ていない。
- [ ] (c) obs-websocket を無効にした状態（またはモジュールを外した状態）で OBS を起動しても、Mapping ソースは今まで通り使える。ログに `obs-websocket not found; the obs-mapping vendor API is unavailable` の警告だけが出る。
- [ ] (d) ペイロード形式の確認: マッピングと選択状態は JSON 文字列で運ぶ（`mappingJson` / `selectionJson`）。スモークテストはこの形式を使っている。
- [ ] (e) `MappingChanged` イベント（`{sourceName, mappingJson}`）: スモークテストとは別に、`obs-websocket-js` などで `VendorEvent`（`vendorName: "obs-mapping"`）を購読しておく。Mapping ソースのプロパティの `mapping_json` 欄を編集して OK を押すと、`MappingChanged` が 1 回届き、`mappingJson` の内容が編集後の JSON になっている。内容が変わらない編集（同じ JSON のまま OK）では届かない。
- [ ] (f) 面に割り当てているソースの名前を変更すると、その面を持つ Mapping ソースから `MappingChanged` が 1 回届き、`mappingJson` の `source` が新しい名前になっている。割り当てていないソースの名前変更では届かない。

## Task 7

OBS の実機でしか確認できない項目。UI のビルド・型検査・lint・接続状態機械のテストは Task 7 の時点で確認済み。

前提:
- OBS を終了してから `bash scripts/install-macos.sh` を実行する（UI のビルド、cmake のビルド、インストールの順に走る。バンドルに UI がなければ失敗する）。OBS を起動し、「ツール > WebSocket サーバー設定」でサーバーを有効にして、ポートとパスワードを確認する。
- Mapping ソースを 1 つ以上作っておく。

手順:
- OBS の「ドック > カスタムブラウザドック」を開き、ドック名（例: `obs-mapping`）と次の URL を登録する（スペースは `%20` にする）:
  `file:///Users/<ユーザー名>/Library/Application%20Support/obs-studio/plugins/obs-mapping.plugin/Contents/Resources/ui/index.html`

チェック:
- [ ] (a) ドックが空白にならず、URL（既定 `ws://127.0.0.1:4455`）とパスワード欄、「接続」ボタンが表示される。
- [ ] (b) パスワードを入れて「接続」を押すと「接続済み」と表示され、「Mapping ソース」の選択肢に Mapping ソースの一覧（名前と解像度）が出る。「更新」で再取得できる。
- [ ] (c) 間違ったパスワードでは「認証に失敗しました」と表示され、再試行しない。
- [ ] (d) 接続後に OBS を再起動すると、ドックが自動で再接続し、「接続済み」に戻る（OBS の起動中は「再接続まで N 秒」が 0.5, 1, 2, 4, 5 秒の間隔で表示される）。URL とパスワードは保存されている。
- [ ] (e) 「切断」を押すと「未接続」になり、再接続を試みない。
- [ ] (f) file:// で開けない場合（ドックが空白、または DevTools に読み込みエラーが出る場合）: `pnpm -C ui preview`（http://localhost:4173）に切り替えて URL をドックに登録し、その旨を README に書く。

## Task 10

OBS の実機でしか確認できない項目。UI のビルド・型検査・lint・送信キュー／キー操作／スナップ計算のテストは確認済み（ブラウザ上でモックを使ったドラッグ、矢印キー、Cmd+Z の動作も確認済み）。

前提:
- OBS を終了してから `bash scripts/install-macos.sh` を実行し、OBS を起動する。WebSocket サーバーを有効にし、Task 7 の手順でドックを登録して接続する。
- Mapping ソースを 1 つ作り、その子ソース（カメラなど）を 1 つ以上用意する。プロジェクター出力（またはプレビュー）で Mapping ソースの出力を見えるようにしておく。
- ドックの UI ラベルは英語（Connect / Source / Surfaces / Add / Delete / Align / Distribute / Grid / Overlay / Undo / Redo）。

チェック:
- [ ] (a) 「Source」で Mapping ソースを選び、「Add」で面を追加する。角をドラッグすると、プロジェクター出力に 0.1 秒程度で反映される。
- [ ] (b) 角のドラッグがグリッド、他の面の角、他の面の辺に吸着する。Option キーを押している間は吸着しない。
- [ ] (c) 面を 3 つ作って Shift+クリックで全部選び、「Align > Left」で左揃え、「Distribute > Horizontal」で横方向の等間隔になる。
- [ ] (d) Stage をクリックしてフォーカスし、矢印キーで 1px、Shift+矢印で 10px 動く。Delete / Backspace で削除、Cmd+D で複製できる。
- [ ] (e) ドラッグ 1 回分が Cmd+Z 1 回で戻り、Cmd+Shift+Z でやり直せる。OBS 本体が Cmd+Z を取ってドックに届かない場合は、ツールバーの「Undo」「Redo」ボタンで同じ操作ができることを確認する。
- [ ] (f) ドックを 2 つ開き、片方の変更がもう片方に反映される。
- [ ] (g) OBS を落として再起動すると、ドックが再接続する。OBS が落ちている間に行った変更は、再接続後に OBS へ反映される。
- [ ] (h) 「Overlay」を切り替えると、プロジェクター出力の輪郭とハンドルの表示が切り替わる。選択した面と角がオーバーレイにも反映される。
- [ ] (i) 四角形をねじって凸でなくすると、Stage の該当の面が赤の破線になり「NOT CONVEX」と表示される。

注意:
- Stage は Mapping ソース自体の出力ではなく、子ソースのスクリーンショットをブラウザで合成して表示する。そのためドックのプレビューにはワープシェーダーの不具合が映らない。最終的な正しさはプロジェクター出力で確認する。
- Task 7 のチェック項目に書いた「接続」「切断」「パスワード」「更新」のボタン表記は、それぞれ Connect / Disconnect / Password / Reload に変わっている。
