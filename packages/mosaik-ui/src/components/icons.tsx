import type { JSX } from "solid-js"

/*
 * The few icons the components draw themselves (chevrons, check, close, ...), so the library needs
 * no icon package. Paths from Lucide (https://lucide.dev, ISC license, see LICENSE). Every slot that
 * shows one also takes any icon an app passes. Drawn at 1.5px, lighter than Lucide's 2px, as Geist's
 * own icons are: they sit beside text rather than outweigh it.
 */

export type IconProps = JSX.SvgSVGAttributes<SVGSVGElement>

const svg = (children: JSX.Element, props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
)

export const CheckIcon = (props: IconProps) => svg(<path d="M20 6 9 17l-5-5" />, props)

export const ChevronDownIcon = (props: IconProps) => svg(<path d="m6 9 6 6 6-6" />, props)

export const ChevronUpIcon = (props: IconProps) => svg(<path d="m18 15-6-6-6 6" />, props)

export const ChevronRightIcon = (props: IconProps) => svg(<path d="m9 18 6-6-6-6" />, props)

export const ChevronLeftIcon = (props: IconProps) => svg(<path d="m15 18-6-6 6-6" />, props)

export const ChevronsUpDownIcon = (props: IconProps) =>
  svg(
    <>
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </>,
    props,
  )

export const XIcon = (props: IconProps) =>
  svg(
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>,
    props,
  )

export const CopyIcon = (props: IconProps) =>
  svg(
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>,
    props,
  )

export const CheckCircleIcon = (props: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16 9-5.5 5.5L8 12" />
    </>,
    props,
  )

export const CircleAlertIcon = (props: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </>,
    props,
  )

export const CircleXIcon = (props: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </>,
    props,
  )

export const InfoIcon = (props: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>,
    props,
  )

export const EllipsisIcon = (props: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>,
    props,
  )

export const FileIcon = (props: IconProps) =>
  svg(
    <>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
    </>,
    props,
  )

export const StarIcon = (props: IconProps) =>
  svg(
    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />,
    props,
  )

export const UserIcon = (props: IconProps) =>
  svg(
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>,
    props,
  )

export const EyeIcon = (props: IconProps) =>
  svg(
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </>,
    props,
  )

export const EyeOffIcon = (props: IconProps) =>
  svg(
    <>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </>,
    props,
  )

export const MinusIcon = (props: IconProps) => svg(<path d="M5 12h14" />, props)

export const PlusIcon = (props: IconProps) =>
  svg(
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>,
    props,
  )

export const UploadIcon = (props: IconProps) =>
  svg(
    <>
      <path d="M12 3v12" />
      <path d="m17 8-5-5-5 5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </>,
    props,
  )

export const CalendarIcon = (props: IconProps) =>
  svg(
    <>
      <path d="M8 2v3" />
      <path d="M16 2v3" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
    </>,
    props,
  )

export const TriangleAlertIcon = (props: IconProps) =>
  svg(
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>,
    props,
  )

export const RefreshCwIcon = (props: IconProps) =>
  svg(
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>,
    props,
  )

export const ArrowUpRightIcon = (props: IconProps) =>
  svg(
    <>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </>,
    props,
  )

export const ArrowDownRightIcon = (props: IconProps) =>
  svg(
    <>
      <path d="m7 7 10 10" />
      <path d="M17 7v10H7" />
    </>,
    props,
  )

export const SunIcon = (props: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </>,
    props,
  )

export const MoonIcon = (props: IconProps) =>
  svg(
    <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />,
    props,
  )

export const MonitorIcon = (props: IconProps) =>
  svg(
    <>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </>,
    props,
  )

export const SearchIcon = (props: IconProps) =>
  svg(
    <>
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </>,
    props,
  )
