import { type DateValue, parseDate } from "@ark-ui/solid/date-picker"
import { createEffect, createSignal, For, type JSX, on, Show, splitProps } from "solid-js"
import { Portal } from "solid-js/web"
import type { DatePickerVariantProps } from "../../styled-system/recipes"
import * as DatePicker from "../components/date-picker"
import { IconButton } from "../components/icon-button"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "../components/icons"
import { Input } from "../components/input"
import { type FieldProps, FormField } from "./form-field"

/** A calendar date as ISO text, `"2026-10-19"`: what APIs and Schemas exchange, no time or zone. */
export type IsoDate = string

const toDate = (value: IsoDate | null | undefined): DateValue | undefined => {
  if (!value) return undefined
  try {
    return parseDate(value)
  } catch {
    return undefined
  }
}

const toDates = (values: ReadonlyArray<IsoDate | null | undefined> | undefined) =>
  values === undefined ? undefined : values.map(toDate).filter((date): date is DateValue => date !== undefined)

interface CalendarOptions extends DatePickerVariantProps {
  /** Names of a range's two inputs, which share one visible label; "Start date" and "End date". */
  readonly inputLabels?: readonly [start: string, end: string]
  /** The earliest date that can be picked. */
  readonly min?: IsoDate
  /** The latest date that can be picked. */
  readonly max?: IsoDate
  /** Dates that cannot be picked, such as weekends. */
  readonly isDateUnavailable?: (date: IsoDate) => boolean
  /** 0 is Sunday; by default the locale's. */
  readonly startOfWeek?: number
  readonly placeholder?: string
  readonly onBlur?: (event: FocusEvent) => void
  /** Renders the calendar in place instead of in a portal. */
  readonly inline?: boolean
}

const CALENDAR_OPTIONS = [
  "min",
  "max",
  "isDateUnavailable",
  "placeholder",
  "onBlur",
  "inline",
  "name",
  "inputLabels",
] as const

const ViewControl = () => (
  <DatePicker.ViewControl>
    <DatePicker.PrevTrigger asChild={(trigger) => <IconButton variant="plain" size="sm" {...trigger()} />}>
      <ChevronLeftIcon />
    </DatePicker.PrevTrigger>
    <DatePicker.ViewTrigger asChild={(trigger) => <IconButton variant="plain" size="sm" px="2" {...trigger()} />}>
      <DatePicker.RangeText />
    </DatePicker.ViewTrigger>
    <DatePicker.NextTrigger asChild={(trigger) => <IconButton variant="plain" size="sm" {...trigger()} />}>
      <ChevronRightIcon />
    </DatePicker.NextTrigger>
  </DatePicker.ViewControl>
)

const Grid = (props: { rows: Array<Array<{ label: string; value: number }>> }) => (
  <DatePicker.Table>
    <DatePicker.TableBody>
      <For each={props.rows}>
        {(row) => (
          <DatePicker.TableRow>
            <For each={row}>
              {(cell) => (
                <DatePicker.TableCell value={cell.value}>
                  <DatePicker.TableCellTrigger>{cell.label}</DatePicker.TableCellTrigger>
                </DatePicker.TableCell>
              )}
            </For>
          </DatePicker.TableRow>
        )}
      </For>
    </DatePicker.TableBody>
  </DatePicker.Table>
)

/** The day, month and year views of the date pickers; `DatePicker` parts for one of your own. */
export const Calendar = () => (
  <>
    <DatePicker.View view="day">
      <DatePicker.Context>
        {(picker) => (
          <>
            <ViewControl />
            <DatePicker.Table>
              <DatePicker.TableHead>
                <DatePicker.TableRow>
                  <For each={picker().weekDays}>
                    {(day) => <DatePicker.TableHeader>{day.narrow}</DatePicker.TableHeader>}
                  </For>
                </DatePicker.TableRow>
              </DatePicker.TableHead>
              <DatePicker.TableBody>
                <For each={picker().weeks}>
                  {(week) => (
                    <DatePicker.TableRow>
                      <For each={week}>
                        {(day) => (
                          <DatePicker.TableCell value={day}>
                            <DatePicker.TableCellTrigger>{day.day}</DatePicker.TableCellTrigger>
                          </DatePicker.TableCell>
                        )}
                      </For>
                    </DatePicker.TableRow>
                  )}
                </For>
              </DatePicker.TableBody>
            </DatePicker.Table>
          </>
        )}
      </DatePicker.Context>
    </DatePicker.View>
    <DatePicker.View view="month">
      <DatePicker.Context>
        {(picker) => (
          <>
            <ViewControl />
            <Grid rows={picker().getMonthsGrid({ columns: 4, format: "short" })} />
          </>
        )}
      </DatePicker.Context>
    </DatePicker.View>
    <DatePicker.View view="year">
      <DatePicker.Context>
        {(picker) => (
          <>
            <ViewControl />
            <Grid rows={picker().getYearsGrid({ columns: 4 })} />
          </>
        )}
      </DatePicker.Context>
    </DatePicker.View>
  </>
)

