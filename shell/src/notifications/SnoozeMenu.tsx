import { css } from "@mosaik/styled-system/css"
import { ActionMenu, Button, DatePickerField, Modal, SelectField } from "@mosaik/ui"
import { createSignal, type JSX } from "solid-js"
import { SNOOZE_HOURS, type SnoozeTime, snoozeAt, snoozeChoices } from "./snooze"

/** A local day as a date field gives it, `2026-11-12`. */
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const hourLabel = (hour: number) => new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { timeStyle: "short" })

/** A day and a time of it to snooze until, when none of the usual ones fits. */
const PickTime = (props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (time: SnoozeTime) => void
}) => {
  const tomorrow = () => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return isoDay(date)
  }
  // `""` while no day is chosen.
  const [day, setDay] = createSignal(tomorrow())
  const [hour, setHour] = createSignal(String(SNOOZE_HOURS[0]))
  const picked = () => {
    const chosen = day()
    return chosen === "" ? undefined : snoozeAt(chosen, Number(hour()))
  }
  const valid = () => (picked()?.until.getTime() ?? 0) > Date.now()

  return (
    <Modal
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
      size="sm"
      title="Snooze until"
      description="It comes back to your inbox, unread, at that time."
      footer={
        <>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid()}
            onClick={() => {
              const time = picked()
              if (time === undefined) return
              props.onPick(time)
              props.onOpenChange(false)
            }}
          >
            Snooze
          </Button>
        </>
      }
    >
      <div class={css({ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 8rem", gap: "3", alignItems: "end" })}>
        <DatePickerField label="Day" value={day()} onValueChange={setDay} min={isoDay(new Date())} />
        <SelectField
          label="Time"
          options={SNOOZE_HOURS.map((value) => ({ value: String(value), label: hourLabel(value) }))}
          value={hour()}
          onValueChange={(value) => value !== "" && setHour(value)}
        />
      </div>
    </Modal>
  )
}

/** When to put something away until: in an hour, tomorrow morning, next week, or a day and time picked. */
export const SnoozeMenu = (props: {
  trigger: (trigger: () => JSX.HTMLAttributes<HTMLButtonElement>) => JSX.Element
  onSnooze: (time: SnoozeTime) => void
}) => {
  const [picking, setPicking] = createSignal(false)
  return (
    <>
      <ActionMenu
        trigger={props.trigger}
        items={[
          ...snoozeChoices(new Date()).map((choice) => ({
            value: choice.id,
            label: choice.label,
            onSelect: () => props.onSnooze(choice),
          })),
          { value: "pick", label: "Pick a date…", onSelect: () => setPicking(true) },
        ]}
      />
      <PickTime open={picking()} onOpenChange={setPicking} onPick={props.onSnooze} />
    </>
  )
}
