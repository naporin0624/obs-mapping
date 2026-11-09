# インストーラー配布とドック自動表示 設計

## 意図

obs-mapping を初めて入れる人が、ファイル配置と URL の手入力でつまずかないようにする。

いま Windows の人は次の 3 つを手でやっている。

1. zip を展開して `C:\ProgramData\obs-studio\plugins\` に置く（フォルダーがなければ作る）
2. 「ドック > カスタムブラウザドック」に `file:///C:/ProgramData/.../index.html` という長い URL を入れて登録する
3. obs-websocket を有効にして、パスワードをドックに入れる

このうち 1 と 2 を無くす。3（パスワード入力）は手作業のまま残してよい。

**成功の状態:** インストーラーを実行し、OBS を開くと「OBS Mapping」ドックがもう表示されている。ユーザーはパスワードを入れて「接続」を押すだけで済む。

## ゴール

- Windows 用のインストーラー（`.exe`）を作り、GitHub Release に添付する
- macOS は今ある `.pkg` を引き続き配る
- プラグイン自身が OBS の起動時に「OBS Mapping」ドックを登録する（Windows と macOS の両方）
- 署名されていないインストーラーの警告を越える手順を README とサイトで案内する

## やらないこと

- コード署名と公証（Apple Developer ID、Windows のコード署名証明書）。警告が出る前提で、手順の案内でカバーする
- WebSocket パスワードの自動設定
- Linux 向けのインストーラー（リリースアセットが今もない）
- 手動で登録済みのカスタムブラウザドックの自動削除や移行。README での案内だけにする
- zip と tar.xz の廃止。上級者向けに今まで通り配る

## 失敗とみなすこと（動いていても）

- obs-browser がない環境（ブラウザ無効のビルドなど）で OBS が落ちる、またはプラグイン全体が読み込まれなくなる
- 接続 URL とパスワードが OBS を再起動するたびに消えて、毎回入れ直しになる（README が約束している自動再接続が壊れる）
- インストーラーの中身と zip の中身が食い違う
- 上書きインストールで古いファイルが残り、新旧が混ざる

## 制約

- 対象は OBS 31.1.1 以降（`buildspec.json`）。`obs_frontend_add_dock_by_id` は OBS 30 以降の API なので使える
- ライセンスは GPL-2.0。obs-browser のヘッダーを取り込む場合もライセンスは問題ない
- 勝手に commit しない（CLAUDE.md）。小さいタスクに分け、終わるたびに difit でレビューを頼む
- 実装は TDD。ただしドック登録とインストーラーは OBS や Windows 実機に依存するので、自動テストできる範囲（URL 生成などの純粋な部分）をテストし、残りは `docs/manual-checks.md` に手動確認として追記する

## 決まったこと

### 1. ドックの自動表示（プラグイン側, Windows / macOS 共通）

- プラグインが OBS の起動時に、obs-browser のパネル API（`browser-panel.hpp` の `obs_browser_init_panel()` → `QCef::create_widget()`）でブラウザウィジェットを作る。それを `obs_frontend_add_dock_by_id()` でドックとして登録する
- 有効にするには `CMakeLists.txt` の `ENABLE_FRONTEND_API` と `ENABLE_QT` を ON にする。Qt6 は `buildspec.json` ですでに取得しているので、CI の依存は増えない
- `browser-panel.hpp` は obs-studio のソースアーカイブに含まれない（obs-browser は submodule）。`third_party/` に取り込む
- ドックの ID は固定で `obs-mapping`、タイトルは「OBS Mapping」。OBS はドックの表示状態と配置を ID ごとに保存する
- **初回の表示（決定）:** OBS 31.1.1 の `obs_frontend_add_dock_by_id` は、登録したドックを「非表示のフローティング」にする（`frontend/OBSStudioAPI.cpp`）。このままでは成功の状態にならないので、プラグインが初回だけ自分でドックを表示し、**メインウィンドウの右側にドッキング**する
  - 「初回」の判定は、プラグインが `obs_module_config_path()` に持つフラグで行う。マシン単位で、OBS のプロファイルには依存させない（私の判断）
  - 2 回目以降と上書きインストール（アップデート）では、プラグインは表示に手を出さない。OBS が保存したドックの状態に従うので、ユーザーが閉じたり動かしたりした状態が保たれる（私の判断）
  - OBS が保存した DockState を正しく当てるには、メインウィンドウがレイアウトを復元する前にドックを登録しておく必要がある。登録のタイミングはこれを満たすように選ぶこと
- 表示する URL は `obs_module_file("ui/index.html")` から作る。macOS のパスには空白が入るので、`QUrl::fromLocalFile` などで正しい `file://` URL にする
- **接続情報を残す（必須）:** `create_cookie_manager()` に `obs_module_config_path()` 配下の保存先を渡し、専用のストレージにする。こうして localStorage を OBS の再起動後も残す。既存ユーザーが手動ドックに保存していた URL とパスワードは引き継がれない。新しいドックで一度入れ直してもらう前提とし、README に書く
- **obs-browser がないとき:** `obs_browser_init_panel()` が null を返したら、ログに出してドック登録だけ飛ばす。Mapping ソースと vendor API はそのまま動く。ユーザーは従来どおり手動のカスタムブラウザドックや開発サーバーで使える
- 終了時はドックとウィジェットを OBS の作法どおりに片付け、終了時にクラッシュしないようにする