const Picker = (
  props: FieldProps &
    CalendarOptions & {
      readonly selectionMode: "single" | "range"
      readonly value?: DateValue[]
      readonly defaultValue?: DateValue[]
      readonly onValueChange: (values: DateValue[]) => void
      readonly inputs: number
    },
) => {
  // Ark's date picker does not read the field context: it gets the label and states itself, and
  // `FormField` adds only the help and the error.
  const [field, local, rest] = splitProps(
    props,
    ["helperText", "errorText", "invalid", "id", "class"],
    [...CALENDAR_OPTIONS, "label", "optionalText", "onValueChange", "inputs", "isDateUnavailable"],
  )
  return (
    <FormField {...field} disabled={rest.disabled} readOnly={rest.readOnly} required={rest.required}>
      <DatePicker.Root
        min={toDate(local.min)}
        max={toDate(local.max)}
        isDateUnavailable={local.isDateUnavailable && ((date) => local.isDateUnavailable?.(date.toString()) ?? false)}
        onValueChange={(details) => local.onValueChange(details.value)}
        name={local.name}
        invalid={field.invalid || Boolean(field.errorText)}
        {...rest}
      >
        <Show when={local.label}>
          <DatePicker.Label>{local.label}</DatePicker.Label>
        </Show>
        <DatePicker.Control>
          <For each={Array.from({ length: local.inputs }, (_, index) => index)}>
            {(index) => (
              <DatePicker.Input
                index={index}
                aria-label={local.inputs > 1 ? (local.inputLabels ?? ["Start date", "End date"])[index] : undefined}
                placeholder={local.placeholder}
                onBlur={(event) => local.onBlur?.(event)}
                asChild={(input) => <Input {...input()} />}
              />
            )}
          </For>
          <DatePicker.Trigger
            asChild={(trigger) => <IconButton variant="outline" colorPalette="gray" {...trigger()} />}
          >
            <CalendarIcon />
          </DatePicker.Trigger>
          <DatePicker.ClearTrigger
            asChild={(trigger) => <IconButton variant="plain" colorPalette="gray" {...trigger()} />}
          >
            <XIcon />
          </DatePicker.ClearTrigger>
        </DatePicker.Control>
        <Layer inline={local.inline}>
          <DatePicker.Positioner>
            <DatePicker.Content>
              <Calendar />
            </DatePicker.Content>
          </DatePicker.Positioner>
        </Layer>
      </DatePicker.Root>
    </FormField>
  )
}

const Layer = (props: { inline?: boolean; children: JSX.Element }) => (
  <Show when={!props.inline} fallback={props.children}>
    <Portal>{props.children}</Portal>
  </Show>
)

export interface DatePickerFieldProps extends FieldProps, CalendarOptions {
  /** The date, `null` for none. */
  readonly value?: IsoDate | null
  readonly defaultValue?: IsoDate | null
  readonly onValueChange?: (value: IsoDate | null) => void
}

/**
 * A labeled date input with a calendar: typed in the locale's format or picked, given as ISO text
 * (`"2026-10-19"`), the form APIs exchange.
 */
export const DatePickerField = (props: DatePickerFieldProps) => {
  const [local, rest] = splitProps(props, ["value", "defaultValue", "onValueChange"])
  return (
    <Picker
      selectionMode="single"
      inputs={1}
      value={local.value === undefined ? undefined : toDates([local.value])}
      defaultValue={toDates(local.defaultValue === undefined ? undefined : [local.defaultValue])}
      onValueChange={(dates) => local.onValueChange?.(dates[0]?.toString() ?? null)}
      {...rest}
    />
  )
}

export type IsoDateRange = readonly [start: IsoDate, end: IsoDate]

export interface DateRangePickerFieldProps extends FieldProps, CalendarOptions {
  /** The first and last day, `null` for none. */
  readonly value?: IsoDateRange | null
  readonly defaultValue?: IsoDateRange | null
  /** Called with both days once the range is complete, and with `null` when it is cleared. */
  readonly onValueChange?: (value: IsoDateRange | null) => void
}

/** A labeled pair of date inputs with one calendar, for a range such as a report's period. */
export const DateRangePickerField = (props: DateRangePickerFieldProps) => {
  const [local, rest] = splitProps(props, ["value", "defaultValue", "onValueChange"])
  // The first day while the second is still to be picked: the app hears only of whole ranges, so a
  // controlled `value` stays as it was meanwhile, and would otherwise undo the first pick.
  const [partial, setPartial] = createSignal<DateValue[]>()
  createEffect(
    on(
      () => local.value,
      () => setPartial(undefined),
      { defer: true },
    ),
  )
  return (
    <Picker
      selectionMode="range"
      inputs={2}
      value={partial() ?? (local.value === undefined ? undefined : toDates(local.value ?? []))}
      defaultValue={toDates(local.defaultValue === undefined ? undefined : (local.defaultValue ?? []))}
      onValueChange={(dates) => {
        const [start, end] = dates
        if (start && end) {
          setPartial(undefined)
          local.onValueChange?.([start.toString(), end.toString()])
        } else if (dates.length === 0) {
          setPartial(undefined)
          local.onValueChange?.(null)
        } else setPartial(dates)
      }}
      {...rest}
    />
  )
}
