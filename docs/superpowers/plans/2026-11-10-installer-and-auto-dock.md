# インストーラー配布とドック自動表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** インストーラーを実行して OBS を開くと「OBS Mapping」ドックが右側に出ている状態にする（Windows `.exe` 新設、macOS `.pkg` 改善、プラグインによるドック自動登録）。

**Architecture:** プラグインは `obs_module_post_load` で obs-browser のパネル API（`QCef`）を取得し、空のコンテナを `obs_frontend_add_dock_by_id` で登録する。`OBS_FRONTEND_EVENT_FINISHED_LOADING` でブラウザウィジェットを差し込み、初回だけ右側にドッキングして表示する。Windows は Inno Setup で zip と同じインストールツリーから `.exe` を作る。macOS は既存 pkg に preinstall スクリプトを足す。

**Tech Stack:** C++23 / CMake / Qt6 / obs-frontend-api / obs-browser `browser-panel.hpp` / Inno Setup 6 / pkgbuild / GitHub Actions

**Spec:** `docs/superpowers/specs/2026-11-10-installer-and-auto-dock-design.md`

## Global Constraints

- 対象 OBS: 31.1.1 以降（`buildspec.json`）
- ドック ID: `obs-mapping`、ドックタイトル: `OBS Mapping`
- Windows インストール先: `{commonappdata}\obs-studio\plugins\obs-mapping`、`PrivilegesRequired=admin`
- Windows 出力名: `obs-mapping-<version>-windows-x64-installer.exe`
- 署名・公証はしない
- zip / tar.xz は今まで通り出す
- **commit はしない。** 各 Task の最後は difit でレビューを依頼し、ユーザーの承認後にユーザーの指示で commit する（CLAUDE.md）
- コメントは 3 行以内。`oxlint-disable` 等で lint を黙らせない
- PR は 2 本: **PR A = Task 1–2（ドック）**、**PR B = Task 3–6（インストーラーと案内）**

## Review Focus

1. **obs-browser がない OBS** — ドックが出ないだけで、Mapping ソースと vendor API は動き、クラッシュしない（Task 1 の手動確認 1-3）
2. **OBS 再起動後の接続情報** — URL とパスワードが保持され、自動で再接続する（Task 1 の手動確認 1-2）
3. **OBS 終了時** — CEF の後始末の順序が原因で、終了時にクラッシュやハングが起きない（Task 1 の手動確認 1-4）
4. **macOS で `~/Library/.../obs-mapping.plugin`（`install-macos.sh` で入れた古いコピー）が残っている** — pkg のプラグインと重複して読み込まれ、ログに `Dock id 'obs-mapping' already used` が出る。preinstall はユーザーのホームに触らないので、README で削除を案内する（Task 6）。重複時は 2 個目の登録失敗をログに出して続行する（Task 1）
5. **Windows で OBS 起動中のアンインストールや上書き** — インストールと同様に止める（Task 4 の手動確認 4-1）

---

## PR A: ドック自動表示

### Task 1: ブラウザドックの登録（接続情報の永続化と obs-browser 不在時の縮退）

**Files:**
- Modify: `CMakeLists.txt`（`ENABLE_FRONTEND_API` と `ENABLE_QT` を既定 ON。`src/mapping-dock.cpp` を `target_sources` に追加）
- Modify: `CMakePresets.json`（`template` プリセットの `ENABLE_FRONTEND_API` / `ENABLE_QT` を `true`）
- Create: `third_party/obs-browser/browser-panel.hpp`（obs-browser `panel/browser-panel.hpp` を、OBS 31.1.1 が参照する obs-browser のコミットから取り込む。先頭に取得元 URL とコミットを 1 行で書く）
- Create: `src/mapping-dock.hpp`, `src/mapping-dock.cpp`
- Modify: `src/plugin-main.cpp`
- Modify: `docs/manual-checks.md`（「インストーラーとドック」節を新設）

