import type { EventProperties } from "@tiledev/sdk-analytics-core";

/**
 * Options for `createMetaAnalyticsAdapter`.
 *
 * None are secrets in the usual sense — the App Id and the (public) Client Token ship in the binary,
 * the same way they are written into Info.plist / strings.xml by the Expo config plugin. They are
 * accepted here too so the SDK can also `Settings.initializeSDK()` from JS when a build did not bake
 * them natively; when the plugin wired them, `react-native-fbsdk-next` self-initialises and these can
 * be omitted.
 */
export interface MetaAnalyticsOptions {
  /** Facebook App Id. Omit when the native plist/strings already carry it. */
  appId?: string;
  /** Facebook Client Token (public). Omit when baked natively. */
  clientToken?: string;
  /** Graph API version the SDK reports against. Defaults to `v17.0` (the engine app's value). */
  graphApiVersion?: string;
  /**
   * Whether to enable advertiser tracking. On iOS this must respect App Tracking Transparency — if the
   * host app resolves ATT (e.g. via `expo-tracking-transparency`), pass `getTrackingAuthorized` and the
   * adapter flips advertiser tracking to match. When neither is given, advertiser tracking is disabled
   * on `init` — the privacy-safe default.
   */
  enableAdvertiserTracking?: boolean;
  /**
   * Resolves the current iOS ATT authorisation. Called on `init`; `true` enables advertiser tracking,
   * `false` disables it. Lets the host own the ATT prompt (the app already ships
   * `expo-tracking-transparency`) while the adapter only reads the result.
   */
  getTrackingAuthorized?: () => boolean | Promise<boolean>;
  /**
   * Traces every event the adapter receives and the Meta event it maps to (or that it was skipped) to
   * `console.log`, for verifying delivery against Meta's Events Manager. Off by default; does not change
   * what is sent.
   */
  debug?: boolean;
}

/** What a transformer produces: either a dedicated purchase, a valued event, or a plain event. */
export type MetaEvent =
  | { kind: "purchase"; amount: number; currency: string; params: EventProperties }
  | { kind: "event"; name: string; valueToSum?: number; params: EventProperties };
