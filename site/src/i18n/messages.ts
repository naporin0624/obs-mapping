import type { DemoSlug, StepId } from '../scene/spec';
import { en } from './en';
import { ja } from './ja';

export type Lang = 'ja' | 'en';
export type StepCopy = { title: string; body: string };
export type DemoCopy = { title: string; description: string };

export type SiteMessages = {
  htmlLang: string;
  langSwitch: { label: string; ja: string; en: string };
  root: { title: string; description: string; demos: string; github: string };
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