**Interfaces:**
- Produces:
  - `void register_mapping_dock();` — `obs_module_post_load` から `register_vendor()` の後に呼ぶ
  - `void unregister_mapping_dock();` — `obs_module_unload` から `unregister_vendor()` の前に呼ぶ
  - `QDockWidget *mapping_dock_widget();` — 登録済みならドック（コンテナの `parentWidget()`）、そうでなければ `nullptr`。Task 2 が使う
  - frontend イベントコールバックを `register_mapping_dock` 内で `obs_frontend_add_event_callback` に登録する。Task 2 はこのコールバック内の `FINISHED_LOADING` 分岐から `reveal_dock_on_first_run()` を呼ぶ

自動テストできる純粋なロジックがないので（URL は `QUrl::fromLocalFile`、それ以外は OBS と CEF の呼び出しだけ）、この Task は「ビルドが通る」と「手動確認」で検証する。

- [ ] **Step 1: ビルドフラグを ON にして、既存のビルドとテストが通ることを確認する**

Run: `cmake --preset macos && cmake --build --preset macos && cmake -S core -B build_core -DOBS_MAPPING_TESTS=ON && cmake --build build_core && ctest --test-dir build_core`
Expected: ビルド成功、`obs_mapping_core_tests` PASS

- [ ] **Step 2: `register_mapping_dock()` を実装する**

  - `obs_browser_init_panel()` が `nullptr` のとき: `obs_log(LOG_WARNING, "obs-browser unavailable; dock disabled")` を出して return する
  - 空の `QWidget`（`QVBoxLayout`、余白 0）を作り、`obs_frontend_add_dock_by_id("obs-mapping", "OBS Mapping", container)` で登録する。`false` が返ったとき（重複読み込み）は `LOG_WARNING` を出してコンテナを破棄し、return する
  - ここまでを `obs_module_post_load` 内で行う。これは OBS の `restoreState(DockState)` より前なので、2 回目以降の起動ではユーザーが保存した配置が当たる
  - `OBS_FRONTEND_EVENT_FINISHED_LOADING` で次を行う
    - `cef->init_browser()` が `false` なら `cef->wait_for_browser_init()`
    - `cef->create_cookie_manager("obs_mapping_dock", true)` を作る。引数は OBS 本体の `obs_profile_cookies/<id>` と同じく、obs-browser のクッキー保存ルートからの相対パス
    - `cef->create_widget(container, url, cookies)` でウィジェットを作り、コンテナに追加する。`url` は `QUrl::fromLocalFile(QString::fromUtf8(obs_module_file("ui/index.html"))).toString().toStdString()`（`obs_module_file` の戻り値は `bfree` する）
  - `OBS_FRONTEND_EVENT_EXIT` で、ウィジェットの `closeBrowser()` → cookie manager の `FlushStore()` → `delete` の順に片付ける。参考: obs-studio 31.1.1 の `frontend/docks/BrowserDock.cpp`

- [ ] **Step 3: `plugin-main.cpp` から呼び出し、ビルドする**

Run: `cmake --build --preset macos`
Expected: 成功

- [ ] **Step 4: `docs/manual-checks.md` に手動確認を追記し、実機で確認する**

前提: OBS を終了してから `bash scripts/install-macos.sh` を実行する。
  - 1-1: OBS を起動すると「ドック」メニューに「OBS Mapping」があり、開くと UI が表示される（空白にならない）
  - 1-2: URL とパスワードを入れて接続し、OBS を再起動すると、入力なしで再接続する
  - 1-3: `obs-browser` プラグインを一時的に外して起動すると、ログに `obs-browser unavailable; dock disabled` が出る。Mapping ソースは追加でき、OBS は落ちない
  - 1-4: ドックを開いたまま OBS を終了しても、クラッシュせず 5 秒以内に終わる
  - 1-5: Windows でも 1-1 と 1-2 を確認する（CI の artifact の zip を手で配置する）

- [ ] **Step 5: clang-format と gersemi（`build-aux/run-clang-format --check`, `build-aux/run-gersemi --check`）が通ることを確認し、difit でレビューを依頼する**

