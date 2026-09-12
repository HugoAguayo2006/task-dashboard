import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'add'
  | 'bell'
  | 'calendar'
  | 'canvas'
  | 'check'
  | 'clock'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'drag'
  | 'eye'
  | 'eye-off'
  | 'gear'
  | 'list'
  | 'menu'
  | 'moon'
  | 'more'
  | 'sun'
  | 'today'
  | 'tomorrow'
  | 'warning'

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName
  size?: number
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  const paths: Record<IconName, ReactNode> = {
    add: <path d="M12 5v14M5 12h14" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    canvas: <><path d="m12 3 8 5-8 5-8-5 8-5Z" /><path d="m4 12 8 5 8-5M4 16l8 5 8-5" /></>,
    check: <path d="m6 12 4 4 8-9" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    'chevron-down': <path d="m7 10 5 5 5-5" />,
    'chevron-left': <path d="m15 18-6-6 6-6" />,
    'chevron-right': <path d="m9 18 6-6-6-6" />,
    close: <path d="M7 7l10 10M17 7 7 17" />,
    drag: <><circle cx="9" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="17" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="1" fill="currentColor" stroke="none" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    'eye-off': <><path d="m4 4 16 16M10.7 6.2A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16.2 16.2 0 0 1-2.2 2.8M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
    more: <><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    today: <><rect x="4" y="3" width="16" height="18" rx="4" /><path d="M8 2v4M16 2v4M4 9h16" /><circle cx="12" cy="14" r="2" fill="currentColor" stroke="none" /></>,
    tomorrow: <><path d="M5 12h13M13 7l5 5-5 5" /><path d="M5 5v14" /></>,
    warning: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 17.3v.1" /></>,
  }

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
