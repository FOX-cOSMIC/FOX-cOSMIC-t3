import * as Schema from "effect/Schema";

/** Sample rate every client sends. The server never resamples or decodes containers. */
export const DICTATION_SAMPLE_RATE = 16_000;

/**
 * Kept for the speech runtime that read aloud loads (`apps/server/src/dictation/`).
 * Dictation itself follows upstream's speech feature, so only these types remain.
 */
export const DictationModelId = Schema.Literals(["parakeet-v3", "whisper-turbo", "moonshine-base"]);
export type DictationModelId = typeof DictationModelId.Type;

/** Install state of one downloadable artifact: the native runtime or a model. */
export const DictationInstallState = Schema.Union([
  Schema.TaggedStruct("not-installed", {}),
  Schema.TaggedStruct("installing", {
    receivedBytes: Schema.Number,
    totalBytes: Schema.Number,
  }),
  Schema.TaggedStruct("installed", { sizeBytes: Schema.Number }),
  Schema.TaggedStruct("failed", { message: Schema.String }),
]);
export type DictationInstallState = typeof DictationInstallState.Type;

export const DictationErrorReason = Schema.Literals([
  "unsupported-platform",
  "disabled",
  "not-installed",
  "install-failed",
  "load-failed",
  "unknown-session",
  "too-long",
  "transcription-failed",
]);
export type DictationErrorReason = typeof DictationErrorReason.Type;

export class DictationError extends Schema.TaggedError<DictationError>()("DictationError", {
  reason: DictationErrorReason,
  message: Schema.String,
  cause: Schema.optionalKey(Schema.Defect()),
}) {}
