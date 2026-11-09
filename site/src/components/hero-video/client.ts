type MotionQuery = { readonly matches: boolean };

export type HeroVideoDeps = {
  /** The prefers-reduced-motion query; when it matches the video stays on its poster. */
  motion: MotionQuery;
};

type Parts = {
  video: HTMLVideoElement;
  toggle: HTMLButtonElement;
  label: HTMLElement;
  pauseIcon: Element;
  playIcon: Element;
};

type Cleanup = () => void;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const defaultDeps = (): HeroVideoDeps => ({ motion: window.matchMedia(REDUCED_MOTION) });

const pick = <T extends Element>(root: HTMLElement, selector: string, type: abstract new () => T): T => {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`hero video: missing ${selector}`);
  return el;
};

const queryParts = (root: HTMLElement): Parts => ({
  video: pick(root, '[data-hero-video-media]', HTMLVideoElement),
  toggle: pick(root, '[data-hero-video-toggle]', HTMLButtonElement),
  label: pick(root, '[data-hero-video-label]', HTMLElement),
  pauseIcon: pick(root, '[data-icon="pause"]', Element),
  playIcon: pick(root, '[data-icon="play"]', Element),
});

const listen = (target: EventTarget, type: string, handler: () => void): Cleanup => {
  target.addEventListener(type, handler);
  return () => target.removeEventListener(type, handler);
};

const showState = (parts: Parts, paused: boolean): void => {
  parts.label.replaceChildren((paused ? parts.toggle.dataset['play'] : parts.toggle.dataset['pause']) ?? '');
  parts.pauseIcon.toggleAttribute('hidden', paused);
  parts.playIcon.toggleAttribute('hidden', !paused);
};

// A refused play() (autoplay blocked) fires no event, so the rejection re-reads the state too.
const play = async (video: HTMLVideoElement, sync: () => void): Promise<void> => {
  try {
    await video.play();
  } catch {
    sync();
  }
};

const toggle = (video: HTMLVideoElement, sync: () => void): void => {
  if (video.paused) void play(video, sync);
  else video.pause();
};

/** Wires the top page's demo video and its pause button; the returned function unwires them. */
export const initHeroVideo = (root: HTMLElement, deps: HeroVideoDeps = defaultDeps()): Cleanup => {
  const parts = queryParts(root);
  const sync = (): void => showState(parts, parts.video.paused);
  const cleanups = [listen(parts.video, 'play', sync), listen(parts.video, 'pause', sync), listen(parts.toggle, 'click', () => toggle(parts.video, sync))];
  sync();
  parts.toggle.toggleAttribute('hidden', false);
  if (!deps.motion.matches) void play(parts.video, sync);
  return () => {
    for (const cleanup of cleanups) cleanup();
    parts.toggle.toggleAttribute('hidden', true);
  };
};

/** Starts the hero video found in the page; called once by the top page's own script. */
export const mountHeroVideo = (doc: Document): Cleanup => {
  const root = doc.querySelector<HTMLElement>('[data-hero-video]');
  return root === null ? () => undefined : initHeroVideo(root);
};
