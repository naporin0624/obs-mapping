import type { DemoSlug, StepId } from '../scene/spec';
import { en } from './en';
import { ja } from './ja';

export type Lang = 'ja' | 'en';
export type StepCopy = { title: string; body: string };
export type DemoCopy = { title: string; description: string };

export const SKILLS = ['driving-obs-mapping-over-websocket', 'writing-mapping-json', 'mapping-led-pixel-maps'] as const;
export type Skill = (typeof SKILLS)[number];
/** Copy that wraps one inline element (a link or a code span) between two runs of text. */
export type AroundCopy = { before: string; after: string };
type StepBody = { title: string; body: string };
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
  can: { heading: string; items: readonly string[] };
  install: {
    heading: string;
    download: StepBody & { link: string };
    /** `macos` and `macosOld` are the two macOS warnings; each reads on from the OS name shown before it. */
    run: StepBody & { macos: string; macosOld: string; windows: string };
    /** `faq` is the label of the link from this step to the dock answer in the FAQ. */
    open: StepBody & { faq: string };
    connect: StepBody;
  };
  how: { heading: string; map: StepBody & { demos: string } };
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
