import { colorOf } from "@mosaik/core"
import { Avatar } from "@mosaik/ui"
import type { JSX } from "solid-js"
import { splitProps } from "solid-js"

export interface UserAvatarProps extends Omit<Avatar.RootProps, "children" | "colorPalette"> {
  readonly user: {
    readonly id: string
    readonly name: string
    readonly image?: string | null | undefined
  }
}

/**
 * A person: their photo, or their initials on their own pale colour, so that the same person looks
 * the same wherever they appear and can be spotted in a list without reading it.
 */
export const UserAvatar = (props: UserAvatarProps): JSX.Element => {
  const [local, rest] = splitProps(props, ["user"])
  return (
    <Avatar.Root title={local.user.name} {...rest} colorPalette={colorOf(local.user.id)}>
      <Avatar.Fallback name={local.user.name} />
      <Avatar.Image src={local.user.image ?? undefined} alt="" />
    </Avatar.Root>
  )
}
