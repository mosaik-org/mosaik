import { css, cx } from "@mosaik/styled-system/css"
import { Spinner, useTheme } from "@mosaik/ui"
import { type EChartsCoreOption, type EChartsType, init } from "echarts/core"
import { createEffect, createSignal, mergeProps, onCleanup, onMount, Show } from "solid-js"
import { DARK_THEME, LIGHT_THEME } from "./setup"

const styles = {
  root: css({ position: "relative", w: "full", minW: "0" }),
  canvas: css({ w: "full", h: "full" }),
  overlay: css({
    position: "absolute",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    bg: "bg.surface/60",
    color: "fg.muted",
    animation: "fadeIn 150ms ease-out",
  }),
}

export interface ChartProps {
  option: EChartsCoreOption
  height?: string
  loading?: boolean
  class?: string
}

export function Chart(props: ChartProps) {
  const merged = mergeProps({ height: "320px" }, props)
  const theme = useTheme()
  const [chart, setChart] = createSignal<EChartsType>()
  let container!: HTMLDivElement

  onMount(() => {
    createEffect(() => {
      const instance = init(container, theme.resolved() === "dark" ? DARK_THEME : LIGHT_THEME)
      setChart(instance)
      onCleanup(() => {
        setChart(undefined)
        instance.dispose()
      })
    })

    const observer = new ResizeObserver(() => chart()?.resize())
    observer.observe(container)
    onCleanup(() => observer.disconnect())
  })

  createEffect(() => {
    chart()?.setOption(merged.option, { notMerge: true })
  })

  return (
    <div
      class={cx(styles.root, merged.class)}
      style={{ height: merged.height }}
      aria-busy={merged.loading || undefined}
    >
      <div ref={container} class={styles.canvas} />
      <Show when={merged.loading}>
        <div class={styles.overlay}>
          <Spinner />
        </div>
      </Show>
    </div>
  )
}
