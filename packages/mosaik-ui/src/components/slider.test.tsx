import { render, screen } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import * as Slider from "./slider"

describe("Slider.Thumbs", () => {
  it("keeps its thumb, and so its focus, as the value changes", async () => {
    render(() => (
      <Slider.Root defaultValue={[40]} aria-label={["Volume"]}>
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.Root>
    ))
    const thumb = screen.getByRole("slider")
    thumb.focus()
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}")
    expect(screen.getByRole("slider")).toBe(thumb)
    expect(document.activeElement).toBe(thumb)
    expect(thumb.getAttribute("aria-valuenow")).toBe("43")
  })
})
