import { ja as dock } from '../../../ui/src/i18n/messages/ja';
import { DEMO_SOURCE } from '../scene/spec';
import type { SiteMessages, StepCopy } from './messages';

const target = { stairs: '階段', hexagon: '六角形のパネル', drums: '太鼓', cubes: '積み重ねた立方体' } as const;

const holeStep: StepCopy = {
  title: '穴を切り抜く',
  body: `穴をあける面で「${dock.maskHeading}」の「${dock.maskPolygon}」を選び、「${dock.maskEdit}」で頂点を足して、面の外周を一周したあと続けて穴の輪郭をなぞります。外周と穴の輪郭の両方に囲まれた部分は抜けるので、穴には光が当たりません。ページでは消える様子をなめらかに見せていますが、プラグインでは編集した形のとおりに切り抜かれます。`,
};

export const ja: SiteMessages = {
  htmlLang: 'ja',
  langSwitch: { label: '言語', ja: '日本語', en: 'English' },
  root: {
    title: 'obs-mapping',
    description: 'OBS の映像を、立体物に合わせて投影マッピングするプラグインです。',
    getPlugin: 'プラグインを入手',
    demos: 'デモを見る',
    github: 'GitHub のリポジトリ',
    releases: 'Releases（ダウンロード）',
    external: '（GitHub）',
    can: {
      heading: 'できること',
      items: [
        '面ごとに OBS のソースを選び、四隅を動かして映像を四角形へワープさせる',
        '円や多角形で面を切り抜き、穴もあけられる',
        '面をグループにまとめ、整列・等間隔・敷き詰めで並べる',
        `マッピングを mapping.json として${dock.exportButton}・${dock.importButton}できる。obs-websocket のベンダーリクエストで、スクリプトからも読み書きできる`,
      ],
    },
    how: {
      heading: '使い方',
      install: {
        title: 'Releases から入れる',
        body: 'OBS を終了してから、GitHub の Releases にあるインストーラーを実行します。macOS は .pkg、Windows は .exe です。手動で置きたい場合は .tar.xz（macOS）か .zip（Windows）も用意しています。',
        gatekeeper:
          'どちらのインストーラーも署名と公証がありません。macOS は Gatekeeper に止められるので、「システム設定 > プライバシーとセキュリティ」で「このまま開く」を押してください。Windows は SmartScreen で「詳細情報」から「実行」を選びます。',
        readme: '手動で入れる場所と、OBS が読み込まないときの対処は README にあります。',
      },
      connect: {
        title: 'obs-websocket を有効にし、ドックに接続する',
        body: `「ツール > WebSocket サーバー設定」でサーバーを有効にし、パスワードを設定します。OBS を開くと、右側に「OBS Mapping」ドックが出ます。ドックに URL とパスワードを入れて「${dock.connectConnect}」を押します。`,
        readme: 'ドックが出ない場合の登録手順は README にあります。',
      },
      map: {
        title: 'Mapping ソースを追加し、面を合わせる',
        body: `OBS で Mapping ソースを追加し、ドックの「${dock.source}」で選びます。「${dock.add}」で面を作って四隅を物体の角に合わせ、「${dock.maskHeading}」で円や多角形に切り抜きます。`,
        demos: 'デモで手順を見る',
      },
    },
    skills: {
      heading: 'Claude Code / エージェント用スキル',
      lead: 'スクリプトやエージェントからマッピングを扱うためのスキルを 3 つ配布しています。',
      list: {
        'driving-obs-mapping-over-websocket': 'obs-websocket のベンダーリクエストで、Mapping ソースのマッピングを読み書きする。',
        'writing-mapping-json': 'mapping.json（v2）を書く・直す。検証エラーの読み方も含む。',
        'mapping-led-pixel-maps': 'LED のピクセルマップ（チャート）から、画面ごとの面を 1 つのキャンバスに配置する。',
      },
      claudeCode: 'Claude Code では、プラグインとして入れます。',
      others: { before: 'Codex、GitHub Copilot、Cursor など他のエージェントでは、', link: 'skills CLI', after: ' で 1 つずつ入れます。' },
      oneByOne: '1 回のコマンドで複数を指定すると、最初の 1 つしか入りません。',
      global: { before: '', after: ' を付けると、プロジェクトではなくユーザー全体に入ります。' },
    },
    env: {
      heading: '対応環境',
      macos: 'macOS（Apple Silicon / Intel のユニバーサルビルド）: 動作を確認しています。',
      windows: 'Windows（x64）: リリースに含めていますが、実機での確認はまだです。',
      obs: 'OBS Studio 28 以降（obs-websocket が標準で入っている版）',
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
      importIt: `obs-mapping のドックで「${dock.importButton}」を押し、mapping.json を読み込む。`,
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
