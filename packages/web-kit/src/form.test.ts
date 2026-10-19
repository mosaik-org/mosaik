import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { createRoot } from "solid-js"
import { createForm, type Form } from "./form"

class NewUser extends Schema.Class<NewUser>("NewUser")({
  email: Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+$/, { message: "Invalid email address" })),
  name: Schema.String.check(Schema.isMinLength(1, { message: "Required" })),
  roles: Schema.Array(Schema.String),
}) {}

const initial = { email: "", name: "", roles: [] as ReadonlyArray<string> }

/** Runs `use` with a form in a reactive root, disposed afterwards. */
const withForm = async (onSubmit: (user: NewUser) => unknown, use: (form: Form<typeof NewUser>) => Promise<void>) => {
  const make = () => createForm({ schema: NewUser, initial, onSubmit })
  let dispose = () => {}
  const form = createRoot((done) => {
    dispose = done
    return make()
  })
  try {
    await use(form)
  } finally {
    dispose()
  }
}

describe("createForm", () => {
  it("shows a field's error only once it was left or a submit was tried", async () => {
    await withForm(
      () => undefined,
      async (form) => {
        form.field("email").onValueChange("not an email")
        expect(form.errors().email).toBe("Invalid email address")
        expect(form.field("email").errorText).toBeUndefined()
        form.field("email").onBlur()
        expect(form.field("email").errorText).toBe("Invalid email address")
        expect(form.field("name").errorText).toBeUndefined()
        await form.submit()
        expect(form.field("name").errorText).toBe("Required")
      },
    )
  })

  it("submits the decoded value, an instance of the Schema's class", async () => {
    const sent: Array<NewUser> = []
    await withForm(
      (user) => {
        sent.push(user)
      },
      async (form) => {
        form.set("email", "ada@example.com")
        form.set("name", "Ada")
        form.set("roles", ["editor"])
        expect(form.errors()).toEqual({})
        expect(form.valid()).toBe(true)
        await form.submit()
        expect(sent).toHaveLength(1)
        expect(sent[0]).toBeInstanceOf(NewUser)
        expect(sent[0]).toMatchObject({ email: "ada@example.com", name: "Ada", roles: ["editor"] })
      },
    )
  })

  it("does not submit an invalid form", async () => {
    let calls = 0
    await withForm(
      () => {
        calls++
      },
      async (form) => {
        await form.submit()
        expect(calls).toBe(0)
      },
    )
  })

  it("keeps what the API refused as the form's error, and clears it on the next change", async () => {
    await withForm(
      () => Promise.reject(new Error("A user with email ada@example.com already exists")),
      async (form) => {
        form.set("email", "ada@example.com")
        form.set("name", "Ada")
        await form.submit()
        expect(form.error()).toBe("A user with email ada@example.com already exists")
        expect(form.submitting()).toBe(false)
        form.set("name", "Ada L.")
        expect(form.error()).toBeUndefined()
      },
    )
  })

  it("resets values and what was shown", async () => {
    await withForm(
      () => undefined,
      async (form) => {
        form.set("name", "Ada")
        await form.submit()
        form.reset()
        expect(form.values.name).toBe("")
        expect(form.field("email").errorText).toBeUndefined()
      },
    )
  })
})
