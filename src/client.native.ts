import { AppEventsLogger, Settings } from "react-native-fbsdk-next";
import type { EventProperties } from "@tiledev/sdk-analytics-core";
import type { MetaClient } from "./client";
import type { MetaAnalyticsOptions } from "./types";

/** FBSDK event parameters are `string | number` only. */
type FbParams = Record<string, string | number>;

const toFbParams = (params?: EventProperties): FbParams => {
  const out: FbParams = {};
  if (!params) return out;
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" || typeof v === "number") out[k] = v;
    else if (v != null) out[k] = String(v);
  }
  return out;
};

/**
 * React Native client — wraps `react-native-fbsdk-next`. App Id + Client Token are usually baked into
 * the native project by the Expo config plugin (Info.plist / strings.xml), in which case the SDK
 * self-initialises; when passed via options the SDK is initialised from JS instead.
 */
class NativeMetaClient implements MetaClient {
  readonly isNoop = false;
  private ready = false;

  async init(options: MetaAnalyticsOptions): Promise<void> {
    try {
      Settings.setGraphAPIVersion(options.graphApiVersion ?? "v17.0");

      /* iOS App Tracking Transparency: advertiser tracking must match the user's ATT choice. The host
         owns the prompt (the app ships expo-tracking-transparency) and hands us the result. */
      let authorized = options.enableAdvertiserTracking ?? false;
      if (options.getTrackingAuthorized) {
        try {
          authorized = await options.getTrackingAuthorized();
        } catch {
          authorized = false;
        }
      }
      await Settings.setAdvertiserTrackingEnabled(authorized);

      // Only needed when the native build did not bake the creds; harmless when it did.
      if (options.appId) Settings.setAppID(options.appId);
      if (options.clientToken) Settings.setClientToken(options.clientToken);
      Settings.initializeSDK();

      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  logEvent(name: string, valueToSum?: number, params?: EventProperties): void {
    if (!this.ready) return;
    try {
      if (typeof valueToSum === "number") AppEventsLogger.logEvent(name, valueToSum, toFbParams(params));
      else AppEventsLogger.logEvent(name, toFbParams(params));
    } catch {
      /* Analytics must never throw into the app. */
    }
  }

  logPurchase(amount: number, currency: string, params?: EventProperties): void {
    if (!this.ready) return;
    try {
      AppEventsLogger.logPurchase(amount, currency, toFbParams(params));
    } catch {
      /* ignore */
    }
  }

  setUserData(traits?: EventProperties): void {
    if (!this.ready || !traits) return;
    try {
      AppEventsLogger.setUserData({
        email: traits.email as string | undefined,
        firstName: (traits.firstName ?? traits.first_name) as string | undefined,
        lastName: (traits.lastName ?? traits.last_name) as string | undefined,
        phone: (traits.phone ?? traits.phoneNumber) as string | undefined,
      });
    } catch {
      /* ignore */
    }
  }

  clearUserData(): void {
    if (!this.ready) return;
    try {
      /* react-native-fbsdk-next (13.x) exposes no `clearUserData`: clearing the advanced-matching PII
         is `setUserData` with every field empty, and `clearUserID` drops any id set via `setUserID`. */
      AppEventsLogger.setUserData({});
      AppEventsLogger.clearUserID();
    } catch {
      /* ignore */
    }
  }
}

export const client: MetaClient = new NativeMetaClient();
