import { createSignal, type JSX, splitProps } from "solid-js"
import type { FileUploadVariantProps } from "../../styled-system/recipes"
import * as FileUpload from "../components/file-upload"
import { UploadIcon } from "../components/icons"
import { FIELD_PROPS, type FieldProps, FormField } from "./form-field"

export interface FileUploadFieldProps extends FieldProps, FileUploadVariantProps {
  /** Accepted types: MIME types (`application/pdf`, `image/*`) or `{ "application/pdf": [".pdf"] }`. */
  readonly accept?: string | ReadonlyArray<string> | Record<string, string[]>
  /** How many files it takes; 1 by default. */
  readonly maxFiles?: number
  /** The largest file it takes, in bytes. */
  readonly maxFileSize?: number
  /** The chosen files, when the form keeps them (set `[]` to clear it after sending them). */
  readonly files?: ReadonlyArray<File>
  readonly onFilesChange?: (files: ReadonlyArray<File>) => void
  /** Shown in the drop area. */
  readonly placeholder?: JSX.Element
}

const megabytes = (bytes: number) => `${Number((bytes / 1024 / 1024).toFixed(1))} MB`

/** Why files were not taken, in words: the first reason of each. */
const rejection = (
  props: Pick<FileUploadFieldProps, "maxFiles" | "maxFileSize">,
  rejected: ReadonlyArray<{ readonly file: File; readonly errors: ReadonlyArray<string> }>,
): string | undefined => {
  const [first] = rejected
  if (first === undefined) return undefined
  const reason = (error: string | undefined) => {
    switch (error) {
      case "FILE_TOO_LARGE":
        return props.maxFileSize === undefined ? "is too large" : `is larger than ${megabytes(props.maxFileSize)}`
      case "FILE_INVALID_TYPE":
        return "is not a type this field takes"
      case "TOO_MANY_FILES":
        return `is one too many (${props.maxFiles ?? 1} at most)`
      default:
        return "was not taken"
    }
  }
  const more = rejected.length > 1 ? ` (and ${rejected.length - 1} more)` : ""
  return `${first.file.name} ${reason(first.errors[0])}${more}`
}

/**
 * Files to send: a drop area to drop them on or click to choose them, and the chosen ones listed, each with
 * its size and a way to take it out. Files over `maxFileSize`, of other types or one too many are
 * refused at once, with the reason as the field's error.
 */
export const FileUploadField = (props: FileUploadFieldProps) => {
  const [field, local, rest] = splitProps(props, FIELD_PROPS, [
    "accept",
    "maxFiles",
    "maxFileSize",
    "files",
    "onFilesChange",
    "placeholder",
    "size",
  ])
  const [refused, setRefused] = createSignal<string>()
  const several = () => (local.maxFiles ?? 1) > 1
  return (
    <FormField
      {...field}
      errorText={field.errorText ?? refused()}
      invalid={field.invalid === true || refused() !== undefined}
    >
      <FileUpload.Root
        accept={local.accept as FileUpload.RootProps["accept"]}
        maxFiles={local.maxFiles ?? 1}
        maxFileSize={local.maxFileSize}
        size={local.size ?? "sm"}
        acceptedFiles={local.files === undefined ? undefined : [...local.files]}
        onFileChange={(details) => {
          setRefused(rejection(local, details.rejectedFiles))
          local.onFilesChange?.(details.acceptedFiles)
        }}
        {...rest}
      >
        {/* The drop area is a button itself (it opens the file picker): nothing interactive inside. */}
        <FileUpload.Dropzone>
          <UploadIcon />
          <span>
            {local.placeholder ??
              (several() ? "Drop files here, or click to choose them" : "Drop a file here, or click to choose one")}
          </span>
        </FileUpload.Dropzone>
        <FileUpload.HiddenInput />
        <FileUpload.List clearable showSize />
      </FileUpload.Root>
    </FormField>
  )
}
