import { describe, expect, it } from "@effect/vitest"
import { demultiplex } from "./Docker"
import { formatImageRef, parseImageRef } from "./imageRef"
import { extractFile } from "./tar"

describe("parseImageRef", () => {
  it("parses registries, tags and digests", () => {
    expect(parseImageRef("registry.example.com/team/crm:1.4.2")).toEqual({
      registry: "registry.example.com",
      name: "registry.example.com/team/crm",
      tag: "1.4.2",
      digest: null,
    })
    expect(parseImageRef("localhost:5000/crm")).toMatchObject({ registry: "localhost:5000", tag: "latest" })
    expect(parseImageRef("nginx")).toMatchObject({ registry: null, name: "nginx", tag: "latest" })
    expect(parseImageRef("team/app:2")).toMatchObject({ registry: null, name: "team/app", tag: "2" })
    expect(parseImageRef("ghcr.io/o/app@sha256:abc")).toMatchObject({
      registry: "ghcr.io",
      tag: null,
      digest: "sha256:abc",
    })
    expect(formatImageRef(parseImageRef("localhost:5000/crm:1.0.0"))).toBe("localhost:5000/crm:1.0.0")
    expect(() => parseImageRef("bad ref")).toThrow()
  })
})

const tarEntry = (name: string, content: string) => {
  const header = new Uint8Array(512)
  const encoder = new TextEncoder()
  header.set(encoder.encode(name), 0)
  header.set(encoder.encode(`${content.length.toString(8).padStart(11, "0")}\0`), 124)
  header.set(encoder.encode("0"), 156)
  const body = new Uint8Array(Math.ceil(content.length / 512) * 512)
  body.set(encoder.encode(content))
  return [header, body]
}

describe("extractFile", () => {
  it("finds a file in a tar archive", () => {
    const parts = [
      ...tarEntry("other.txt", "x".repeat(600)),
      ...tarEntry("mosaik-app.json", '{"id":"crm"}'),
      new Uint8Array(1024),
    ]
    const archive = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
    let offset = 0
    for (const part of parts) {
      archive.set(part, offset)
      offset += part.length
    }
    expect(new TextDecoder().decode(extractFile(archive, "mosaik-app.json"))).toBe('{"id":"crm"}')
    expect(extractFile(archive, "missing.json")).toBeUndefined()
  })
})

describe("demultiplex", () => {
  it("joins the frames of non-TTY container logs", () => {
    const frame = (stream: number, text: string) => {
      const payload = new TextEncoder().encode(text)
      const header = new Uint8Array(8)
      header[0] = stream
      new DataView(header.buffer).setUint32(4, payload.length)
      return [...header, ...payload]
    }
    expect(demultiplex(new Uint8Array([...frame(1, "out\n"), ...frame(2, "err\n")]))).toBe("out\nerr\n")
  })
})
