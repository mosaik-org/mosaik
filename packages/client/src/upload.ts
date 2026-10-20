export interface UploadOptions {
  /** Called as the file goes out, with the share sent so far (0 to 1). */
  readonly onProgress?: (sent: number) => void
  /** The multipart field the API reads the file from; `file` by default. */
  readonly field?: string
  /** Other fields of the payload, sent before the file. */
  readonly fields?: Readonly<Record<string, string>>
  readonly method?: "POST" | "PUT"
  readonly signal?: AbortSignal
}

/**
 * Sends a file to an app's API as `multipart/form-data` (an endpoint with an `asMultipart`
 * payload), reporting progress, which `fetch` cannot. Resolves with the response's JSON (or
 * `undefined` when it has none); rejects with the API's error as it answered (its `_tag`, for
 * `errorTag` and `errorMessage`), or an `Error` when the request did not get through.
 *
 * @example
 * await uploadFile(`/api/sales/orders/${id}/attachments`, file, { onProgress: setProgress })
 */
export const uploadFile = (url: string, file: Blob, options: UploadOptions = {}): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const form = new FormData()
    for (const [name, value] of Object.entries(options.fields ?? {})) form.append(name, value)
    form.append(options.field ?? "file", file)

    const request = new XMLHttpRequest()
    request.open(options.method ?? "POST", url)
    request.responseType = "text"
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total)
    }
    request.onload = () => {
      const body = request.responseText === "" ? undefined : parse(request.responseText)
      if (request.status >= 200 && request.status < 300) {
        options.onProgress?.(1)
        resolve(body)
      } else {
        reject(body ?? new Error(`Upload failed (${request.status})`))
      }
    }
    request.onerror = () => reject(new Error("The upload did not get through"))
    request.onabort = () => reject(new DOMException("The upload was cancelled", "AbortError"))
    options.signal?.addEventListener("abort", () => request.abort(), { once: true })
    request.send(form)
  })

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return new Error(text.slice(0, 200))
  }
}