### Task 2: 初回起動時に右側へドッキングして表示

**Files:**
- Modify: `src/mapping-dock.cpp`
- Modify: `docs/manual-checks.md`

**Interfaces:**
- Consumes: `mapping_dock_widget()`（Task 1）
- Produces: `static void reveal_dock_on_first_run();`（`mapping-dock.cpp` 内）

- [ ] **Step 1: `reveal_dock_on_first_run()` を実装する**

  - フラグファイル: `obs_module_config_path("dock.json")`、内容 `{"revealed": true}`。読み書きは `obs_data_create_from_json_file_safe` / `obs_data_save_json_safe`。親ディレクトリがなければ `os_mkdirs` で作る
  - `revealed` が true なら何もしない（2 回目以降とアップデートでは、OBS が復元した状態に任せる）
  - false なら、`static_cast<QMainWindow *>(obs_frontend_get_main_window())->addDockWidget(Qt::RightDockWidgetArea, dock)` → `dock->setFloating(false)` → `dock->show()` を行い、フラグを保存する
  - 呼ぶのは `FINISHED_LOADING` 分岐の最後。OBS の `restoreState` の後なので、ここで表示しても上書きされない
  - `mapping_dock_widget()` が `nullptr`（obs-browser なし、重複）のときはフラグを書かない。後で obs-browser が戻ったときに初回表示が効くようにするため

- [ ] **Step 2: ビルドする**

Run: `cmake --build --preset macos`
Expected: 成功

- [ ] **Step 3: 手動確認を追記して実機で確認する**

  - 2-1: `plugin_config/obs-mapping/dock.json` を消して OBS を起動すると、ドックが右側に組み込まれた状態で出ている
  - 2-2: ドックを閉じて再起動すると、閉じたまま
  - 2-3: ドックを左に移して再起動すると、左のまま
  - 2-4: 2-2 の状態で再インストール（アップデート）して起動しても、閉じたまま

- [ ] **Step 4: difit でレビューを依頼する。承認後、PR A を作る**

---

## PR B: インストーラーと案内

### Task 3: Windows インストーラーを CI で作り、リリースに添付する

**Files:**
- Create: `cmake/windows/resources/installer-windows.iss.in`
- Modify: `cmake/windows/helpers.cmake`（`configure_file` で `${CMAKE_BINARY_DIR}/installer-windows.iss` を生成。`@CMAKE_PROJECT_NAME@`, `@CMAKE_PROJECT_VERSION@`, `@PLUGIN_DISPLAY_NAME@`, `@PLUGIN_AUTHOR@` などを埋め込む）
- Modify: `.github/scripts/Package-Windows.ps1`（zip を作った直後に `iscc` で `.exe` を作る）
- Modify: `.github/workflows/build-project.yaml`（Windows ジョブ: `.exe` の存在と中身の確認ステップを追加。artifact の glob `windows-x64*.*` はそのまま `.exe` も拾う）
- Modify: `.github/workflows/release-please.yaml`（`upload-assets` の `files=(...)` に `*-windows-x64-installer.exe` を追加。`SHA256SUMS.txt` は同じディレクトリから作るので自動で載る）

**Interfaces:**
- Produces: `release/obs-mapping-<version>-windows-x64-installer.exe`

- [ ] **Step 1: 失敗する確認ステップを先に `build-project.yaml` に足す**

`.exe` が `release/` にあること。さらに `innounp -v`（または `iscc` の `/O` 出力ログ）で `{app}\bin\64bit\obs-mapping.dll` と `{app}\data\ui\index.html` が含まれることを確かめる。どちらかがなければ `::error::` を出して `exit 1` する。中身確認の手段は、ランナーで使えるものを選ぶこと。

- [ ] **Step 2: ブランチを push して CI で落ちることを確認する**

Expected: Windows ジョブが「installer missing」で FAIL

