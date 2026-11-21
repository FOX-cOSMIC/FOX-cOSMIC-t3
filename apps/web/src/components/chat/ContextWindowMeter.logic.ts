import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import type { ModelSelection, ProviderInstanceId } from "@t3tools/contracts";
import { msg } from "gt-react";

import { getActiveLocale, m, type MessageResolver } from "../../i18n/messages";
import { formatContextWindowCompactionMessage } from "./compaction.logic";
import { getDisplayModelName, type ModelEsque } from "./providerIconUtils";

export function resolveContextWindowModelDisplayName(
  selection: ModelSelection | null | undefined,
  modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>,
): string | null {
  if (!selection) {
    return null;
  }

  const selectedModel = modelOptionsByInstance
    .get(selection.instanceId)
    ?.find((model) => model.slug === selection.model);

  return selectedModel ? getDisplayModelName(selectedModel) : selection.model;
}

/** The ring's card names the model when the provider gives no threshold. */
export function formatContextWindowMeterCompactionMessage(
  modelDisplayName: string | null | undefined,
  autoCompactThreshold?: number | null,
  resolve: MessageResolver = m,
  locale: string = getActiveLocale(),
): string {
  const hasThreshold = typeof autoCompactThreshold === "number" && autoCompactThreshold > 0;
  if (hasThreshold || !modelDisplayName) {
    return formatContextWindowCompactionMessage(autoCompactThreshold, resolve, locale);
  }
  return resolve(
    msg("Context for {model} compacts automatically when needed.", { model: modelDisplayName }),
  );
}

export function formatContextWindowPercentage(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  if (value < 10) {
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(value)}%`;
}

export function formatContextWindowCost(cost: {
  readonly amount: number;
  readonly currency: string;
}): string {
  const fractionDigits = Math.abs(cost.amount) > 0 && Math.abs(cost.amount) < 0.01 ? 4 : 2;
  return `${cost.currency} ${cost.amount.toFixed(fractionDigits)}`;
}

/**
 * The selected provider's context-window flag: `null` only while the provider catalog is not
 * known yet; a known catalog without the selected provider counts as a missing flag.
 */
export function resolveProviderReportsContextWindow(input: {
  readonly catalogKnown: boolean;
  readonly providerStatus: { readonly reportsContextWindow?: boolean | undefined } | null;
}): boolean | null | undefined {
  if (input.providerStatus) return input.providerStatus.reportsContextWindow;
  return input.catalogKnown ? undefined : null;
}

/** What sits before the send button: the ring, an empty slot of its size, or nothing. */
export function resolveContextWindowMeterSlot(input: {
  readonly hasSnapshot: boolean;
  /** The selected provider's flag; `null` while the catalog does not list the provider yet. */
  readonly providerReportsContextWindow: boolean | null | undefined;
  readonly startedThreadDetailLoading: boolean;
  readonly footerTakenByDictation: boolean;
}): "ring" | "placeholder" | null {
  if (input.footerTakenByDictation) return null;
  // Only an explicit `false` hides the ring: some providers send usage without setting the flag.
  if (input.hasSnapshot) return input.providerReportsContextWindow === false ? null : "ring";
  // Holds the slot while a started thread loads, so Send does not shift when its snapshot arrives.
  // As before 2026-11-08, an unknown catalog (`null`) holds it too; `false` or a missing flag not.
  const mayReport =
    input.providerReportsContextWindow === true || input.providerReportsContextWindow === null;
  return input.startedThreadDetailLoading && mayReport ? "placeholder" : null;
}

/** A started thread's details are loading from a reachable environment. */
export function isStartedThreadDetailLoading(input: {
  readonly detailLoading: boolean;
  readonly environmentUnavailable: boolean;
  readonly threadStarted: boolean;
}): boolean {
  return input.detailLoading && !input.environmentUnavailable && input.threadStarted;
}

/** Why the ring's Compact button is disabled, or `null` when it is enabled. */
export function resolveContextWindowCompactDisabledReason(
  input: {
    /** ChatView's reason, set whenever the thread itself cannot compact. */
    readonly threadDisabledReason: string | null;
    readonly noProviderAvailable: boolean;
    readonly isSendBusy: boolean;
  },
  resolve: MessageResolver = m,
): string | null {
  if (input.threadDisabledReason !== null) return input.threadDisabledReason;
  return input.noProviderAvailable || input.isSendBusy
    ? resolve(msg("Compacting is unavailable right now"))
    : null;
}

/**
 * The usage the ring shows. Like the resume-compaction offer, it belongs to the current
 * conversation, so neither a pending handoff destination nor a /clear session inherits it.
 */
export function resolveComposerContextWindow(
  snapshot: ContextWindowSnapshot | null,
  pending: { readonly handoffPending: boolean; readonly freshSessionPending: boolean },
): ContextWindowSnapshot | null {
  return pending.handoffPending || pending.freshSessionPending ? null : snapshot;
}
