type Level = 'section' | 'step';

type TocEntry = {
  link: HTMLAnchorElement;
  target: Element;
  level: Level;
  /** The section link this entry belongs to; a section link points at itself. */
  section: HTMLAnchorElement;
};

type Parts = {
  details: HTMLDetailsElement;
  current: HTMLElement;
  entries: readonly TocEntry[];
};

type Cleanup = () => void;

/** How far down the viewport the activation line sits; what crosses it is what is being read. */
const LINE = 0.3;
const BAND = `-${LINE * 100}% 0px -${100 - LINE * 100 - 1}% 0px`;

const pick = <T extends Element>(root: HTMLElement, selector: string, type: abstract new () => T): T => {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`toc: missing ${selector}`);
  return el;
};

const levelOf = (link: HTMLAnchorElement): Level => (link.dataset['tocLevel'] === 'step' ? 'step' : 'section');

const sectionLinkOf = (link: HTMLAnchorElement): HTMLAnchorElement => {
  const owner = link.closest('li')?.parentElement?.closest('li')?.querySelector(':scope > a[data-toc-level="section"]');
  return owner instanceof HTMLAnchorElement ? owner : link;
};

const toEntry = (link: HTMLAnchorElement): TocEntry[] => {
  const target = link.ownerDocument.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (target === null) return [];
  const level = levelOf(link);
  return [{ link, target, level, section: level === 'step' ? sectionLinkOf(link) : link }];
};

const queryParts = (nav: HTMLElement): Parts => ({
  details: pick(nav, 'details', HTMLDetailsElement),
  current: pick(nav, '[data-toc-current]', HTMLElement),
  entries: [...nav.querySelectorAll<HTMLAnchorElement>('a[data-toc-level]')].flatMap(toEntry),
});

const lastAbove = (entries: readonly TocEntry[], line: number): TocEntry | undefined => entries.filter((e) => e.target.getBoundingClientRect().top <= line).at(-1);

const atPageEnd = (doc: Document): boolean => {
  const scroller = doc.scrollingElement;
  return scroller !== null && scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
};

// A short last section never reaches the line, so the bottom of the page selects it outright.
const findCurrent = (entries: readonly TocEntry[], doc: Document): TocEntry | undefined => {
  const line = (doc.defaultView?.innerHeight ?? 0) * LINE;
  const sections = entries.filter((e) => e.level === 'section');
  const section = atPageEnd(doc) ? sections.at(-1) : lastAbove(sections, line);
  if (section === undefined) return undefined;
  const steps = entries.filter((e) => e.level === 'step' && e.section === section.link);
  return lastAbove(steps, line) ?? section;
};

const show = (parts: Parts, current: TocEntry | undefined): void => {
  for (const entry of parts.entries) {
    if (entry === current) entry.link.setAttribute('aria-current', 'location');
    else entry.link.removeAttribute('aria-current');
  }
  if (current !== undefined) parts.current.replaceChildren(current.section.textContent.trim());
};

const observe = (targets: readonly Element[], init: IntersectionObserverInit, onChange: () => void): Cleanup => {
  const observer = new IntersectionObserver(onChange, init);
  for (const target of targets) observer.observe(target);
  return () => observer.disconnect();
};

const closeOnLinkClick = (nav: HTMLElement, details: HTMLDetailsElement): Cleanup => {
  const handler = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest('a') !== null) details.toggleAttribute('open', false);
  };
  nav.addEventListener('click', handler);
  return () => nav.removeEventListener('click', handler);
};

/** Marks the link of what is being read and names its section in the narrow bar; the returned function unwires it. */
export const startToc = (nav: HTMLElement): Cleanup => {
  const parts = queryParts(nav);
  const doc = nav.ownerDocument;
  const sync = (): void => show(parts, findCurrent(parts.entries, doc));
  const targets = parts.entries.map((e) => e.target);
  const lastSection = parts.entries.filter((e) => e.level === 'section').at(-1)?.target;
  const cleanups = [observe(targets, { rootMargin: BAND }, sync), observe(lastSection === undefined ? [] : [lastSection], { threshold: [0, 0.5, 1] }, sync), closeOnLinkClick(nav, parts.details)];
  sync();
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
};

/** Starts the contents nav found in the page; called once by the top page's own script. */
export const mountToc = (doc: Document): Cleanup => {
  const nav = doc.querySelector<HTMLElement>('[data-toc]');
  return nav === null ? () => undefined : startToc(nav);
};
