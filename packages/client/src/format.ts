import { DateTime } from "effect"

export type DateInput = DateTime.DateTime | Date | number | string

const toDate = (input: DateInput): Date => (DateTime.isDateTime(input) ? DateTime.toDate(input) : new Date(input))

const currencyFormats = new Map<string, Intl.NumberFormat>()

/** `formatCurrency(123456)` → `€1,234.56` (amounts are in cents). */
export const formatCurrency = (cents: number, currency = "EUR"): string => {
  let format = currencyFormats.get(currency)
  if (format === undefined) {
    format = new Intl.NumberFormat(undefined, { style: "currency", currency })
    currencyFormats.set(currency, format)
  }
  return format.format(cents / 100)
}

/** `formatCompactCurrency(123456789)` → `€1.2M` (amounts are in cents). */
export const formatCompactCurrency = (cents: number, currency = "EUR"): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100)

const numberFormat = new Intl.NumberFormat()
export const formatNumber = (value: number): string => numberFormat.format(value)

const percentFormat = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 })
/** `formatPercent(0.123)` → `12.3%` */
export const formatPercent = (ratio: number): string => percentFormat.format(ratio)

const BYTE_UNITS = ["kilobyte", "megabyte", "gigabyte", "terabyte"] as const
const byteFormats = BYTE_UNITS.map(
  (unit) => new Intl.NumberFormat(undefined, { style: "unit", unit, unitDisplay: "short", maximumFractionDigits: 1 }),
)
/** A size as people read it: `512 B`, `4.2 MB`, `5 GB` (units of 1024). */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${numberFormat.format(bytes)} B`
  const index = Math.min(BYTE_UNITS.length, Math.floor(Math.log(bytes) / Math.log(1024)))
  return (byteFormats[index - 1] as Intl.NumberFormat).format(bytes / 1024 ** index)
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })
export const formatDate = (input: DateInput): string => dateFormat.format(toDate(input))

const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
export const formatDateTime = (input: DateInput): string => dateTimeFormat.format(toDate(input))

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
]

/** `formatRelativeTime(fiveMinutesAgo)` → `5 minutes ago` */
export const formatRelativeTime = (input: DateInput, now: number = Date.now()): string => {
  const seconds = Math.round((toDate(input).getTime() - now) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size || unit === "second") {
      return relativeFormat.format(Math.round(seconds / size), unit)
    }
  }
  return ""
}
