import { randomSessionId, Telemetry } from "@/agent/telemetry";
import type { UrlOptions } from "@/agent/url-options";
import { desktopBridge } from "@/app/platform";

/**
 * The app's telemetry. The release build (pnpm build) never POSTs, and no address turns that on:
 * in the desktop shell it goes to the preload's writer (jsonl under `<userData>/telemetry/`), on
 * the web nowhere. Otherwise dev (pnpm dev) and the phone build (VITE_PHONE=1) log by default; a plain production
 * build only with telemetry=1; telemetry=0 always turns it off. A failed send is counted and
 * logged, never thrown: a dropped connection must not crash the playtest it observes.
 */
export function createTelemetry(options: UrlOptions): {
  telemetry: Telemetry;
  failures: () => number;
} {
  if (__RELEASE__) {
    const desktop = desktopBridge();
    const sink = desktop === null ? () => {} : (body: string) => desktop.telemetry(body);
    return {
      telemetry: new Telemetry(randomSessionId(), () => performance.now(), sink),
      failures: () => 0,
    };
  }
  const on = options.telemetry ?? (import.meta.env.DEV || import.meta.env.VITE_PHONE === "1");
  let failures = 0;
  const telemetry = new Telemetry(
    randomSessionId(),
    () => performance.now(),
    (body, keepalive) => {
      if (!on) return;
      fetch("/__telemetry", {
        method: "POST",
        body,
        keepalive,
        headers: { "content-type": "text/plain" },
      })
        .then((res) => {
          if (res.ok) return;
          failures += 1;
          console.warn(`telemetry: /__telemetry responded ${res.status}`);
        })
        .catch((err: unknown) => {
          failures += 1;
          console.warn("telemetry: send failed", err);
        });
    },
  );
  return { telemetry, failures: () => failures };
}
