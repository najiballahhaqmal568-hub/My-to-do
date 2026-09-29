const PATHS = {
  check: 'M5 12.5l4.2 4.2L19 7',
  plus: 'M12 5v14M5 12h14',
  home: 'M4 11l8-6.5 8 6.5V20h-5v-5h-6v5H4z',
  calendar: 'M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M9 3.5v3M15 3.5v3',
  grid: 'M5 4h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM14 4h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 13h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM14 13h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.3 1-1.5 2.6-1.6-.5a7 7 0 0 1-1.6.9l-.3 1.7h-3l-.3-1.7a7 7 0 0 1-1.6-.9l-1.6.5-1.5-2.6 1.3-1a7 7 0 0 1 0-1.9l-1.3-1 1.5-2.6 1.6.5a7 7 0 0 1 1.6-.9l.3-1.7h3l.3 1.7a7 7 0 0 1 1.6.9l1.6-.5 1.5 2.6-1.3 1a7 7 0 0 1 0 1.9z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.5V12l3 2',
  repeat: 'M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5',
  subtasks: 'M5 5v10a3 3 0 0 0 3 3h11M5 10h14',
  bell: 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5h4',
  back: 'M9 6l6 6-6 6',
  forward: 'M15 6l-6 6 6 6',
  chevron: 'M15 6l-6 6 6 6',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  close: 'M6 6l12 12M18 6L6 18',
  skip: 'M5 5l8 7-8 7zM17 5v14',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  inbox: 'M4 13l2.5-7h11L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 13h4.5l1 2h5l1-2H20',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, small, className }: { name: IconName; small?: boolean; className?: string }) {
  return (
    <svg className={`i${small ? ' s' : ''}${className ? ' ' + className : ''}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
