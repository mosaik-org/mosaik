import { describe, expect, it } from "@effect/vitest"
import { commitMessageProblems } from "./commit-message"

const body = `Owners decide who can use their app, so requests go to them first
instead of every admin, who with hundreds of apps cannot know whom
to let in. Apps without an owner still notify the admins.`

describe("commitMessageProblems", () => {
  it("accepts a conventional header with a wrapped body explaining why", () => {
    expect(commitMessageProblems(`feat(platform): Send access requests to app owners\n\n${body}\n`)).toEqual([])
    expect(commitMessageProblems("fix(shell): Keep glob imports out of .tsx files")).toEqual([])
    expect(commitMessageProblems("feat(sdk)!: Rename defineDashboard to defineApp")).toEqual([])
    expect(commitMessageProblems("docs: Describe the commit convention")).toEqual([])
  })

  it("lets long URLs and trailers through", () => {
    const message = `chore: Pin Vite\n\nSee https://github.com/vitejs/vite/issues/12345678901234567890123456789012345\n\nCo-Authored-By: Someone With A Long Name <someone.with.a.long.name@example.com>`
    expect(commitMessageProblems(message)).toEqual([])
  })

  it("ignores comments and everything below the scissors line", () => {
    const message = `fix: Retry registration\n\n# Please enter the commit message\n# ------------------------ >8 ------------------------\ndiff --git a/x b/x`
    expect(commitMessageProblems(message)).toEqual([])
  })

  it("leaves messages git writes alone", () => {
    expect(commitMessageProblems("Merge branch 'owners'")).toEqual([])
    expect(commitMessageProblems('Revert "feat: Add owners"')).toEqual([])
    expect(commitMessageProblems("fixup! feat: Add owners")).toEqual([])
  })

  it("explains each rule broken", () => {
    expect(commitMessageProblems("Added owners.")).toHaveLength(1)
    expect(commitMessageProblems("feat: add owners.")).toEqual([
      "Capitalize the description after the colon.",
      "Don't end the subject with a period.",
    ])
    expect(commitMessageProblems(`feat: Add owners\nwho decide who can use their app`)).toEqual([
      "Separate the subject from the body with a blank line.",
    ])
    expect(commitMessageProblems(`feat: ${"A".repeat(70)}`)[0]).toMatch(/within 72 characters/)
    expect(commitMessageProblems(`feat: Add owners\n\n${"word ".repeat(20)}`)[0]).toMatch(/Wrap the body/)
    expect(commitMessageProblems("\n\n")).toEqual(["The message is empty."])
  })
})
