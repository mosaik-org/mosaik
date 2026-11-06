import { type AppColor, appColors } from "@mosaik/core"
import { hashOf } from "./appColor"

/** A person's colour, from their id: the same in every app, and through a change of name. */
export const userColor = (id: string): AppColor => appColors[hashOf(id) % appColors.length] ?? "blue"
