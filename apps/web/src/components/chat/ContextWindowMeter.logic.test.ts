import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import { ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  formatContextWindowCost,
  formatContextWindowMeterCompactionMessage,
  formatContextWindowPercentage,
  isStartedThreadDetailLoading,
  resolveComposerContextWindow,
  resolveProviderReportsContextWindow,
  resolveContextWindowCompactDisabledReason,
  resolveContextWindowMeterSlot,
  resolveContextWindowModelDisplayName,
} from "./ContextWindowMeter.logic";

describe("resolveContextWindowModelDisplayName", () => {
  it("uses the selected model from the exact provider instance", () => {
    const primaryInstanceId = ProviderInstanceId.make("codex");
    const selectedInstanceId = ProviderInstanceId.make("codex-work");
    const modelOptionsByInstance = new Map([
      [
        primaryInstanceId,
        [{ slug: "gpt-5.6-sol", name: "Primary profile model", shortName: "Primary" }],
      ],
      [selectedInstanceId, [{ slug: "gpt-5.6-sol", name: "GPT-5.6 Sol", shortName: "5.6 Sol" }]],
    ]);

    expect(
      resolveContextWindowModelDisplayName(
        {
          instanceId: selectedInstanceId,
          model: "gpt-5.6-sol",
        },
        modelOptionsByInstance,
      ),
    ).toBe("GPT-5.6 Sol");
  });

  it("falls back to the model slug when the instance does not list it", () => {
    expect(
      resolveContextWindowModelDisplayName(
        { instanceId: ProviderInstanceId.make("codex"), model: "gpt-unknown" },
        new Map(),
      ),
    ).toBe("gpt-unknown");
  });

  it("has no name without a selection", () => {
    expect(resolveContextWindowModelDisplayName(null, new Map())).toBeNull();
  });
});

describe("formatContextWindowMeterCompactionMessage", () => {
  it("names the threshold when the provider reports one", () => {
    expect(formatContextWindowMeterCompactionMessage("Claude Opus", 155_000)).toBe(
      "Compacts automatically at about 155,000 tokens.",
    );
  });

  it("names the model when there is no threshold", () => {
    expect(formatContextWindowMeterCompactionMessage("GPT-5.6 Sol", null)).toBe(
      "Context for GPT-5.6 Sol compacts automatically when needed.",
    );
  });

  it("falls back to the generic message without a model or threshold", () => {
    expect(formatContextWindowMeterCompactionMessage(null, undefined)).toBe(
      "Context compacts automatically when needed.",
    );
  });
});

describe("formatContextWindowCost", () => {
  it("shows two decimals for ordinary amounts", () => {
    expect(formatContextWindowCost({ amount: 1.5, currency: "USD" })).toBe("USD 1.50");
    expect(formatContextWindowCost({ amount: 0, currency: "USD" })).toBe("USD 0.00");
  });

  it("shows four decimals below one cent", () => {
    expect(formatContextWindowCost({ amount: 0.0042, currency: "USD" })).toBe("USD 0.0042");
  });
});

describe("formatContextWindowPercentage", () => {
  it("keeps one decimal below ten percent", () => {
    expect(formatContextWindowPercentage(4.25)).toBe("4.3%");
    expect(formatContextWindowPercentage(4)).toBe("4%");
  });

  it("rounds from ten percent up", () => {
    expect(formatContextWindowPercentage(42.6)).toBe("43%");
  });

  it("has no percentage without a value", () => {
    expect(formatContextWindowPercentage(null)).toBeNull();
    expect(formatContextWindowPercentage(Number.NaN)).toBeNull();
  });
});

