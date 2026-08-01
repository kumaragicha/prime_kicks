import type { ReactNode } from 'react';

export type IconName =
  | 'arrow'
  | 'bag'
  | 'menu'
  | 'close'
  | 'search'
  | 'user'
  | 'minus'
  | 'plus'
  | 'trash'
  | 'play'
  | 'share'
  | 'chevron-left'
  | 'chevron-right'
  | 'filter'
  | 'check'
  | 'x'
  | 'download';

const paths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  bag: (
    <>
      <path d="M5 8.5h14l-1 12H6l-1-12Z" />
      <path d="M8.5 9V6a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20c.8-3.3 3-5 6.5-5s5.7 1.7 6.5 5" />
    </>
  ),
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
  trash: (
    <>
      <path d="M5 7h14M10 11v5M14 11v5M8 7l1-2h6l1 2M7 7l.7 13h8.6L17 7" />
    </>
  ),
  play: <path d="m9 7 8 5-8 5V7Z" fill="currentColor" stroke="none" />,
  share: (
    <>
      <path d="M18 8a3 3 0 1 0-2.8-4A3 3 0 0 0 18 8ZM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      <path d="m8.5 16.5 7-4M8.5 6.5l7 4" />
    </>
  ),
  'chevron-left': <path d="m14.5 5-7 7 7 7" />,
  'chevron-right': <path d="m9.5 5 7 7-7 7" />,
  filter: <path d="M4 5h16l-6.4 7.6V19l-3.2-1.6v-4.8L4 5Z" />,
  check: <path d="M5 12l5 5L20 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  download: (
    <>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M5 21h14" />
    </>
  ),
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
