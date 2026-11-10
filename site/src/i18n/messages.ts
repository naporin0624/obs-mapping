import type { DemoSlug, StepId } from '../scene/spec';
import { en } from './en';
import type { GuideRow } from './guide';
import { ja } from './ja';

export type Lang = 'ja' | 'en';
export type StepCopy = { title: string; body: string };
export type DemoCopy = { title: string; description: string };

export const SKILLS = ['driving-surface-mapper-over-websocket', 'writing-mapping-json', 'mapping-led-pixel-maps'] as const;
export type Skill = (typeof SKILLS)[number];
/** Copy that wraps one inline element (a link or a code span) between two runs of text. */
export type AroundCopy = { before: string; after: string };
/** `toc` is the step's short label in the contents nav. */
type StepBody = { title: string; toc: string; body: string };
/** A step shown as screenshots, one row per image. */
type GuideStep = { title: string; toc: string; rows: readonly GuideRow[] };
/** `href` starting with http is an external link; anything else is an in-page anchor. */
export type FaqLink = { href: string; label: string };
/** `a` is one paragraph per entry. */
export type FaqItem = { q: string; a: readonly string[]; links?: readonly FaqLink[]; id?: string };
export type FaqGroup = { heading: string; open: boolean; items: readonly FaqItem[] };

export type RootCopy = {
  title: string;
  description: string;
  getPlugin: string;
  demos: string;
  github: string;
  releases: string;
  /** Read after an external link's text; the visible ↗ is hidden from assistive tech. */
  external: string;
  /** `label` names the contents nav and starts its narrow bar. */
  toc: { label: string };
  can: { heading: string; items: readonly string[] };
  install: {
    heading: string;
    download: StepBody & { link: string };
    /** `macos` and `macosOld` are the two macOS warnings; each reads on from the OS name shown before it. */
    run: StepBody & { macos: string; macosOld: string; windows: string };
    /** `faq` is the label of the link from this step to the dock answer in the FAQ. */
    open: StepBody & GuideStep & { faq: string };
    connect: StepBody & GuideStep;
  };
  /** `fit.mask` follows its screenshots and points on to the masks; `fit.demos` labels the demo link. */
  how: { heading: string; source: GuideStep; fit: GuideStep & { mask: string; demos: string }; transfer: GuideStep };
  /** `enlarge` is read before a screenshot's alt on the button that opens it; `close` labels the dialog's button. */
  guide: { enlarge: string; close: string };
  faq: { heading: string; groups: readonly FaqGroup[] };
  skills: {
    heading: string;
    lead: string;
    list: Record<Skill, string>;
    claudeCode: string;
    others: AroundCopy & { link: string };
    oneByOne: string;
    global: AroundCopy;
  };
  env: { heading: string; macos: string; windows: string; obs: string };
  /** The hero demo video: `description` is its accessible name, `pause`/`play` label its toggle. */
  video: { description: string; pause: string; play: string };
};

export type SiteMessages = {
  htmlLang: string;
  langSwitch: { label: string; ja: string; en: string };
  root: RootCopy;
  demoIndex: { title: string; description: string };
  demos: Record<DemoSlug, DemoCopy>;
  step: (slug: DemoSlug, id: StepId) => StepCopy;
  viewer: {
    stage: string;
    hint: string;
    keys: string;
    input: { heading: string; sample: string; obs: string; device: string; unnamed: string };
    steps: { heading: string; locked: string };
    view: { heading: string; beam: string; reset: string };
    connect: { heading: string; importIt: string; startCamera: string; chooseHere: string };
  };
  /** `other` carries a {label} placeholder; `join` separates sentences shown together. */
  camera: {
    join: string;
    switchFailed: string;
    sample: string;
    requesting: string;
    waiting: string;
    obs: string;
    other: string;
    letterbox: string;
    denied: string;
    unavailable: string;
    busy: string;
    disconnected: string;
  };
  sample: { pause: string; play: string };
  webglFallback: string;
  download: { label: string; note: string };
};

const catalog: Record<Lang, SiteMessages> = { ja, en };

export const messagesFor = (lang: Lang): SiteMessages => catalog[lang];

export const localePath = (lang: Lang, path: string): string => (lang === 'ja' ? path : `/en${path}`);
