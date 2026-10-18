/**
 * The `commit-msg` hook (`.githooks/commit-msg`): refuses a message that breaks the
 * convention, and says why.
 *
 *   bun tooling/src/check-commit-message.ts <message file>
 */
import { commitMessageProblems } from "./commit-message"

const [file] = process.argv.slice(2)
if (file === undefined) {
  console.error("Usage: bun tooling/src/check-commit-message.ts <message file>")
  process.exit(2)
}

const message = await Bun.file(file).text()
const problems = commitMessageProblems(message)
if (problems.length > 0) {
  console.error('The commit message does not follow the convention (CONTRIBUTING.md, "Commit messages"):\n')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error(`\nYour message is kept in ${file}: fix it with \`git commit -e -F ${file}\`.`)
  process.exit(1)
}
