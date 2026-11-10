# Changelog

## [0.7.0](https://github.com/naporin0624/surface-mapper/compare/0.6.0...0.7.0) (2026-11-10)


### ⚠ BREAKING CHANGES

* ソース種別が surface_mapper_source に、vendor 名が surface-mapper に、 プラグインフォルダーが surface-mapper に変わる。既存のシーンの Mapping ソースは読み込めない。

### Code Refactoring

* 製品名を Surface Mapper に変え、obs-mapping の識別子を置き換える ([30fad8f](https://github.com/naporin0624/surface-mapper/commit/30fad8fdb8fec7704800fbee5f29028b3c48f818))

## [0.6.0](https://github.com/naporin0624/obs-mapping/compare/0.5.0...0.6.0) (2026-11-09)


### Features

* **site:** 導入をインストーラーの流れにし、よくある質問を足す ([8d953a2](https://github.com/naporin0624/obs-mapping/commit/8d953a2e3679916bdfd3b4dfddc05cbe7259a41f))

## [0.5.0](https://github.com/naporin0624/obs-mapping/compare/0.4.0...0.5.0) (2026-11-09)


### Features

* **dock:** OBS Mapping ドックを起動時に登録する ([e7cd99d](https://github.com/naporin0624/obs-mapping/commit/e7cd99d655faff374e834d26fa8504d367d56c37))
* **dock:** 初回起動時にドックを右側に表示する ([b642b1e](https://github.com/naporin0624/obs-mapping/commit/b642b1e5c791497722a0b814ed4bd890114c21d0))
* **installer:** macOS の pkg で古いバンドルを消してから入れる ([4462fe8](https://github.com/naporin0624/obs-mapping/commit/4462fe88e8a247a69e5b228b9c8513feb65bae05))
* **installer:** OBS 起動中は止め、OBS が無いか古いときは警告する ([4fdd72f](https://github.com/naporin0624/obs-mapping/commit/4fdd72f7f630dbfb2c5ead1d64d549b843878a7a))
* **installer:** Windows インストーラーを CI で作り、リリースに添付する ([8712485](https://github.com/naporin0624/obs-mapping/commit/8712485f25b9f2272c321ebdbbb22007688583f0))
* **site:** トップのヒーローをマッピングのデモ動画にする ([524ef8f](https://github.com/naporin0624/obs-mapping/commit/524ef8f663db596b374a27512294d325588db33b))
* **ui:** undo/redo のショートカットを dock 全体で効かせる ([02c14aa](https://github.com/naporin0624/obs-mapping/commit/02c14aaeff806ce51ebb8c9152b16684042239ca))
* **ui:** ツールバーを popover とアイコンで整理し、undo/redo を dock 全体で効かせる ([ffb9d50](https://github.com/naporin0624/obs-mapping/commit/ffb9d50701bae5325136a8fd9a2af96520819536))
* **ui:** 整列・等間隔を popover にまとめ、操作ボタンをアイコンにする ([d4b40b2](https://github.com/naporin0624/obs-mapping/commit/d4b40b29ba04609507d427239dd7c18283346f7b))
* Windows / macOS のインストーラー配布と OBS Mapping ドックの自動表示 ([bde8d47](https://github.com/naporin0624/obs-mapping/commit/bde8d47901405dbcb6cd751026bcd0531aef7260))


### Bug Fixes

* **dock:** 初回表示の呼び出しと終了時のコールバック解除を接続する ([6c054e5](https://github.com/naporin0624/obs-mapping/commit/6c054e54735008b236006f621d646740368c62e0))
* **dock:** 設定フォルダーを UTF-8 のまま作り、ブラウザが付いたときだけ初回表示する ([1df2981](https://github.com/naporin0624/obs-mapping/commit/1df2981d69f8dad0e9db1941bb2498b863db0ba1))
* **installer:** macOS の pkg はホームに入るので、preinstall と案内の場所を直す ([e686d11](https://github.com/naporin0624/obs-mapping/commit/e686d1173a971145b87d28b0144174085ac7f922))
* **installer:** 上書きインストールでアンインストーラーを消さず、CI で上書きを確かめる ([2d0b890](https://github.com/naporin0624/obs-mapping/commit/2d0b890e9e7a906b86a60afabee65b03ed336aac))
* **ui:** OBS の入力やシーンコレクションが変わったら入力候補を読み込み直す ([33850ec](https://github.com/naporin0624/obs-mapping/commit/33850ec12bbea7bced5a025cc65b10bf39f8b44e))
* **ui:** OBS の入力やシーンコレクションが変わったら入力候補を読み込み直す ([40fc97e](https://github.com/naporin0624/obs-mapping/commit/40fc97ef70289e2980d4e2765f8458c686e96bf3))
* **ui:** モーダル表示中は undo しない、グリッドのアイコンでも tooltip を出す ([ee11218](https://github.com/naporin0624/obs-mapping/commit/ee11218edf7e5e2d3404d4bc3881ec8f17da45d0))

## [0.4.0](https://github.com/naporin0624/obs-mapping/compare/0.3.0...0.4.0) (2026-11-04)


### Features

* obs-mapping を扱う Claude Code プラグインと marketplace を追加 ([36518da](https://github.com/naporin0624/obs-mapping/commit/36518da54ea15e4dd12791727b5e60a1c2227aec))
* obs-mapping を扱う Claude Code プラグインと marketplace を追加 ([402c5fd](https://github.com/naporin0624/obs-mapping/commit/402c5fdc806d12fe35af08457da8db6d74e13237))
* **plugin:** 面の Mask（円・多角形）で OBS 出力を切り抜く ([be9453b](https://github.com/naporin0624/obs-mapping/commit/be9453b6be8908a0f4d131981fe348df116ed751))
* **site:** Panda CSS に移し、サムネを投影した部屋の画像にする ([ac6f076](https://github.com/naporin0624/obs-mapping/commit/ac6f076aee8a8b76dfb39683815dc45e427d9093))
* **site:** 変な面へのマッピングを 3D の部屋で見せるデモサイト ([0ac24c9](https://github.com/naporin0624/obs-mapping/commit/0ac24c91cb7f2c7549adece03ef6e2ad188e5914))
* **site:** 変な面へのマッピングを 3D の部屋で見せるデモサイトを追加 ([da8237c](https://github.com/naporin0624/obs-mapping/commit/da8237c75e3c0c07efca842ceaa08361eef71bec))
* **ui:** ドックで面の形（Mask）を編集する ([ebc9274](https://github.com/naporin0624/obs-mapping/commit/ebc92747fa1a7153d3ad703e362e64da873c53d6))
* **ui:** 複数のレイヤーの source をまとめて変える ([8fe23d4](https://github.com/naporin0624/obs-mapping/commit/8fe23d4530b770e1b6d901675bc76f4757380df4))
* **ui:** 複数のレイヤーの source をまとめて変える ([cf59c8a](https://github.com/naporin0624/obs-mapping/commit/cf59c8a2fdb0371ccdefff3492286bb31002abf2))
* 面に円・多角形の Mask を付けて切り抜く ([374ee3c](https://github.com/naporin0624/obs-mapping/commit/374ee3cd0bcc2e9ab1959cae0b6484baa9336740))


### Bug Fixes

* **site:** デプロイのスクリプト名を deploy:prod にする ([02273f1](https://github.com/naporin0624/obs-mapping/commit/02273f1a4342dab3c8af6f9e90f43ade165a14fa))
* **ui:** ボタンの hover をずらす動きから色の変化に変える ([5530f25](https://github.com/naporin0624/obs-mapping/commit/5530f25e852e92259e0a914fd052adfe25156f06))
* **ui:** ボタンの hover をずらす動きから色の変化に変える ([dd06901](https://github.com/naporin0624/obs-mapping/commit/dd069010be0c0b293b4a7577d57c74eae6106e3f))
* **ui:** 一括変更の見出しを「n レイヤーを変更」にする ([f2124ee](https://github.com/naporin0624/obs-mapping/commit/f2124eebba93a8ec95733fd8303bbcdf7e3ed347))

## [0.3.0](https://github.com/naporin0624/obs-mapping/compare/0.2.0...0.3.0) (2026-11-02)


### Features

* **ui:** Stage のキャンバス外に作業余白を表示する ([2f1cb47](https://github.com/naporin0624/obs-mapping/commit/2f1cb478b3eced3562a94a66f75bc153914bcdcb))
* **ui:** Stage の操作性改善（作業余白・敷き詰め） ([0f292e1](https://github.com/naporin0624/obs-mapping/commit/0f292e185d2a80ed7750f8b337fc70050fe0153e))
* **ui:** 選んだ面やグループをキャンバスに敷き詰める ([41f32f8](https://github.com/naporin0624/obs-mapping/commit/41f32f83a4ac81b965ecfea73bda02a5ff9aa7b2))

## [0.2.0](https://github.com/naporin0624/obs-mapping/compare/0.1.0...0.2.0) (2026-11-02)


### Features

* **ui:** turn the toolbar actions into icon buttons with tooltips ([1259cd2](https://github.com/naporin0624/obs-mapping/commit/1259cd2d25da5b8fbecd43a01e4f27ad8422480f))
* **ui:** ツールバーの操作をアイコンボタンにする ([d0c0611](https://github.com/naporin0624/obs-mapping/commit/d0c0611a3ddfc7b5050daad14fcf55a644741722))

## 0.1.0 (2026-11-02)


### Features

* **core:** homography for quad corner pin ([0d7da1c](https://github.com/naporin0624/obs-mapping/commit/0d7da1cb1c1ea405deb3ec9dc6c50a3015166f8c))
* **core:** mapping model and JSON v1 parse/serialize/validate ([d51d351](https://github.com/naporin0624/obs-mapping/commit/d51d351cb626b326a87211416316067d0763b287))
* **core:** read and write mapping JSON v2 with layer groups ([26d6271](https://github.com/naporin0624/obs-mapping/commit/26d6271fa60b21bd5b7b5b84bdb60535afddb198))
* edit overlay (grid, outlines, handles) ([03491d4](https://github.com/naporin0624/obs-mapping/commit/03491d44f0aee7e36f68ad9c998573ddf4541b6d))
* mapping JSON v2（グループとレイヤーの木）— グループ機能 PR 1/4 ([3559ae1](https://github.com/naporin0624/obs-mapping/commit/3559ae1246f3798a000e7faa68d8a74181a31f54))
* OBS projection mapping plugin with corner-pin warp and dock editor ([8cd170f](https://github.com/naporin0624/obs-mapping/commit/8cd170fd8dd0becee0aaa2e7d59ddaad52fed7d0))
* obs-websocket vendor API for mapping ([7745a16](https://github.com/naporin0624/obs-mapping/commit/7745a1681710b65721af17e05580530bd491192b))
* **plugin:** add ja-JP locale ([56662dd](https://github.com/naporin0624/obs-mapping/commit/56662dd56314ad6e3b2d927edb62034292997c27)), closes [#6](https://github.com/naporin0624/obs-mapping/issues/6)
* **plugin:** overlay flag is plugin-owned; keep last valid mapping; atomic rename ([4b39975](https://github.com/naporin0624/obs-mapping/commit/4b3997594bc5949ce714593523b9910426e1d484))
* render quad surfaces with per-pixel homography ([db09b8f](https://github.com/naporin0624/obs-mapping/commit/db09b8f3bb4bdcf205311df8ad9f65fec80e3303))
* **ui:** 1 枚だけ選んだときは Align をキャンバス基準にする ([1747518](https://github.com/naporin0624/obs-mapping/commit/1747518eca202c9ee4d4a4f7625db6936a484911))
* **ui:** add an editor-only underlay image behind the Stage ([d816b27](https://github.com/naporin0624/obs-mapping/commit/d816b2779df0a5ee7f2c82d70fb66a6f500be3e7))
* **ui:** add show/hide toggle to the websocket password field ([d510039](https://github.com/naporin0624/obs-mapping/commit/d5100392333cd145034c8e7f2a069bf7f1688690))
* **ui:** adopt the v2 mapping model in the dock ([202ac35](https://github.com/naporin0624/obs-mapping/commit/202ac357f521401ba21b4819863496c21f9cec1e))
* **ui:** align a single surface to the canvas ([55ffaae](https://github.com/naporin0624/obs-mapping/commit/55ffaaef82e4487e30daf1d12f3342abb0943634))
* **ui:** auto layout for groups, group/ungroup, deep delete and duplicate ([78d3e10](https://github.com/naporin0624/obs-mapping/commit/78d3e10bebb74f210dce04ceedd386007a5ca892))
* **ui:** connect headless apps to React through Jotai hybrid atoms ([25cdce5](https://github.com/naporin0624/obs-mapping/commit/25cdce5ca9d5abda9d80f5ba9222117445f50016))
* **ui:** connect headless apps to React via Jotai hybrid atoms (PR-B) ([7543b32](https://github.com/naporin0624/obs-mapping/commit/7543b3201e103749b2f4cd16056148e61edc32e9))
* **ui:** dev-only colophon page listing SourceSelect states ([98c34cf](https://github.com/naporin0624/obs-mapping/commit/98c34cfe48db6dd317f7a916d2e0d4aa0a890612))
* **ui:** editor reducer with undo and remote sync ([240bd8f](https://github.com/naporin0624/obs-mapping/commit/240bd8f0d9c3d7d7e762b6f588b13f64bf613c7f))
* **ui:** geometry — snapping, align, distribute, quad checks ([bbb5201](https://github.com/naporin0624/obs-mapping/commit/bbb52012a99bf9e1ef0935332d467fb2672cdb56))
* **ui:** i18n for the dock (Japanese / English) ([ea0a0b6](https://github.com/naporin0624/obs-mapping/commit/ea0a0b6ea7ecca85130412269c1b01af8e3887ee))
* **ui:** JSON import/export with resolution mismatch handling ([f2bc9e2](https://github.com/naporin0624/obs-mapping/commit/f2bc9e2d33f87da7a528feaf1c4f93a58e69a9e6))
* **ui:** Panda CSS setup and restyle connect panel ([c15e691](https://github.com/naporin0624/obs-mapping/commit/c15e691eedb90f3993eeb9bed4ee7e5738b5b8ca))
* **ui:** react-aria-components SourceSelect with name and detail columns ([f2c215b](https://github.com/naporin0624/obs-mapping/commit/f2c215b4420d6cdf7afea393fcd4dd2bd0f56f9a))
* **ui:** React-free headless apps for OBS session and mapping sync (PR-A) ([5372059](https://github.com/naporin0624/obs-mapping/commit/5372059cdeb95b16594ad033f37c31fbbaa4df02))
* **ui:** React-free headless obs-session and mapping-sync apps ([9b4a062](https://github.com/naporin0624/obs-mapping/commit/9b4a062a07a70455d4c77caa38751a795f149775)), closes [#3](https://github.com/naporin0624/obs-mapping/issues/3) [#5](https://github.com/naporin0624/obs-mapping/issues/5)
* **ui:** scaffold, obs-websocket connection, source picker ([7ef1e53](https://github.com/naporin0624/obs-mapping/commit/7ef1e5368bccf504815dfe88f9ec0f630884854e))
* **ui:** send queue with drag throttling and reconnect resend, listInputs ([c5a1e98](https://github.com/naporin0624/obs-mapping/commit/c5a1e98bea9d4bf1dbc272bbf716b7f2192d365c))
* **ui:** show surfaces as a layer tree with drag-and-drop ([26449f5](https://github.com/naporin0624/obs-mapping/commit/26449f53f83070d04b12e908d9222e654652e876))
* **ui:** snap to other surfaces' extended edge lines ([8c969f0](https://github.com/naporin0624/obs-mapping/commit/8c969f0f7a1868503f32751cd1a04ed6eb45a132))
* **ui:** Stage group selection, group drag and group inspector ([f129111](https://github.com/naporin0624/obs-mapping/commit/f129111607e8e3261fa711bc193999cdba770aa2))
* **ui:** Stage に下地画像を敷けるようにする ([64b05ee](https://github.com/naporin0624/obs-mapping/commit/64b05ee99e350e7710fd1d4423ef04045ce3413b))
* **ui:** stage, panels, keyboard, sync ([f908123](https://github.com/naporin0624/obs-mapping/commit/f90812343a04ab86795fc694949d6273762755ed))
* **ui:** パスワード欄に表示/隠す切替ボタンを追加 ([84330ce](https://github.com/naporin0624/obs-mapping/commit/84330cec41aeaf1eb5f9dba09e411bf31c3f582b))
* **ui:** 他の面の辺の延長線にも吸着する + ガイド線 ([543f036](https://github.com/naporin0624/obs-mapping/commit/543f036a8394afe77ee330750383ac3d9ec8786e))
* グループの Auto Layout、グループ化と解除 — グループ機能 PR 2/4 ([bdcd69e](https://github.com/naporin0624/obs-mapping/commit/bdcd69e97aeba2c8af85a842425f226601fe10d6))
* 面の一覧をレイヤーの木にする — グループ機能 PR 3/4 ([2876c9c](https://github.com/naporin0624/obs-mapping/commit/2876c9c2ea4ed6ef34df719f296b3fed1bd794bd))


### Bug Fixes

* **ci:** GCC dangling-reference and clang-format/gersemi formatting ([b777318](https://github.com/naporin0624/obs-mapping/commit/b777318b7b2f79f451ba9803a70fa633e9bc8fd4))
* **core:** serialize_mapping replaces invalid UTF-8 instead of throwing ([b632762](https://github.com/naporin0624/obs-mapping/commit/b632762e7acdc5c6a35b3126a810d4de96f860f6))
* draw non-convex quads when homography exists ([5328a50](https://github.com/naporin0624/obs-mapping/commit/5328a503feef3f77e35d2389792983cd58fe7878))
* MappingChanged のエコーをリクエスト ID で照合する ([#4](https://github.com/naporin0624/obs-mapping/issues/4)) ([0bb2a11](https://github.com/naporin0624/obs-mapping/commit/0bb2a116a93e387ed38fb9b49c66b8512632cf83))
* match MappingChanged echoes by request id ([#4](https://github.com/naporin0624/obs-mapping/issues/4)) ([eca98a9](https://github.com/naporin0624/obs-mapping/commit/eca98a9879c2ccd9853b142b523aa053b45d4f55))
* resync the dock after interleaved foreign edits ([#2](https://github.com/naporin0624/obs-mapping/issues/2)), add ja-JP locale ([#6](https://github.com/naporin0624/obs-mapping/issues/6)) ([43af97c](https://github.com/naporin0624/obs-mapping/commit/43af97c370ebe1c35f06fdae3b4f51feee41e949))
* **ui:** build UI before cmake in install script ([a31d099](https://github.com/naporin0624/obs-mapping/commit/a31d0999c1ae2f4f72dbf01e2bb537c4ae2b4c75))
* **ui:** follow the plugin's overlay flag; own echoes never replace local edits; flush/discard queue ([21bb84a](https://github.com/naporin0624/obs-mapping/commit/21bb84a5c585522c6ca17fa9e5c1c69f87847b5f))
* **ui:** keep edits unsent after a transport failure while still online ([777d25e](https://github.com/naporin0624/obs-mapping/commit/777d25ea8e42a9e599723d81072f0788f915c1df))
* **ui:** recover stuck sends on reconnect, surface load errors, sync hook tests ([6677f94](https://github.com/naporin0624/obs-mapping/commit/6677f9459f2580f16c70099fe8e151f6da6df68b))
* **ui:** resync once after a foreign edit lands between own sends ([04daa69](https://github.com/naporin0624/obs-mapping/commit/04daa693b7ccdbad98d0017e1cb9cd16ae39fb3e)), closes [#2](https://github.com/naporin0624/obs-mapping/issues/2)
* **ui:** track in-flight sends for remote echo detection ([4916edb](https://github.com/naporin0624/obs-mapping/commit/4916edb51bd153a39279cac3495c6704a9ddf025))
