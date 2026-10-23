/**
 * `@mosaik/sdk/testing`: an app's backend in tests (`*.test.ts`), without a server or the platform: its
 * API called in memory as chosen people, through its real access control, and the platform's services
 * standing in, recording what the app did.
 */
export {
  AppTest,
  type AppTestOptions,
  type RecordedAudit,
  TestAudit,
  TestEvents,
  type TestFile,
  TestMessages,
  TestNotify,
  type TestPrincipal,
  TestSettings,
  TestStorage,
  type TypedTestSettings,
} from "@mosaik/testing"
