## project setup rules

- pnpm で setup すること
- pnpm fmt で pnpm oxlint, pnpm oxfmt --write を実行すること
- pnpm lint で pnpm oxlint, pnpm oxfmt --check を実行すること
- `@typescript/native-preview` を利用すること
- 実装をする前にライブラリについて知らないことがある時は context7, web で調査してから進めること。
- vitest を利用した TDD で実装すること
    - vitest は browser mode が良い気がする
- husky で commit 時に lint, typecheck を実行すること
- 勝手に commit しないこと
- 実装は小さいタスクに分けて実装すること。実装が終わったら difit を起動して私に review 依頼すること
- review で繰り返し受けた内容は rules, skills にすることで永続化して
    - review の内容はまず memory に記憶して繰り返し指摘されるものは skills にすること
- user がやりたいことを @docs/task.md にかいていくので Cannelloni システムの実装が終わったらここを確認して進めること

## comment rules
- `git blame` で 過去の commit の意図を理解すること
  - 変更の意図は blame で確認すること、コード中には書かない
- 関数の命名でわからないこと、context が複雑である場合のみコメントを書くこと
- 関数や、method は距離が近いことで意味論を共有できる。コメントを書きすぎることで距離が遠くなり、意味論を共有できなくなることに注意すること
- コメントは3行以内に収めること。
  ー コメントを3行い上書きたい場合は以下を考える
    - 関数を分割すること
    - 関数の命名を変えること
    - 関数のライフタイムを小さくすること

## coding rules

- あなたは実装計画、ステークホルダーである私に対して要件のブレがなくなるまで AskUserQuestion で質問することに努め、実装は subagent に任せること
- 関数は単一責任で実装すること
- 同時に命令が複数来た時は Task で優先順位をつけて subagent に実装を任せること


## ui rules

- WCAG2.1 AA 基準を満たすように color token を設計すること
- UI は文脈に沿った内容にすること
    - 機械的なUIの利用は徹底的に避けること
    - 伝えたい情報はどんなものでその情報に適切な UI を常に考察、模索すること
    - ASCII ダイアグラムで提案すること
    - AskUserQuestion であなたが考えたパターンを私に提示してどれがいいか提案すること
- UI を作る時は以下の順番で実現を目指すこと。1が難しいなら2を2が難しいなら3をやる, 3 が難しいなら 4 をやる
  1. HTML + CSS で実装
  2. `react-aria-components` で実装
  3. 独自実装を行う前に UI の変更の提案をする
  4. 独自実装で UI を実装する
- リンクを使いたい時は `react-aria-components` の Link を利用すること
- `src/components` に UI を追加したら colophon にも追加すること
    - colophon で link/href を設定するときは `e.preventDefault` して noaction にしてほしい

## ref repository
@docs/refs.md

### Cloudflare Durable Object を利用する際に使用できるライブラリ

- https://github.com/napolab/durabcast


## comment rules
- `<--- ここから --->` `<--- ここまで --->` と書かれている場合はその範囲は commit しないこと

## resources rules
- mockup 用の画像が必要な時は Codex CLI の組み込み画像生成スキル `$imagegen` を使うこと
- 使い方:
    - headless（推奨）: `codex exec "<生成したい画像の説明> $imagegen"`
    - 対話: `codex "<説明> $imagegen"`
    - 参照画像を渡す: `codex -i ref.png "<説明> $imagegen"` / `codex --image a.png,b.jpg "<説明>"`
- モデルは `gpt-image-2`。生成画像は `~/.codex/generated_images/`（`$CODEX_HOME/generated_images/`）に保存される
- 出力先パス・サイズ・品質・透過・枚数は プロンプト内に自然言語で指定する（`--out`/`--size` 等のフラグは不要）
- 用途: アイコン・バナー・イラスト・スプライト・プレースホルダ等のモックアップ素材
