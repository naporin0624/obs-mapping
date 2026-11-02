import type { ReactNode } from 'react';

const SvgIcon = ({ name, children }: { name: string; children: ReactNode }) => (
  <svg
    data-icon={name}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const EYE_OUTLINE = 'M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z';

export const EyeIcon = () => (
  <SvgIcon name="eye">
    <path d={EYE_OUTLINE} />
    <circle cx="8" cy="8" r="2" />
  </SvgIcon>
);

export const EyeOffIcon = () => (
  <SvgIcon name="eye-off">
    <path d={EYE_OUTLINE} />
    <circle cx="8" cy="8" r="2" />
    <path d="M2.5 13.5 13.5 2.5" />
  </SvgIcon>
);

export const PlusIcon = () => (
  <SvgIcon name="plus">
    <path d="M8 2.5v11M2.5 8h11" />
  </SvgIcon>
);

export const TrashIcon = () => (
  <SvgIcon name="trash">
    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.5 6.5v5M9.5 6.5v5" />
  </SvgIcon>
);
