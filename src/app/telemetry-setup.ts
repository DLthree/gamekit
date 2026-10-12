import { randomSessionId, Telemetry } from "@/agent/telemetry";
import type { UrlOptions } from "@/flow/url";

/**
 * The app's telemetry. Dev (pnpm dev) and the phone build (VITE_PHONE=1) log by default;
 * production only with telemetry=1; telemetry=0 always turns it off. A failed send is counted
 * and logged, never thrown: a dropped connection must not crash the playtest it observes.
 */
export function createTelemetry(options: UrlOptions): {
  telemetry: Telemetry;
  failures: () => number;
} {
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
