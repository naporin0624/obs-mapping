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

export const UndoIcon = () => (
  <SvgIcon name="undo">
    <path d="M5.5 3 2.5 6l3 3M2.5 6h7a4 4 0 0 1 0 8H6" />
  </SvgIcon>
);

export const RedoIcon = () => (
  <SvgIcon name="redo">
    <path d="M10.5 3l3 3-3 3M13.5 6h-7a4 4 0 0 0 0 8H10" />
  </SvgIcon>
);

export const AlignLeftIcon = () => (
  <SvgIcon name="align-left">
    <path d="M2 2v12" />
    <rect x="5" y="4" width="9" height="3" />
    <rect x="5" y="9" width="5" height="3" />
  </SvgIcon>
);

export const AlignCenterHIcon = () => (
  <SvgIcon name="align-center-h">
    <path d="M8 2v12" />
    <rect x="3" y="4" width="10" height="3" />
    <rect x="5" y="9" width="6" height="3" />
  </SvgIcon>
);

export const AlignRightIcon = () => (
  <SvgIcon name="align-right">
    <path d="M14 2v12" />
    <rect x="2" y="4" width="9" height="3" />
    <rect x="6" y="9" width="5" height="3" />
  </SvgIcon>
);

export const AlignTopIcon = () => (
  <SvgIcon name="align-top">
    <path d="M2 2h12" />
    <rect x="4" y="5" width="3" height="9" />
    <rect x="9" y="5" width="3" height="5" />
  </SvgIcon>
);

export const AlignCenterVIcon = () => (
  <SvgIcon name="align-center-v">
    <path d="M2 8h12" />
    <rect x="4" y="3" width="3" height="10" />
    <rect x="9" y="5" width="3" height="6" />
  </SvgIcon>
);

export const AlignBottomIcon = () => (
  <SvgIcon name="align-bottom">
    <path d="M2 14h12" />
    <rect x="4" y="2" width="3" height="9" />
    <rect x="9" y="6" width="3" height="5" />
  </SvgIcon>
);

export const DistributeHIcon = () => (
  <SvgIcon name="distribute-h">
    <path d="M2 2v12M14 2v12" />
    <rect x="6" y="4" width="4" height="8" />
  </SvgIcon>
);

export const DistributeVIcon = () => (
  <SvgIcon name="distribute-v">
    <path d="M2 2h12M2 14h12" />
    <rect x="4" y="6" width="8" height="4" />
  </SvgIcon>
);

export const GroupIcon = () => (
  <SvgIcon name="group">
    <rect x="1" y="1" width="14" height="14" strokeDasharray="2 2" />
    <rect x="4" y="4" width="3" height="3" />
    <rect x="9" y="9" width="3" height="3" />
  </SvgIcon>
);

export const UngroupIcon = () => (
  <SvgIcon name="ungroup">
    <rect x="1.5" y="1.5" width="5.5" height="5.5" />
    <rect x="9" y="9" width="5.5" height="5.5" />
  </SvgIcon>
);

const TRAY = 'M2.5 10v3.5h11V10';

export const ImportIcon = () => (
  <SvgIcon name="import">
    <path d={TRAY} />
    <path d="M8 2v8M5 7l3 3 3-3" />
  </SvgIcon>
);

export const ExportIcon = () => (
  <SvgIcon name="export">
    <path d={TRAY} />
    <path d="M8 10V2M5 5l3-3 3 3" />
  </SvgIcon>
);
