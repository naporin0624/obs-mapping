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
  how: {
    heading: string;
    install: StepBody & { gatekeeper: string; readme: string };
    connect: StepBody & { readme: string };
    map: StepBody & { demos: string };
  };
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
