import "~/index.css";

import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { act, render } from "../../../test/render";

vi.mock("~/hooks/useSettings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/hooks/useSettings")>()),
  useEnvironmentIdentificationMode: () => "none",
  useClientSettings: () => false,
}));
vi.mock("../SidebarStageBackdrop", () => ({
  StageBackdropButtonArt: () => null,
  useSidebarStageBackdropVariant: () => null,
}));

import { ComposerFooterPrimaryActions } from "./ComposerFooterControls";

const snapshot: ContextWindowSnapshot = {
  usedTokens: 120_000,
  maxTokens: 200_000,
  totalProcessedTokens: 1_250_000,
  inputTokens: null,
  cachedInputTokens: null,
  outputTokens: null,
  reasoningOutputTokens: null,
  lastUsedTokens: null,
  lastInputTokens: null,
  lastCachedInputTokens: null,
  lastOutputTokens: null,
  lastReasoningOutputTokens: null,
  toolUses: null,
  durationMs: null,
  compactsAutomatically: true,
  autoCompactThreshold: 155_000,
  cost: { amount: 1.5, currency: "USD" },
  remainingTokens: 80_000,
  usedPercentage: 60,
  remainingPercentage: 40,
  updatedAt: "2026-11-21T12:00:00.000Z",
};

function props(
  overrides: Partial<ComponentProps<typeof ComposerFooterPrimaryActions>> = {},
): ComponentProps<typeof ComposerFooterPrimaryActions> {
  return {
    compact: false,
    canOperateThread: true,
    isPreparingWorktree: false,
    pendingAction: null,
    isRunning: false,
    canInterrupt: false,
    runId: null,
    followUpBehavior: "queue",
    canSteer: false,
    alternateShortcutLabel: null,
    isSendBusy: false,
    sendDisabledReason: null,
    isEnvironmentUnavailable: false,
    hasSendableContent: true,
    canResume: false,
    isEditingQueuedMessage: false,
    onSubmitMessage: vi.fn(),
    onResume: vi.fn(),
    onPreviousPendingQuestion: vi.fn(),
    onInterrupt: vi.fn(),
    compactBeforeSendTokens: null,
    hideCompactToggle: false,
    keepFullHistory: false,
    onToggleKeepFullHistory: vi.fn(),
    activeContextWindow: snapshot,
    providerReportsContextWindow: true,
    startedThreadDetailLoading: false,
    dictationTakesFooter: false,
    activeThreadModelDisplayName: "Claude Opus 5.5",
    onCompactContext: vi.fn(),
    compactDisabledReason: null,
    noProviderAvailable: false,
    ...overrides,
  };
}

function view(
  overrides: Partial<ComponentProps<typeof ComposerFooterPrimaryActions>> = {},
  justifyContent: "flex-start" | "flex-end" = "flex-end",
) {
  return (
    <form
      style={{ display: "flex", justifyContent, alignItems: "center", width: "480px" }}
      onSubmit={(event) => event.preventDefault()}
    >
      <ComposerFooterPrimaryActions {...props(overrides)} />
    </form>
  );
}

it("shows the ring next to the send button and its card on hover", async () => {
  const onCompactContext = vi.fn();
  await using screen = await render(view({ onCompactContext }));
  const ring = screen.getByRole("button", { name: "Context window 60% used" });
  await expect.element(ring).toBeVisible();

  await userEvent.hover(ring);
  await expect.element(page.getByText("120k/200k")).toBeVisible();
  await expect.element(page.getByText("Total processed")).toBeVisible();
  await expect.element(page.getByText("1.3m")).toBeVisible();
  await expect.element(page.getByText("USD 1.50")).toBeVisible();
  await expect
    .element(page.getByText("Compacts automatically at about 155,000 tokens."))
    .toBeVisible();
  await expect
    .element(page.getByRole("progressbar", { name: "Context window usage" }))
    .toHaveAttribute("aria-valuenow", "60");

  const compact = page.getByRole("button", { name: "Compact context" });
  await expect.element(compact).toBeEnabled();
  await act(() => (compact.element() as HTMLButtonElement).click());
  expect(onCompactContext).toHaveBeenCalledTimes(1);
});

