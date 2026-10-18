import { Duration } from "effect"

const FIRST = Duration.seconds(30)
const MAX = Duration.hours(1)

/** Delay before the next attempt after `attempts` failed ones: 30s, 1m, 2m, 4m, ... capped at 1h. */
export const retryDelay = (attempts: number): Duration.Duration =>
  Duration.min(Duration.times(FIRST, 2 ** Math.max(attempts - 1, 0)), MAX)