### 2. Windows インストーラー

- **Inno Setup** で作る（私の判断。OBS プラグインでよく使われ、GitHub Actions の Windows ランナーに入っている）
- インストール先は `{commonappdata}\obs-studio\plugins\obs-mapping`（= `C:\ProgramData\obs-studio\plugins\obs-mapping`）。`PrivilegesRequired=admin`
- 入れる中身は、`Package-Windows.ps1` が zip にするのと同じ `release/<config>/obs-mapping/` のツリー。zip とインストーラーの中身が食い違わないよう、同じ入力から作る
- `AppId` は固定の GUID にする。上書きインストールでそのまま更新され、「アプリと機能」に 1 件だけ出る
- 上書きやアンインストールのときは、プラグインのフォルダーを丸ごと消してから入れ直す。古いファイルを残さない
- インストール中に OBS（`obs64.exe`）が起動していたら、「OBS を閉じてください」と止める。OBS には名前の決まった mutex がないので、`[Code]` でプロセスを確認する
- OBS が見つからない、またはバージョンが 31.1.1 より古いときは、**警告だけ出してインストールは続けられる**ようにする（私の判断。OBS を後から入れる人や、ポータブル版の人を止めないため）。検出にはレジストリか `obs64.exe` のファイルバージョンを使う
- アンインストールしても、ドック用の保存領域（各ユーザーの OBS 設定フォルダーにある、WebSocket のパスワードを含む localStorage）は消さない（私の判断）。管理者権限のインストーラーから各ユーザーのプロファイルには触らない。消したい人向けに、場所を README に書く
- 出力ファイル名は `obs-mapping-<version>-windows-x64-installer.exe`

### 3. macOS インストーラー

- 今の `.pkg`（`cmake/macos/resources/installer-macos.pkgproj.in`）を使う。署名はしない
- 「上書きインストールで古いファイルを残さない」は macOS にも当てはめる（私の判断）。pkg は既存のバンドルに上書きするだけで、新しい版にないファイルを消さない。UI のビルド成果物はファイル名にハッシュが付くので、そのままでは `Contents/Resources/ui` に古いファイルがたまる。pkg に preinstall スクリプトを足し、古い `obs-mapping.plugin` を消してから入れる。署名なしなので CI では実行まで確かめられない。`docs/manual-checks.md` に手動確認として載せる

### 4. CI とリリース

- `build-project.yaml` の Windows ジョブで、zip を作った後に Inno Setup で `.exe` を作る。中身が揃っているかの確認（今の zip に対する `index.html` チェックと同じ考え方）も入れる
- `release-please.yaml` の `upload-assets` が集めるファイルに `.exe` を加える。`SHA256SUMS.txt` にも載るようにする

### 5. 案内（README とサイト）

- README の「インストール」を、インストーラーを使う手順を主にして書き直す。「カスタムブラウザドックに登録する」節は、自動ドックが使えないときの代わりの手段に格下げする
- 署名がないことによる警告の越え方を書く
  - Windows: SmartScreen の「詳細情報」→「実行」
  - macOS: いまの macOS で実際に必要な手順（右クリックで開く、または「システム設定 > プライバシーとセキュリティ」の「このまま開く」）を確認してから書く。pkg で入れたファイルに quarantine 属性が付くかも確認する。付かなければ、今の `xattr` の手順は pkg の利用者には不要と書く
- 手動ドックを登録済みの人には、ドックが 2 つ並ぶので古い方を消すよう案内する
- サイトの「プラグインを入手」は今も Releases の最新版に飛ぶので、リンクはそのままでよい。手順の文言に変更が要るかは builder が判断する

## builder に任せること

- ドック登録を呼ぶタイミング（`obs_module_post_load` か `OBS_FRONTEND_EVENT_FINISHED_LOADING` か）。CEF の初期化は非同期なので、obs-studio 本体のブラウザドックのコードと、`obs_browser_init_panel` を使っている既存プラグインを読んで決めること
- cookie manager の保存先パスの具体的な名前
- Inno Setup スクリプトの置き場所（例: `cmake/windows/resources/installer-windows.iss.in`）と、バージョンを埋め込む方法
- Windows ランナーに Inno Setup が入っていなかった場合の入れ方
- タスクの分け方。ただし「ドック自動表示」と「Windows インストーラー」は別の PR にできる大きさで分けること

## 未確定のリスク

- **`file://` がドックで開けない環境がある**（README に「空白のままになる場合」の記述がある）。自動ドックでも同じことが起きうる。今回は `file://` のまま進める。実機で空白になるケースが再現したら、プラグインに小さなローカル HTTP サーバーを持たせる案を別途相談する