- [ ] **Step 3: `installer-windows.iss.in` を書く**

  - `AppId`: 固定 GUID（新しく生成し、以後変えない）
  - `DefaultDirName={commonappdata}\obs-studio\plugins\@CMAKE_PROJECT_NAME@`、`DisableDirPage=yes`、`PrivilegesRequired=admin`、`ArchitecturesAllowed=x64compatible`、`ArchitecturesInstallIn64BitMode=x64compatible`
  - `[Files]`: `Source: "release\<config>\obs-mapping\*"; Flags: recursesubdirs ignoreversion`（zip と同じツリー）
  - `[InstallDelete]` と `[UninstallDelete]`: `Type: filesandordirs; Name: "{app}"`（古いファイルを残さない）
  - `OutputBaseFilename=@CMAKE_PROJECT_NAME@-@CMAKE_PROJECT_VERSION@-windows-x64-installer`
  - 日本語と英語の言語ファイル（`compiler:Languages\Japanese.isl` と `Default.isl`）

- [ ] **Step 4: `Package-Windows.ps1` から `iscc` を呼ぶ**

`iscc` はランナーの `C:\Program Files (x86)\Inno Setup 6\ISCC.exe` を使う。見つからない場合は `choco install innosetup -y` してから使う。

- [ ] **Step 5: push して CI が通ることを確認する**

Expected: Windows ジョブ PASS。artifact に `.zip` と `-installer.exe` の両方が入っている

- [ ] **Step 6: `release-please.yaml` に `.exe` を追加し、`actionlint` を通す**

Run: `actionlint .github/workflows/release-please.yaml .github/workflows/build-project.yaml`
Expected: 出力なし

- [ ] **Step 7: Windows 実機で手動確認し、`docs/manual-checks.md` に追記する**

  - 3-1: `.exe` を実行し、SmartScreen で「詳細情報 → 実行」→ UAC → 完了。`C:\ProgramData\obs-studio\plugins\obs-mapping\bin\64bit\obs-mapping.dll` がある
  - 3-2: 「アプリと機能」に 1 件だけ出て、アンインストールでフォルダーごと消える
  - 3-3: 古い版の上に新しい版を入れると、旧版にしかないファイル（ダミーファイルを置いて確かめる）が消えている

- [ ] **Step 8: difit でレビューを依頼する**

### Task 4: OBS 起動中の停止と、OBS 未検出・旧版の警告

**Files:**
- Modify: `cmake/windows/resources/installer-windows.iss.in`（`[Code]`）

**Interfaces:**
- Produces（`[Code]` 内）: `function IsObsRunning(): Boolean;`, `function InitializeSetup(): Boolean;`, `function InitializeUninstall(): Boolean;`

- [ ] **Step 1: `[Code]` を実装する**

  - `IsObsRunning`: WMI（`Win32_Process`）で `Name = 'obs64.exe'` を探す
  - `InitializeSetup`: 起動中なら「OBS を閉じてから、もう一度インストーラーを実行してください。」（英語: "Please close OBS Studio and run the installer again."）を出して `False` を返す。次に `HKLM\SOFTWARE\OBS Studio` の既定値（インストール先）から `bin\64bit\obs64.exe` のファイルバージョンを `GetVersionNumbersString` で読む。見つからない、または `31.1.1` 未満なら、「OBS Studio 31.1.1 以降が見つかりません。このまま続けますか？」の Yes/No を出す。Yes なら続行する
  - `InitializeUninstall`: 起動中ならインストールと同じ文言で `False` を返す
  - メッセージは `[CustomMessages]` に `japanese.` と `english.` で定義する

- [ ] **Step 2: CI でビルドが通ることを確認する**

Expected: Windows ジョブ PASS

- [ ] **Step 3: 実機で手動確認し、`docs/manual-checks.md` に追記する**

  - 4-1: OBS を起動したままインストールまたはアンインストールすると、メッセージが出て止まる
  - 4-2: OBS がない環境（またはレジストリキーを一時的に外した状態）で警告が出て、「はい」で続行できる

