import { ja as dock } from '../../../ui/src/i18n/messages/ja';
import { DEMO_SOURCE } from '../scene/spec';
import type { SiteMessages, StepCopy } from './messages';

const GITHUB_URL = 'https://github.com/naporin0624/surface-mapper';
const target = { stairs: '階段', hexagon: '六角形のパネル', drums: '太鼓', cubes: '積み重ねた立方体' } as const;

const holeStep: StepCopy = {
  title: '穴を切り抜く',
  body: `穴をあける面で「${dock.maskHeading}」の「${dock.maskPolygon}」を選び、「${dock.maskEdit}」で頂点を足して、面の外周を一周したあと続けて穴の輪郭をなぞります。外周と穴の輪郭の両方に囲まれた部分は抜けるので、穴には光が当たりません。ページでは消える様子をなめらかに見せていますが、プラグインでは編集した形のとおりに切り抜かれます。`,
};

export const ja: SiteMessages = {
  htmlLang: 'ja',
  langSwitch: { label: '言語', ja: '日本語', en: 'English' },
  root: {
    title: 'Surface Mapper',
    description: 'OBS の映像を、立体物に合わせて投影マッピングするプラグインです。',
    getPlugin: 'プラグインを入手',
    demos: 'デモを見る',
    github: 'GitHub のリポジトリ',
    releases: 'Releases（ダウンロード）',
    external: '（GitHub）',
    toc: { label: '目次' },
    can: {
      heading: 'できること',
      items: [
        '面ごとに OBS のソースを選び、四隅を動かして映像を四角形へワープさせる',
        '円や多角形で面を切り抜き、穴もあけられる',
        '面をグループにまとめ、整列・等間隔・敷き詰めで並べる',
        `マッピングを mapping.json として${dock.exportButton}・${dock.importButton}できる。obs-websocket のベンダーリクエストで、スクリプトからも読み書きできる`,
      ],
    },
    install: {
      heading: '導入',
      download: {
        title: 'ダウンロードする',
        toc: 'ダウンロードする',
        body: 'Releases から、自分の OS 用のファイルを選びます。macOS は .pkg、Windows は .exe です。',
        link: 'Releases を開く',
      },
      run: {
        title: 'OBS を終了して、インストーラーを実行する',
        toc: 'インストーラーを実行する',
        body: 'インストールの前に、OBS を終了しておきます。Windows のインストーラーは、OBS が起動していると先へ進めません。',
        macos: '15 以降で警告に止められたら、「システム設定 > プライバシーとセキュリティ」を開き、「このまま開く」を押します。',
        macosOld: '14 以前で警告に止められたら、pkg を右クリックして「開く」を選びます。',
        windows: 'SmartScreen の警告が出たら、「詳細情報」を押して「実行」を選びます。管理者権限の確認（UAC）が出たら、許可します。',
      },
      open: {
        title: 'OBS を開く',
        toc: 'OBS を開く',
        body: '右側に「Surface Mapper」ドックが出ています。ドックが自動で出るのは初回だけです。',
        rows: [
          {
            image: '01-1-dock-menu',
            alt: '「ドック」メニューの一覧で、「Surface Mapper」にチェックが入っている',
            where: 'ドック',
            title: 'ドックが見当たらないとき',
            items: ['メニューバーの「ドック」から「Surface Mapper」を選び、チェックを入れます。'],
          },
        ],
        faq: 'メニューにも Surface Mapper がないとき',
      },
      connect: {
        title: 'WebSocket を有効にして接続する',
        toc: 'WebSocket で接続する',
        body: 'OBS の WebSocket サーバーを有効にして、ドックからつなぎます。次回からは自動で再接続します。',
        rows: [
          {
            image: '01-2-tools-websocket',
            alt: '「ツール」メニューの一覧にある「WebSocket サーバー設定」',
            where: 'ツール',
            title: '設定を開く',
            items: ['メニューバーの「ツール」から「WebSocket サーバー設定」を開きます。'],
          },
          {
            image: '01-3-websocket-settings',
            alt: '「WebSocket サーバー設定」の画面。サーバーを有効にするチェック、サーバーポートの 4455、サーバーパスワードの欄',
            where: 'ツール > WebSocket サーバー設定',
            title: 'サーバーを有効にする',
            items: [
              '「WebSocketサーバーを有効にする」にチェックを入れます。',
              '「サーバーポート」を確かめます。初期値は 4455 です。',
              '「サーバーパスワード」を控えます。ドックで接続するときに使います。',
            ],
          },
          {
            image: '01-4-dock-connect',
            alt: 'ドック上部の接続欄。URL、パスワード、接続のボタン、「接続済み」の表示',
            where: 'Surface Mapper ドック',
            title: 'ドックから接続する',
            items: [
              '「URL」は既定の ws://127.0.0.1:4455 のままでかまいません。ポートを変えたときは、末尾の番号をそろえます。',
              '「パスワード」に、控えたサーバーパスワードを入れます。',
              `「${dock.connectConnect}」のボタンを押します。つながると、このボタンは「${dock.connectDisconnect}」に変わります。`,
              `「${dock.connectOpen}」と出れば完了です。`,
            ],
          },
        ],
      },
    },
    how: {
      heading: '使い方',
      source: {
        title: 'Mapping ソースを追加する',
        toc: 'ソースを追加する',
        rows: [
          {
            image: '02-1-add-source',
            alt: '「ソースを追加」の画面。左の一覧で「Mapping」を選び、右上に「新しい Mapping を追加」のボタンがある',
            where: 'ソース > ＋',
            title: 'Mapping を選んで追加する',
            items: ['「ソース」の「＋」を押し、一覧から「Mapping」を選びます。', '「＋ 新しい Mapping を追加」を押します。'],
          },
          {
            image: '02-2-source-properties',
            alt: 'Mapping ソースのプロパティ画面。上にプレビュー、中ほどにマッピング JSON の欄、右下に OK のボタン',
            where: 'Mapping ソースのプロパティ',
            title: 'プロパティはそのまま閉じる',
            items: ['「OK」を押します。マッピング JSON はドックで編集するので、ここでは触らなくてかまいません。'],
          },
          {
            image: '02-3-dock-select-source',
            alt: 'ドックの「ソース」欄で、追加した Mapping ソースを選んでいる。右に再読み込みのボタン',
            where: 'Surface Mapper ドック',
            title: 'ドックで選ぶ',
            items: [`「${dock.source}」で、追加した Mapping ソースを選びます。`, `一覧に出ないときは、「${dock.sourceReload}」のボタンを押します。`],
          },
        ],
      },
      fit: {
        title: '面を作って四隅を合わせる',
        toc: '四隅を合わせる',
        rows: [
          {
            image: '03-1-add-surface',
            alt: 'ドックの右側。ソースの選択、追加のボタン、レイヤーに並んだ 2 つの面、プロパティの切り抜きの欄',
            where: 'Surface Mapper ドック',
            title: '面を追加する',
            items: [
              `「${dock.add}」の左で、面に映すソース（例: サイフォンクライアント）を選びます。`,
              `「${dock.add}」（＋）を押して面を作ります。`,
              `作った面は「${dock.layersHeading}」に並びます。`,
              `「${dock.cropHeading}」で、ソースのどの部分を映すかを 0〜1 の比率で指定します。`,
            ],
          },
          {
            image: '03-2-fit-corners',
            alt: 'ステージで面の角をドラッグし、2 面の壁に合わせている。プロパティに角の座標の欄',
            where: 'Surface Mapper ドック',
            title: '四隅を合わせる',
            items: ['面の角にあるハンドルをドラッグして、投影する物体の角に合わせます。', `プロパティの「${dock.cornerHeading(2)}」のような欄では、選んだ角の座標を数値でも直せます。`],
          },
        ],
        mask: `面は「${dock.maskHeading}」で円や多角形に切り抜けます。`,
        demos: 'デモで手順を見る',
      },
      transfer: {
        title: 'マッピングを書き出す・読み込む',
        toc: '書き出す・読み込む',
        rows: [
          {
            image: '04-1-import-export',
            alt: 'ドックのツールバー。並んだインポートとエクスポートのボタン',
            where: 'Surface Mapper ドック',
            title: 'ファイルで受け渡す',
            items: [
              `「${dock.importButton}」で、保存した mapping.json を読み込みます。解像度が違うときは「${dock.importScale}」か「${dock.importOverwrite}」を選びます。読み込みは元に戻せません。`,
              `「${dock.exportButton}」で、いまのマッピングを mapping.json として保存します。`,
            ],
          },
        ],
      },
    },
    guide: { enlarge: '画像を拡大', close: '閉じる' },
    faq: {
      heading: 'よくある質問',
      groups: [
        {
          heading: '配布と差し替え',
          open: true,
          items: [
            {
              q: '参加者それぞれの環境で、同じマッピングを出すには？',
              a: [
                `プラグインと mapping.json を配ります。受け取った人は、ドックの「${dock.importButton}」で mapping.json を読み込みます。`,
                `解像度が違うときは、${dock.importButton}で「${dock.importScale}」を選ぶと、点を比率で伸縮して合わせます。読み込みは元に戻せません。`,
              ],
            },
            {
              q: '映像だけ差し替えたいときは？',
              a: ['面は OBS のソースを名前で指しています。ソースの中身（メディアファイルやシーン）を替えれば、そのソースを使う面がまとめて替わります。マッピングを作り直す必要はありません。'],
            },
            {
              q: '受け取った json のソース名が、自分の OBS にないときは？',
              a: ['その面には何も映りません。json にあるのと同じ名前でソースを作れば、インポートし直さなくてもそのまま映ります。ドックで面ごとにソースを選び直してもかまいません。'],
            },
          ],
        },
        {
          heading: 'インストールの困りごと',
          open: false,
          items: [
            {
              q: 'インストーラーで警告が出る',
              a: [
                'インストーラーに Apple と Microsoft の署名がないためです。越え方は、導入の ② にあります。',
                'macOS で、入れたあとに OBS がプラグインを読み込まないときは、隔離属性を外す方法が README にあります。',
              ],
              links: [
                { href: '#install-run', label: '導入の ② を見る' },
                { href: `${GITHUB_URL}#macosインストーラー`, label: 'README の「macOS（インストーラー）」を見る' },
              ],
            },
            {
              id: 'faq-dock',
              q: 'ドックが出てこない',
              a: ['obs-browser のない OBS では、ドックは自動で出ません。ドックが出ないときや中が空白のときは、カスタムブラウザドックに手で登録する方法が README の「ドックが出ない場合」にあります。'],
              links: [{ href: `${GITHUB_URL}#ドックが出ない場合カスタムブラウザドックに登録する`, label: 'README の「ドックが出ない場合」を見る' }],
            },
            { q: 'Windows でも動く？', a: ['動きます。0.5.0 から、Windows（x64）の実機でも動作を確認しています。'] },
          ],
        },
        {
          heading: '本番の運用',
          open: false,
          items: [
            {
              q: '編集用の輪郭が配信に映る？',
              a: ['映ります。輪郭とハンドルは Mapping ソースの出力に直接描かれるので、本番中はオーバーレイをオフにしてください。OBS を起動した時点で、オーバーレイは必ずオフに戻ります。'],
            },
            {
              q: 'プロジェクターにはどう出す？',
              a: [
                'OBS のプロジェクター出力（全画面プロジェクター）で、Mapping ソースか、それを含むシーンをプロジェクターの画面に出します。ドックのステージはブラウザ上で合成した表示なので、最終的な見え方はプロジェクター出力で確かめてください。',
              ],
            },
          ],
        },
        {
          heading: 'ほか',
          open: false,
          items: [
            {
              q: 'スクリプトや AI エージェントから操作できる？',
              a: [
                'obs-websocket のベンダーリクエスト（ListMappingSources、GetMapping、SetMapping）で、マッピングを読み書きできます。エージェント向けのスキルは、ページ下のセクションで案内しています。',
              ],
              links: [{ href: '#skills', label: 'ページ下のスキルを見る' }],
            },
            { q: '料金とライセンスは？', a: ['GPL-2.0 のオープンソースで、無料です。'] },
          ],
        },
      ],
    },
    skills: {
      heading: 'Claude Code / エージェント用スキル',
      lead: 'スクリプトやエージェントからマッピングを扱うためのスキルを 4 つ配布しています。',
      list: {
        'driving-surface-mapper-over-websocket': 'obs-websocket のベンダーリクエストで、Mapping ソースのマッピングを読み書きする。',
        'writing-mapping-json': 'mapping.json（v2）を書く・直す。検証エラーの読み方も含む。',
        'mapping-led-pixel-maps': 'LED のピクセルマップ（チャート）から、画面ごとの面を 1 つのキャンバスに配置する。',
        'upgrading-from-0-6': '0.6.x 以前で保存し、0.7.0 以降に更新して見つからなくなった Mapping ソースを、シーンコレクションを直して戻す。',
      },
      claudeCode: 'Claude Code では、プラグインとして入れます。',
      others: { before: 'Codex、GitHub Copilot、Cursor など他のエージェントでは、', link: 'skills CLI', after: ' で 1 つずつ入れます。' },
      oneByOne: '1 回のコマンドで複数を指定すると、最初の 1 つしか入りません。',
      global: { before: '', after: ' を付けると、プロジェクトではなくユーザー全体に入ります。' },
    },
    env: {
      heading: '対応環境',
      macos: 'macOS（Apple Silicon / Intel のユニバーサルビルド）: 動作を確認しています。',
      windows: 'Windows（x64）: 動作を確認しています。',
      obs: 'OBS Studio 31.1.1 以降',
    },
    video: {
      description: 'ドックで面の四隅をドラッグすると、部屋の角にある 2 面の壁に映像がぴったり合っていく様子',
      pause: '動画を一時停止',
      play: '動画を再生',
    },
  },
  demoIndex: {
    title: 'デモ',
    description: 'ブラウザの中で、OBS とドックの操作を順に追えます。できあがった mapping.json はそのまま Import できます。',
  },
  demos: {
    stairs: { title: '階段', description: '段ごとに映像を分けて、階段の面に合わせます。' },
    hexagon: { title: '六角形のパネル', description: '六角形に並べたパネルに合わせ、多角形で切り抜きます。' },
    drums: { title: '太鼓', description: '太鼓の皮に合わせ、円で切り抜きます。' },
    cubes: { title: '積み重ねた立方体', description: '立方体の 3 つの面に映像を回り込ませ、多角形で穴を抜きます。' },
  },
  step: (slug, id): StepCopy => {
    const name = target[slug];
    switch (id) {
      case 'place':
        return {
          title: 'ソースを追加する',
          body: `OBS にカメラのソースを「${DEMO_SOURCE}」という名前で追加し、続けて Mapping ソースを追加します。ドック上部の「${dock.source}」では、その Mapping ソースを選びます。`,
        };
      case 'fit':
        return {
          title: '四隅を合わせる',
          body: `「${dock.add}」の隣にある「${dock.source}」で ${DEMO_SOURCE} を選び、「${dock.add}」を押して面を作ります。作ったばかりの面は、映像の全体が四角いまま載っています。四隅を${name}の角にドラッグして合わせると、映像の角が物体の角へ移ります。「${dock.cropHeading}」で、面ごとに映像のどこを使うかを分けられます。`,
        };
      case 'shape': {
        if (slug === 'cubes') return holeStep;
        const kind = slug === 'drums' ? dock.maskEllipse : dock.maskPolygon;
        return {
          title: '形で切り抜く',
          body: `「${dock.maskHeading}」で「${kind}」を選び、「${dock.maskEdit}」で輪郭を物体に合わせます。面の外にはみ出していた映像が消えます。ページでは消える様子をなめらかに見せていますが、プラグインでは編集した形のとおりに切り抜かれます。`,
        };
      }
      case 'done':
        return {
          title: '完成',
          body: `${name}に映像が貼り付いた状態になりました。下の mapping.json をダウンロードして、ドックの「${dock.importButton}」で読み込めます。`,
        };
    }
  },
  viewer: {
    stage: '3D 表示',
    hint: 'ドラッグで回り込み・ホイールで寄る・右ドラッグで平行移動',
    keys: '矢印キーで平行移動、Shift と矢印キーで回り込みます。',
    input: { heading: '入力', sample: 'サンプル', obs: 'OBS 仮想カメラ', device: 'カメラ', unnamed: 'カメラ' },
    steps: { heading: '手順', locked: 'OBS 仮想カメラの映像は完成した出力なので、手順は切り替えられません。' },
    view: { heading: '表示', beam: '投影範囲を表示', reset: '視点をリセット' },
    connect: {
      heading: 'OBS でつなぐ',
      importIt: `Surface Mapper のドックで「${dock.importButton}」を押し、mapping.json を読み込む。`,
      startCamera: 'OBS の「仮想カメラ開始」を押す。',
      chooseHere: 'このページの「入力」で「OBS 仮想カメラ」を選ぶ。',
    },
  },
  camera: {
    join: '',
    switchFailed: 'このカメラは開けませんでした。いまのカメラのまま投影しています。',
    sample: 'サンプル映像を、OBS が出力するのと同じ形にマッピングして投影しています。',
    requesting: 'カメラの使用を許可してください。',
    waiting: 'カメラの映像を待っています。届くまではサンプル映像のままです。',
    obs: 'OBS 仮想カメラの映像をそのまま投影しています。',
    other: 'OBS 仮想カメラが見つからないため「{label}」を投影しています。OBS で「仮想カメラ開始」を押してから選び直してください。',
    letterbox: '映像が 16:9 ではないため、黒い帯を足して 16:9 に収めています。',
    denied: 'カメラの使用が許可されませんでした。サンプル映像に戻しました。',
    unavailable: 'カメラが見つかりませんでした。OBS で「仮想カメラ開始」を押してから選び直してください。サンプル映像に戻しました。',
    busy: 'カメラが他のアプリ（Windows の OBS など）で使われていて開けませんでした。サンプル映像に戻しました。',
    disconnected: 'カメラが外れたため、サンプル映像に戻しました。',
  },
  sample: { pause: 'サンプル映像を一時停止', play: 'サンプル映像を再生' },
  webglFallback: 'このブラウザでは 3D を表示できません。手順の説明と mapping.json のダウンロードは使えます。',
  download: {
    label: 'mapping.json をダウンロード',
    note: `OBS のカメラソースの名前を ${DEMO_SOURCE} にしてから${dock.importButton}してください。`,
  },
};
