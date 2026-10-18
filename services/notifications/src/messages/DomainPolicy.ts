/**
 * Which external e-mail addresses may receive messages (`MAIL_ALLOWED_DOMAINS`):
 *
 * - empty: none (only Mosaik users, via `To.user`)
 * - `*`: any address
 * - `example.com,*.partner.com`: exact domains, and subdomains with `*.`
 */
export interface DomainPolicy {
  readonly allows: (address: string) => boolean
  /** For error messages and logs. */
  readonly description: string
}

const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase()

export const DomainPolicy = {
  parse: (raw: string): DomainPolicy => {
    const entries = raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0)

    if (entries.includes("*")) return { allows: () => true, description: "any domain" }
    if (entries.length === 0) return { allows: () => false, description: "no external domains" }

    const exact = new Set(entries.filter((entry) => !entry.startsWith("*.")))
    const suffixes = entries.filter((entry) => entry.startsWith("*.")).map((entry) => entry.slice(1))
    return {
      allows: (address) => {
        const domain = domainOf(address)
        return exact.has(domain) || suffixes.some((suffix) => domain.endsWith(suffix))
      },
      description: entries.join(", "),
    }
  },
}
