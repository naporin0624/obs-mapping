/// <reference types="@vitest/browser/matchers" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { startToc } from './client';

// Mirrors index.astro's nav, followed by tall sections so each one can cross the activation line.
const buildDom = (): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = `
    <nav aria-label="目次" data-toc>
      <details data-toc-details>
        <summary>目次<span data-toc-current>できること</span></summary>
        <ol>
          <li><a href="#t-can" data-toc-level="section">できること</a></li>
          <li>
            <a href="#t-install" data-toc-level="section">導入</a>
            <ol>
              <li><a href="#t-install-a" data-toc-level="step">ダウンロードする</a></li>
              <li><a href="#t-install-b" data-toc-level="step">インストーラーを実行する</a></li>
            </ol>
          </li>
          <li><a href="#t-env" data-toc-level="section">対応環境</a></li>
        </ol>
      </details>
    </nav>
    <section id="t-can" style="height: 1500px">can</section>
    <section id="t-install">
      <h2 style="height: 300px">install</h2>
      <ol>
        <li id="t-install-a" style="height: 1500px">a</li>
        <li id="t-install-b" style="height: 1500px">b</li>
      </ol>
    </section>
    <section id="t-env" style="height: 1500px">env</section>
  `;
  document.body.append(root);
  return root;
};

let root: HTMLElement;
let cleanups: (() => void)[] = [];

const nav = (): HTMLElement => {
  const found = root.querySelector('[data-toc]');
  if (!(found instanceof HTMLElement)) throw new Error('no nav');
  return found;
};
const details = (): HTMLDetailsElement => {
  const found = root.querySelector('details');
  if (!(found instanceof HTMLDetailsElement)) throw new Error('no details');
  return found;
};
const link = (id: string): HTMLAnchorElement => {
  const found = root.querySelector(`a[href="#${id}"]`);
  if (!(found instanceof HTMLAnchorElement)) throw new Error(`no link to ${id}`);
  return found;
};
const currentHrefs = (): (string | null)[] => [...root.querySelectorAll('a[aria-current]')].map((a) => a.getAttribute('href'));
const summaryText = (): string => root.querySelector('[data-toc-current]')?.textContent ?? '';

// Puts the element's top just above the activation line, a third of the way down the viewport.
const scrollToTarget = (id: string): void => {
  const target = document.getElementById(id);
  if (target === null) throw new Error(`no target ${id}`);
  window.scrollTo(0, window.scrollY + target.getBoundingClientRect().top - window.innerHeight * 0.2);
};

const start = (): void => {
  cleanups = [...cleanups, startToc(nav())];
};

beforeEach(() => {
  window.scrollTo(0, 0);
  root = buildDom();
});

afterEach(() => {
  cleanups.forEach((stop) => stop());
  cleanups = [];
  root.remove();
  window.scrollTo(0, 0);
});

describe('startToc', () => {
  it('marks the section that crosses the activation line as the current location', async () => {
    start();
    scrollToTarget('t-can');
    await vi.waitFor(() => expect(currentHrefs()).toEqual(['#t-can']));
    expect(link('t-can')).toHaveAttribute('aria-current', 'location');
  });

  it('marks only the deepest link: the step, not its section', async () => {
    start();
    scrollToTarget('t-install-b');
    await vi.waitFor(() => expect(currentHrefs()).toEqual(['#t-install-b']));
  });

  it('marks the section itself while its heading is read, before the first step', async () => {
    start();
    scrollToTarget('t-install');
    await vi.waitFor(() => expect(currentHrefs()).toEqual(['#t-install']));
  });

  it('moves the mark when scrolling on to another step and section', async () => {
    start();
    scrollToTarget('t-install-a');
    await vi.waitFor(() => expect(currentHrefs()).toEqual(['#t-install-a']));
    scrollToTarget('t-install-b');
    await vi.waitFor(() => expect(currentHrefs()).toEqual(['#t-install-b']));
    scrollToTarget('t-env');
    await vi.waitFor(() => expect(currentHrefs()).toEqual(['#t-env']));
  });

  it('shows the current section name in the narrow bar summary', async () => {
    start();
    scrollToTarget('t-install-b');
    await vi.waitFor(() => expect(summaryText()).toBe('導入'));
    scrollToTarget('t-env');
    await vi.waitFor(() => expect(summaryText()).toBe('対応環境'));
  });

  it('closes the opened list after a link is chosen', async () => {
    start();
    details().open = true;
    await userEvent.click(link('t-env'));
    expect(details().open).toBe(false);
  });

  it('stops tracking and closing after cleanup', async () => {
    const stop = startToc(nav());
    scrollToTarget('t-install-a');
    await vi.waitFor(() => expect(currentHrefs()).toEqual(['#t-install-a']));
    stop();
    scrollToTarget('t-env');
    // Two frames give a still-connected observer the chance to report.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(currentHrefs()).toEqual(['#t-install-a']);
    details().open = true;
    await userEvent.click(link('t-can'));
    expect(details().open).toBe(true);
  });
});
