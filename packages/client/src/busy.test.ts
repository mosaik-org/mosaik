import { describe, expect, it } from "vitest"
import { busyMarks, markBusy, onBusyChange } from "./busy"

describe("markBusy", () => {
  it("shows the work until it ends, once, and tells whoever listens", () => {
    const seen: Array<ReadonlyArray<string>> = []
    const stop = onBusyChange((marks) => seen.push(marks.map((mark) => mark.label)))
    const upload = markBusy({ label: "Uploading" })
    const save = markBusy({ label: "Saving" })
    upload()
    upload()
    save()
    stop()
    expect(seen).toEqual([["Uploading"], ["Uploading", "Saving"], ["Saving"], []])
    expect(busyMarks()).toEqual([])
  })
})
