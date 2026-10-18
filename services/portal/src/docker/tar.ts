const BLOCK = 512

const field = (header: Uint8Array, offset: number, length: number) =>
  new TextDecoder().decode(header.subarray(offset, offset + length)).replace(/\0.*$/s, "")

/** The contents of the first regular file in a tar archive whose name ends with `fileName`. */
export const extractFile = (archive: Uint8Array, fileName: string): Uint8Array | undefined => {
  let offset = 0
  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK)
    const name = field(header, 0, 100)
    if (name.length === 0) return undefined
    const prefix = field(header, 345, 155)
    const size = Number.parseInt(field(header, 124, 12).trim() || "0", 8)
    const type = field(header, 156, 1)
    const fullName = prefix.length > 0 ? `${prefix}/${name}` : name
    const start = offset + BLOCK
    if ((type === "0" || type === "") && (fullName === fileName || fullName.endsWith(`/${fileName}`))) {
      return archive.subarray(start, start + size)
    }
    offset = start + Math.ceil(size / BLOCK) * BLOCK
  }
  return undefined
}
