---
paths:
  - "ui/src/components/**"
  - "site/src/components/**"
---

# Component directories and co-located styles

- 1 コンポーネント = 1 つの kebab-case ディレクトリ。本体は `index.tsx`（React）または `index.astro`（Astro）。
- Panda の `css()` / `cva()` の定義は本体に書かず、同じディレクトリの `styles.css.ts` に置いて export する。
- そのコンポーネントだけが使うクライアントスクリプトとテストも同じディレクトリに置く（例: `client.ts`, `client.browser.test.ts`, `index.test.tsx`）。
- 複数のコンポーネントで共有するスタイルは `components/styles.css.ts` に置く。
