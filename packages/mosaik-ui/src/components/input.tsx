import { Field } from "@ark-ui/solid/field"
import { type Accessor, type ComponentProps, createContext, useContext } from "solid-js"
import { styled } from "../../styled-system/jsx"
import { type InputVariantProps, input } from "../../styled-system/recipes"

const StyledInput = styled(Field.Input, input)

/** The size an `InputGroup` gives the input inside it, so that the two cannot disagree. */
export const InputSizeContext = createContext<Accessor<InputVariantProps["size"]>>()

export type InputProps = ComponentProps<typeof StyledInput>

export const Input = (props: InputProps) => {
  const groupSize = useContext(InputSizeContext)
  return <StyledInput size={groupSize?.()} {...props} />
}