- [ ] **Step 4: difit でレビューを依頼する**

### Task 5: macOS pkg で古いバンドルを消してから入れる

**Files:**
- Create: `cmake/macos/resources/preinstall.in`（`#!/bin/sh` → `rm -rf "/Library/Application Support/obs-studio/plugins/@CMAKE_PROJECT_NAME@.plugin"` → `exit 0`）
- Modify: `cmake/macos/helpers.cmake`（`preinstall` を `configure_file` で `${CMAKE_CURRENT_BINARY_DIR}/pkg-scripts/preinstall` に生成し、実行権限を付ける）
- Modify: `cmake/macos/resources/create-package.cmake.in`（`pkgbuild` に `--scripts "@CMAKE_CURRENT_BINARY_DIR@/pkg-scripts"` を追加）
- Modify: `.github/workflows/build-project.yaml`（macOS ジョブ: `pkgutil --expand` した中に `Scripts/preinstall` があるか確認する）

- [ ] **Step 1: 失敗する確認ステップを `build-project.yaml` に足し、push して FAIL を確認する**

Expected: macOS ジョブが「preinstall missing」で FAIL

- [ ] **Step 2: preinstall を実装して、ローカルで pkg を作る**

Run: `cmake --preset macos && cmake --build --preset macos && cmake --install build_macos --config RelWithDebInfo --prefix release/RelWithDebInfo` の後、`.github/scripts/package-macos` 相当で pkg を作る。`pkgutil --expand release/*.pkg /tmp/x && ls /tmp/x/*/Scripts`
Expected: `preinstall` がある

- [ ] **Step 3: push して CI が通ることを確認する**

- [ ] **Step 4: 実機で手動確認し、`docs/manual-checks.md` に追記する**

  - 5-1: 旧版を入れた後、バンドル内にダミーファイルを置いてから新版の pkg を入れると、ダミーが消えている
  - 5-2: 署名なしの pkg を開くと止められ、README の手順（Task 6）で入れられる。入れた後の `obs-mapping.plugin` に `com.apple.quarantine` が付いているか（`xattr -l`）を記録する

- [ ] **Step 5: difit でレビューを依頼する**

### Task 6: README とサイトの案内を書き直す

**Files:**
- Modify: `README.md`（インストール節、「UI をカスタムブラウザドックに登録する」節）
- Modify（必要なら）: `site/src/i18n/ja.ts`, `site/src/i18n/en.ts`

- [ ] **Step 1: README を書き直す**

  - 「インストール」はインストーラーを主にする。Windows は `.exe` と SmartScreen の「詳細情報 → 実行」。macOS は `.pkg` と、Task 5-2 で確かめた Gatekeeper の越え方
  - Task 5-2 で quarantine が付かなかった場合は、pkg の利用者向けの `xattr` 手順を消す
  - 「OBS を開くと右側に OBS Mapping ドックが出る → WebSocket を有効にしてパスワードを入れる」の流れにする
  - 旧来の手動カスタムブラウザドックを使っていた人へ: ドックが 2 つ並ぶので古い方を消す。URL とパスワードはこのドックで一度入れ直す
  - macOS で `bash scripts/install-macos.sh` を使っていた人へ: `~/Library/Application Support/obs-studio/plugins/obs-mapping.plugin` を消す（重複読み込みになる）
  - 「カスタムブラウザドックに登録する」節は「ドックが出ない場合（obs-browser のない OBS など）」の代わりの手段にする
  - アンインストール後も残るドックの保存データの場所（Task 1 で実際に確かめたパス）を書く
  - zip と tar.xz は「手動で入れたい人向け」として残す

- [ ] **Step 2: サイトの文言を確認する**

`site/src/i18n/*.ts` にインストール手順の記述があれば README に合わせる。なければ変更しない。
Run: `pnpm -C site lint && pnpm -C site test`
Expected: PASS

- [ ] **Step 3: difit でレビューを依頼する。承認後、PR B を作る**
