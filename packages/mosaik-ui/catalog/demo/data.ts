/** A coffee roaster's shop, made up: what the demo shows. */

export type OrderStatus = "pending" | "paid" | "shipped" | "refunded" | "cancelled"

export interface Order {
  readonly id: string
  readonly customer: string
  readonly email: string
  readonly status: OrderStatus
  readonly items: number
  /** How much of it is packed and sent, 0–100. */
  readonly fulfilled: number
  readonly amount: number
  readonly placed: string
}

export const ORDERS: ReadonlyArray<Order> = [
  {
    id: "NW-1042",
    customer: "Ada Lovelace",
    email: "ada@analytical.io",
    status: "pending",
    items: 3,
    fulfilled: 0,
    amount: 84.5,
    placed: "Today, 09:41",
  },
  {
    id: "NW-1041",
    customer: "Grace Hopper",
    email: "grace@cobol.dev",
    status: "paid",
    items: 1,
    fulfilled: 40,
    amount: 22,
    placed: "Today, 08:15",
  },
  {
    id: "NW-1040",
    customer: "Alan Turing",
    email: "alan@enigma.uk",
    status: "shipped",
    items: 6,
    fulfilled: 100,
    amount: 213.9,
    placed: "Yesterday",
  },
  {
    id: "NW-1039",
    customer: "Margaret Hamilton",
    email: "margaret@apollo.space",
    status: "paid",
    items: 2,
    fulfilled: 75,
    amount: 47.8,
    placed: "Yesterday",
  },
  {
    id: "NW-1038",
    customer: "Linus Torvalds",
    email: "linus@kernel.org",
    status: "refunded",
    items: 1,
    fulfilled: 100,
    amount: 18.5,
    placed: "Mon",
  },
  {
    id: "NW-1037",
    customer: "Katherine Johnson",
    email: "katherine@nasa.gov",
    status: "shipped",
    items: 4,
    fulfilled: 100,
    amount: 132,
    placed: "Mon",
  },
  {
    id: "NW-1036",
    customer: "Tim Berners-Lee",
    email: "tim@w3.org",
    status: "cancelled",
    items: 2,
    fulfilled: 0,
    amount: 39,
    placed: "Sun",
  },
]

/** How each status reads, and the role it is shown in. */
export const STATUS: Record<OrderStatus, { readonly label: string; readonly palette: string }> = {
  pending: { label: "Pending", palette: "warning" },
  paid: { label: "Paid", palette: "accent" },
  shipped: { label: "Shipped", palette: "success" },
  refunded: { label: "Refunded", palette: "danger" },
  cancelled: { label: "Cancelled", palette: "gray" },
}

export interface Member {
  readonly name: string
  readonly role: string
  readonly location: string
  readonly online: boolean
}

export const TEAM: ReadonlyArray<Member> = [
  { name: "Mira Chen", role: "Owner", location: "Lisbon", online: true },
  { name: "Jordan Pike", role: "Roaster", location: "Porto", online: true },
  { name: "Tomás Ruiz", role: "Support", location: "Madrid", online: false },
]

export const PRODUCTS = ["Ethiopia Guji", "Colombia Huila", "Kenya Nyeri", "House espresso", "Decaf Brazil"]

export const euro = (amount: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount)