it("disables Compact with the thread's reason", async () => {
  await using screen = await render(
    view({ compactDisabledReason: "Choose a project before compacting" }),
  );
  await userEvent.hover(screen.getByRole("button", { name: "Context window 60% used" }));
  await expect.element(page.getByRole("button", { name: "Compact context" })).toBeDisabled();
  await expect.element(page.getByText("Choose a project before compacting")).toBeVisible();
});

it("disables Compact with a reason while a request is in flight", async () => {
  const onCompactContext = vi.fn();
  await using screen = await render(view({ isSendBusy: true, onCompactContext }));
  await userEvent.hover(screen.getByRole("button", { name: "Context window 60% used" }));
  await expect.element(page.getByRole("button", { name: "Compact context" })).toBeDisabled();
  await expect.element(page.getByText("Compacting is unavailable right now")).toBeVisible();
});

it("shows used tokens alone when the maximum is unknown", async () => {
  await using screen = await render(
    view({
      activeContextWindow: {
        ...snapshot,
        maxTokens: null,
        usedPercentage: null,
        remainingTokens: null,
        remainingPercentage: null,
      },
    }),
  );
  await expect
    .element(screen.getByRole("button", { name: "Context window 120k tokens used" }))
    .toBeVisible();
});

it("shows no ring for a provider that does not report a context window", async () => {
  await using screen = await render(view({ providerReportsContextWindow: false }));
  await expect.element(screen.getByRole("button", { name: "Submit message" })).toBeVisible();
  expect(screen.getByRole("button", { name: /Context window/ }).query()).toBeNull();
  expect(screen.container.querySelector("[data-context-window-meter]")).toBeNull();
});

it("shows the ring for a provider that does not set the flag", async () => {
  await using screen = await render(view({ providerReportsContextWindow: undefined }));
  await expect
    .element(screen.getByRole("button", { name: "Context window 60% used" }))
    .toBeVisible();
});

it("keeps the same ring when the catalog arrives without the flag", async () => {
  await using screen = await render(view({ providerReportsContextWindow: null }));
  const ring = screen.getByRole("button", { name: "Context window 60% used" });
  await expect.element(ring).toBeVisible();
  const element = ring.element();
  await screen.rerender(view({ providerReportsContextWindow: undefined }));
  expect(ring.element()).toBe(element);
});

it("hides the ring and its slot while dictation takes the footer", async () => {
  await using screen = await render(view({ dictationTakesFooter: true }));
  await expect.element(screen.getByRole("button", { name: "Submit message" })).toBeVisible();
  expect(screen.container.querySelector("[data-context-window-meter]")).toBeNull();
  await screen.rerender(
    view({
      dictationTakesFooter: true,
      activeContextWindow: null,
      startedThreadDetailLoading: true,
    }),
  );
  expect(screen.container.querySelector("[data-context-window-meter-slot]")).toBeNull();
});

it("leaves no gap on a new thread without a snapshot", async () => {
  await using screen = await render(view({ activeContextWindow: null }));
  await expect.element(screen.getByRole("button", { name: "Submit message" })).toBeVisible();
  expect(screen.container.querySelector("[data-context-window-meter-slot]")).toBeNull();
});

it("keeps the send button in place when a loading thread's snapshot arrives", async () => {
  // Left-aligned, so anything that appears before the send button would push it right.
  await using screen = await render(
    view({ activeContextWindow: null, startedThreadDetailLoading: true }, "flex-start"),
  );
  const send = screen.getByRole("button", { name: "Submit message" });
  await expect.element(send).toBeVisible();
  expect(screen.getByRole("button", { name: /Context window/ }).query()).toBeNull();
  const before = send.element().getBoundingClientRect().left;

  await screen.rerender(view({}, "flex-start"));
  await expect
    .element(screen.getByRole("button", { name: "Context window 60% used" }))
    .toBeVisible();
  expect(send.element().getBoundingClientRect().left).toBe(before);
});

it("keeps the ring when only the compact toggle is hidden", async () => {
  await using screen = await render(view({ hideCompactToggle: true }));
  await expect
    .element(screen.getByRole("button", { name: "Context window 60% used" }))
    .toBeVisible();
});
