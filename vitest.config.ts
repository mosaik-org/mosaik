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
          exclude: [
            "packages/web-kit/**",
            "packages/frame/**",
            "packages/client/**",
            "packages/auth/src/web/**",
            "packages/charts/**",
            "**/node_modules/**",
          ],
        },
      },
      // Browser packages' logic (forms, queries, live streams): Solid's browser build, reactive, without a DOM.
      {
        resolve: { conditions: ["browser", "development"] },
        ssr: { resolve: { conditions: ["browser", "development"], externalConditions: ["browser", "development"] } },
        test: {
          name: "web",
          environment: "node",
          include: [
            "packages/web-kit/src/**/*.test.ts",
            "packages/frame/src/**/*.test.ts",
            "packages/client/src/**/*.test.ts",
            "packages/auth/src/web/**/*.test.ts",
            "packages/assistant/src/web/**/*.test.ts",
            "packages/charts/src/**/*.test.ts",
          ],
        },
      },
      // Logic of the shell that does not need a browser.
      { test: { name: "shell", environment: "node", include: ["shell/src/**/*.test.ts"] } },
    ],
  },
})
