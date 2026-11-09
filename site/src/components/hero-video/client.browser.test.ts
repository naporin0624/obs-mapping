/// <reference types="@vitest/browser/matchers" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initHeroVideo, type HeroVideoDeps } from './client';

// Mirrors the markup of index.astro; the video has no source so nothing really plays.
const buildDom = (): HTMLElement => {
  const root = document.createElement('div');
  root.dataset['heroVideo'] = '';
  root.innerHTML = `
    <video muted loop playsinline preload="metadata" aria-label="demo" data-hero-video-media></video>
    <button type="button" hidden data-hero-video-toggle data-pause="pause" data-play="play">
      <svg aria-hidden="true" data-icon="pause"></svg>
      <svg aria-hidden="true" data-icon="play"></svg>
      <span data-hero-video-label></span>
    </button>
  `;
  document.body.append(root);
  return root;
};

type Playback = { setPaused: (paused: boolean) => void };

// Stands in for the media pipeline: play/pause flip `paused` and fire the event, as a browser would.
const fakePlayback = (video: HTMLVideoElement): Playback => {
  let paused = true;
  Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
  const setPaused = (next: boolean): void => {
    paused = next;
    video.dispatchEvent(new Event(next ? 'pause' : 'play'));
  };
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => {
    setPaused(false);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => setPaused(true));
  return { setPaused };
};

const motion = (matches: boolean): HeroVideoDeps['motion'] => ({ matches });

let root: HTMLElement;
let cleanups: (() => void)[] = [];

const video = (): HTMLVideoElement => {
  const found = root.querySelector('[data-hero-video-media]');
  if (!(found instanceof HTMLVideoElement)) throw new Error('no video');
  return found;
};
const toggle = (): HTMLButtonElement => {
  const found = root.querySelector('[data-hero-video-toggle]');
  if (!(found instanceof HTMLButtonElement)) throw new Error('no toggle');
  return found;
};
const icon = (name: string): Element | null => toggle().querySelector(`[data-icon="${name}"]`);

const start = (reduced: boolean): void => {
  cleanups = [...cleanups, initHeroVideo(root, { motion: motion(reduced) })];
};

beforeEach(() => {
  root = buildDom();
});

afterEach(() => {
  cleanups.forEach((stop) => stop());
  cleanups = [];
  root.remove();
  vi.restoreAllMocks();
});

describe('initHeroVideo', () => {
  it('does nothing until it is called', () => {
    fakePlayback(video());
    expect(toggle().hidden).toBe(true);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('reveals the toggle once wired', () => {
    fakePlayback(video());
    start(false);
    expect(toggle().hidden).toBe(false);
  });

  it('plays the video when reduced motion is not requested, and offers to pause', () => {
    fakePlayback(video());
    start(false);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    expect(toggle()).toHaveAccessibleName('pause');
    expect(icon('pause')?.hasAttribute('hidden')).toBe(false);
    expect(icon('play')?.hasAttribute('hidden')).toBe(true);
  });

  it('leaves the video paused on the poster under reduced motion, and offers to play', () => {
    fakePlayback(video());
    start(true);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(video().paused).toBe(true);
    expect(toggle()).toHaveAccessibleName('play');
    expect(icon('play')?.hasAttribute('hidden')).toBe(false);
    expect(icon('pause')?.hasAttribute('hidden')).toBe(true);
  });

  it('offers to play when the browser blocks autoplay', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    start(false);
    await vi.waitFor(() => expect(toggle()).toHaveAccessibleName('play'));
  });

  it('toggles between pause and play on click', () => {
    fakePlayback(video());
    start(false);
    toggle().click();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
    expect(video().paused).toBe(true);
    expect(toggle()).toHaveAccessibleName('play');
    toggle().click();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(toggle()).toHaveAccessibleName('pause');
  });

  it('follows the play and pause events rather than the click', () => {
    const playback = fakePlayback(video());
    start(true);
    playback.setPaused(false);
    expect(toggle()).toHaveAccessibleName('pause');
    playback.setPaused(true);
    expect(toggle()).toHaveAccessibleName('play');
  });

  it('keeps the label when a click does not change the playback', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => new Promise<void>(() => undefined));
    start(true);
    toggle().click();
    expect(toggle()).toHaveAccessibleName('play');
  });

  it('stops listening and hides the toggle again on cleanup', () => {
    const playback = fakePlayback(video());
    const stop = initHeroVideo(root, { motion: motion(true) });
    stop();
    playback.setPaused(false);
    expect(toggle().hidden).toBe(true);
    // A hidden button has no accessible name, so the label text is read directly.
    expect(root.querySelector('[data-hero-video-label]')?.textContent).toBe('play');
  });
});
