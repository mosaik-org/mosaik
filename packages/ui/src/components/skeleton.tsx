import { css, cx } from "@mosaik/styled-system/css"

const skeleton = css({
  display: "block",
  h: "4",
  w: "full",
  bg: "bg.muted",
  borderRadius: "sm",
  animation: "pulse",
})

export interface SkeletonProps {
  height?: string
  width?: string
  class?: string
}

export function Skeleton(props: SkeletonProps) {
  return (
    <span aria-hidden="true" class={cx(skeleton, props.class)} style={{ height: props.height, width: props.width }} />
  )
}