describe("resolveContextWindowMeterSlot", () => {
  const shown = {
    hasSnapshot: true,
    providerReportsContextWindow: true,
    startedThreadDetailLoading: false,
    footerTakenByDictation: false,
  } as const;

  it("shows the ring for a snapshot from a provider that reports a context window", () => {
    expect(resolveContextWindowMeterSlot(shown)).toBe("ring");
  });

  it("shows the ring when the provider does not set the flag", () => {
    expect(
      resolveContextWindowMeterSlot({ ...shown, providerReportsContextWindow: undefined }),
    ).toBe("ring");
  });

  it("keeps the ring while the provider catalog is not known yet", () => {
    expect(resolveContextWindowMeterSlot({ ...shown, providerReportsContextWindow: null })).toBe(
      "ring",
    );
  });

  it("hides the ring for a provider that reports no context window", () => {
    expect(
      resolveContextWindowMeterSlot({ ...shown, providerReportsContextWindow: false }),
    ).toBeNull();
  });

  it("hides the ring while dictation takes the footer", () => {
    expect(resolveContextWindowMeterSlot({ ...shown, footerTakenByDictation: true })).toBeNull();
  });

  it("holds the slot while a started thread's details load for a provider that reports", () => {
    expect(
      resolveContextWindowMeterSlot({
        ...shown,
        hasSnapshot: false,
        startedThreadDetailLoading: true,
      }),
    ).toBe("placeholder");
  });

  it("holds the slot while the provider catalog is not known yet", () => {
    expect(
      resolveContextWindowMeterSlot({
        ...shown,
        hasSnapshot: false,
        startedThreadDetailLoading: true,
        providerReportsContextWindow: null,
      }),
    ).toBe("placeholder");
  });

  it("leaves no gap on a new thread or once the details have loaded", () => {
    expect(resolveContextWindowMeterSlot({ ...shown, hasSnapshot: false })).toBeNull();
  });

  it("holds no slot for a provider without the flag, or while dictation takes the footer", () => {
    const loading = { ...shown, hasSnapshot: false, startedThreadDetailLoading: true };
    expect(
      resolveContextWindowMeterSlot({ ...loading, providerReportsContextWindow: undefined }),
    ).toBeNull();
    expect(resolveContextWindowMeterSlot({ ...loading, footerTakenByDictation: true })).toBeNull();
  });
});

describe("resolveContextWindowCompactDisabledReason", () => {
  it("allows compacting when nothing blocks it", () => {
    expect(
      resolveContextWindowCompactDisabledReason({
        threadDisabledReason: null,
        noProviderAvailable: false,
        isSendBusy: false,
      }),
    ).toBeNull();
  });

  it("keeps the thread's own reason", () => {
    expect(
      resolveContextWindowCompactDisabledReason({
        threadDisabledReason: "Choose a project before compacting",
        noProviderAvailable: true,
        isSendBusy: true,
      }),
    ).toBe("Choose a project before compacting");
  });

  it("gives a reason while a send or resume request is in flight", () => {
    expect(
      resolveContextWindowCompactDisabledReason({
        threadDisabledReason: null,
        noProviderAvailable: false,
        isSendBusy: true,
      }),
    ).toBe("Compacting is unavailable right now");
  });

  it("gives a reason when no provider is available", () => {
    expect(
      resolveContextWindowCompactDisabledReason({
        threadDisabledReason: null,
        noProviderAvailable: true,
        isSendBusy: false,
      }),
    ).toBe("Compacting is unavailable right now");
  });
});

describe("resolveComposerContextWindow", () => {
  const snapshot = { usedTokens: 1 } as unknown as ContextWindowSnapshot;

  it("passes the thread's snapshot through", () => {
    expect(
      resolveComposerContextWindow(snapshot, { handoffPending: false, freshSessionPending: false }),
    ).toBe(snapshot);
  });

  it("drops the snapshot while a provider handoff waits for the next send", () => {
    expect(
      resolveComposerContextWindow(snapshot, { handoffPending: true, freshSessionPending: false }),
    ).toBeNull();
  });

  it("drops the snapshot while a session cleared with /clear is pending", () => {
    expect(
      resolveComposerContextWindow(snapshot, { handoffPending: false, freshSessionPending: true }),
    ).toBeNull();
  });
});

describe("isStartedThreadDetailLoading", () => {
  const loading = { detailLoading: true, environmentUnavailable: false, threadStarted: true };

  it("is loading while a started thread's details load from a reachable environment", () => {
    expect(isStartedThreadDetailLoading(loading)).toBe(true);
  });

  it("is not loading while the environment is unreachable", () => {
    expect(isStartedThreadDetailLoading({ ...loading, environmentUnavailable: true })).toBe(false);
  });

  it("is not loading for a thread that has not started or has loaded", () => {
    expect(isStartedThreadDetailLoading({ ...loading, threadStarted: false })).toBe(false);
    expect(isStartedThreadDetailLoading({ ...loading, detailLoading: false })).toBe(false);
  });
});

describe("resolveProviderReportsContextWindow", () => {
  it("is unknown only while the provider catalog is not known", () => {
    expect(resolveProviderReportsContextWindow({ catalogKnown: false, providerStatus: null })).toBe(
      null,
    );
  });

  it("is missing when the known catalog has no selected provider", () => {
    expect(
      resolveProviderReportsContextWindow({ catalogKnown: true, providerStatus: null }),
    ).toBeUndefined();
  });

  it("passes the selected provider's flag through", () => {
    expect(
      resolveProviderReportsContextWindow({
        catalogKnown: true,
        providerStatus: { reportsContextWindow: false },
      }),
    ).toBe(false);
    expect(
      resolveProviderReportsContextWindow({ catalogKnown: true, providerStatus: {} }),
    ).toBeUndefined();
  });
});
