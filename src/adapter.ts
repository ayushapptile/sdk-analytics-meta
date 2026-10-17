import type { AnalyticsAdapter, EventProperties } from "@tiledev/sdk-analytics-core";
import { client } from "./client";
import { toMetaEvent } from "./transformers";
import type { MetaAnalyticsOptions } from "./types";

/**
 * Meta (Facebook) App Events adapter — `name: 'meta'`.
 *
 * Reports the catalogue's canonical e-commerce events (`DefaultEvents`) to Meta as Facebook App Events
 * via `react-native-fbsdk-next`, which is what Meta's ad platform uses for install/purchase attribution
 * and campaign optimisation. It is a **measurement** integration, not ad buying.
 *
 * Register it alongside the other adapters in the theme's `AnalyticsService`; it no-ops on web and when
 * the native Facebook SDK is absent. No secrets are baked — App Id / Client Token come via `options`
 * (or the native build, wired by this package's Expo config plugin).
 */
export function createMetaAnalyticsAdapter(options: MetaAnalyticsOptions = {}): AnalyticsAdapter {
  /* Opt-in tracing, for verifying the integration end to end. Prints every event the adapter receives
     and what it maps to (or that it was skipped), so a dev can watch the Metro console as they tap
     through the app. Silent unless `options.debug` is set. */
  const trace = options.debug
    ? (...args: unknown[]) => console.log("[meta]", ...args)
    : () => {};

  return {
    name: "meta",

    async init() {
      await client.init(options);
      trace("init", { appId: options.appId ? "set" : "native", native: !client.isNoop });
    },

    /* Meta has no "user id"; advanced matching is hashed PII, which FBSDK's setUserData does on-device. */
    identify(_userId: string, traits?: EventProperties) {
      client.setUserData(traits);
    },

    setUserProperties(props?: EventProperties) {
      client.setUserData(props);
    },

    track(event: string, properties?: EventProperties) {
      if (!event) return;
      const mapped = toMetaEvent(event, properties ?? {});
      if (!mapped) {
        trace("skip", event, "(no Meta mapping)");
        return;
      }
      if (mapped.kind === "purchase") {
        trace("track", event, "→ Purchase", { amount: mapped.amount, currency: mapped.currency });
        client.logPurchase(mapped.amount, mapped.currency, mapped.params);
      } else {
        trace("track", event, "→", mapped.name, mapped.params);
        client.logEvent(mapped.name, mapped.valueToSum, mapped.params);
      }
    },

    screen(name: string) {
      // A screen view is Meta's ViewedContent.
      trace("screen", name, "→ fb_mobile_content_view");
      client.logEvent("fb_mobile_content_view", undefined, {
        fb_content_type: "page",
        fb_content_id: name,
      });
    },

    reset() {
      client.clearUserData();
    },
  };
}
