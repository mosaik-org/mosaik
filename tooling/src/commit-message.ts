/**
 * The commit message convention (see CONTRIBUTING.md): Conventional Commits headers, written
 * like https://cbea.ms/git-commit/ — a short, capitalized, imperative subject, a blank line,
 * and a body wrapped at 72 that explains what changed and why.
 */

export const COMMIT_TYPES = [
  "feat",
  "fix",
  "refactor",
  "perf",
  "docs",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const

/** Hard limit for the header; aim for about 50 characters after the prefix. */
export const HEADER_MAX = 72
export const BODY_WIDTH = 72

const HEADER = new RegExp(`^(${COMMIT_TYPES.join("|")})(\\([a-z0-9][a-z0-9/-]*\\))?(!)?: (.+)$`)

/** Messages git writes itself, and fixups that are squashed away before they land. */
const GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/

/** What git keeps of a message: no comment lines, nothing below the scissors line. */
const meaningfulLines = (message: string): ReadonlyArray<string> => {
  const lines: Array<string> = []
  for (const line of message.split("\n")) {
    if (line.startsWith("# ------------------------ >8 ------------------------")) break
    if (!line.startsWith("#")) lines.push(line.trimEnd())
  }
  while (lines.length > 0 && lines.at(-1) === "") lines.pop()
  return lines
}

/** A body line that may run long: a URL, a trailer, or anything without spaces to wrap at. */
const unwrappable = (line: string) =>
  /https?:\/\//.test(line) || /^[A-Za-z-]+: /.test(line) || !line.trim().includes(" ")

/** Why the message breaks the convention; empty when it follows it. */
export const commitMessageProblems = (message: string): ReadonlyArray<string> => {
  const [header = "", second, ...body] = meaningfulLines(message)
  if (header.trim() === "") return ["The message is empty."]
  if (GENERATED.test(header)) return []

  const problems: Array<string> = []
  const match = HEADER.exec(header)
  if (match === null) {
    problems.push(
      `The subject must look like "type(scope): Description", with type one of ${COMMIT_TYPES.join(", ")}` +
        ` and an optional lowercase scope (e.g. "feat(platform): Let owners answer access requests").`,
    )
  } else {
    const description = match[4] ?? ""
    if (!/^[A-Z]/.test(description)) problems.push("Capitalize the description after the colon.")
    if (description.endsWith(".")) problems.push("Don't end the subject with a period.")
  }
  if (header.length > HEADER_MAX) {
    problems.push(`Keep the subject within ${HEADER_MAX} characters (it has ${header.length}); aim for about 50.`)
  }
  if (second !== undefined && second !== "") problems.push("Separate the subject from the body with a blank line.")
  const long = body.filter((line) => line.length > BODY_WIDTH && !unwrappable(line))
  if (long.length > 0) problems.push(`Wrap the body at ${BODY_WIDTH} characters (${long.length} longer lines).`)
  return problems
}
