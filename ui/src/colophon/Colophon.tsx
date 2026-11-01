import { useState, type ReactNode } from 'react';
import { Link } from 'react-aria-components';
import { css } from '../../styled-system/css';
import { SourceSelect, type SourceOption } from '../components/SourceSelect';

const pageCls = css({ display: 'flex', flexDirection: 'column', gap: '6', p: '6', maxWidth: '480px' });
const headingCls = css({ fontFamily: 'mono', fontWeight: 700, fontSize: '16px' });
const caseCls = css({ display: 'flex', flexDirection: 'column', gap: '2' });
const captionCls = css({ color: 'fg.muted' });
const linkCls = css({ color: 'accent.text', textDecoration: 'underline' });

const options: readonly SourceOption[] = [
  { id: 'Mapping', label: 'Mapping', detail: '1920x1080' },
  { id: 'Mapping-B', label: 'Mapping-B', detail: '1280x720' },
];
const longName = 'Camera feed from the stage left wide angle lens with a very long name';
const longOptions: readonly SourceOption[] = [{ id: longName, label: longName, detail: '3 surfaces' }, ...options];

const Case = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={caseCls}>
    <div className={captionCls}>{title}</div>
    {children}
  </section>
);

const noop = (): void => undefined;

export const Colophon = () => {
  const [picked, setPicked] = useState<string | null>('Mapping');
  return (
    <main className={pageCls}>
      <h1 className={headingCls}>Colophon</h1>
      <Link href="https://react-spectrum.adobe.com/react-aria/Select.html" className={linkCls} onClick={(e) => e.preventDefault()}>
        SourceSelect is built on react-aria-components Select
      </Link>
      <Case title="SourceSelect / placeholder">
        <SourceSelect label="Source" placeholder="Select a source" items={options} value={null} onChange={noop} />
      </Case>
      <Case title="SourceSelect / selected (interactive)">
        <SourceSelect label="Source" placeholder="Select a source" items={options} value={picked} onChange={setPicked} />
      </Case>
      <Case title="SourceSelect / disabled, no inputs">
        <SourceSelect ariaLabel="Source" placeholder="No inputs" items={[]} value={null} isDisabled onChange={noop} />
      </Case>
      <Case title="SourceSelect / long name truncation">
        <SourceSelect label="Source" placeholder="Select a source" items={longOptions} value={longName} onChange={noop} />
      </Case>
    </main>
  );
};
