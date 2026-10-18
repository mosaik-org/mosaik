import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: [
            "packages/*/src/**/*.test.ts",
            "services/*/src/**/*.test.ts",
            "apps/*/{api,server}/**/*.test.ts",
            "examples/*/{api,server}/**/*.test.ts",
            "tooling/src/**/*.test.ts",
          ],
        },
      },
      // Logic of the shell that does not need a browser.
      { test: { name: "shell", environment: "node", include: ["shell/src/**/*.test.ts"] } },
    ],
  },
})
