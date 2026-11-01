# 手動確認項目

## Task 1

OBS の実機でしか確認できない項目。ビルドと `obs_module_load` のエクスポートは Task 1 の時点で確認済み。

前提: OBS を終了してから `bash scripts/install-macos.sh` を実行する（既存の `obs-mapping.plugin` は置き換えられる）。

- [ ] OBS を起動し、ソースの追加メニューに「Mapping」が出る。
- [ ] 追加すると 1920x1080 の透明なソースになる（プロパティの幅・高さが 1920 / 1080）。
- [ ] OBS のログ（ヘルプ > ログファイル）に `[obs-mapping] loaded` が出る。
