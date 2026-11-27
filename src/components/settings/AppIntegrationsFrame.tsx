"use client";

import { useEffect, useState } from "react";
import { Callout } from "@/components/settings/SettingsKit";
import { cn } from "@/utils/cn";

// The hub lays its app cards out at up to 420px each, so two side by side need
// a frame about 902px wide (cards, gap, the hub's padding and scrollbar). The
// settings section's padding left it 847px on a laptop and stacked every card,
// so the frame runs into that padding, edge to edge of the section.
const FRAME_SIZE = "-mx-4 h-[680px] w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)]";

async function fetchWidgetUrl(): Promise<string> {
  const res = await fetch("/api/settings/fastn/token", { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as { widgetUrl?: string; error?: string };
  if (!res.ok || !body.widgetUrl) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.widgetUrl;
}

/**
 * The Fastn integrations widget for the caller's organization, in an iframe.
 * Connecting an app, turning an integration on and seeing its runs all happen
 * inside it, against this organization's own accounts. The browser only ever
 * holds a short-lived token for this organization.
 */
export function AppIntegrationsFrame() {
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchWidgetUrl().then(
      (url) => !cancelled && setWidgetUrl(url),
      (e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Could not open app integrations"),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setError(null);
    setWidgetUrl(null);
    setAttempt((n) => n + 1);
  };

  if (error) {
    return (
      <Callout
        tone="error"
        title="App integrations could not load"
        action={
          <button type="button" onClick={retry} className="text-label-sm text-primary-base">
            Try again
          </button>
        }
      >
        {error}
      </Callout>
    );
  }
  if (!widgetUrl) return <div className={cn(FRAME_SIZE, "animate-pulse rounded-xl bg-bg-weak-50")} />;
  return (
    <iframe
      title="App integrations"
      src={widgetUrl}
      className={cn(FRAME_SIZE, "rounded-xl border border-stroke-soft-200")}
      allow="clipboard-write"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
