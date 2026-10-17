import type { EventProperties } from "@tiledev/sdk-analytics-core";
import type { MetaAnalyticsOptions } from "./types";

/**
 * The client contract both platforms implement. Metro resolves `./client` to `client.native.ts` in a
 * React Native bundle and to this file on web — so the Facebook SDK is never imported into a web build.
 */
export interface MetaClient {
  readonly isNoop: boolean;
  init(options: MetaAnalyticsOptions): Promise<void>;
  logEvent(name: string, valueToSum?: number, params?: EventProperties): void;
  logPurchase(amount: number, currency: string, params?: EventProperties): void;
  setUserData(traits?: EventProperties): void;
  clearUserData(): void;
}

/** Web / unsupported platforms: a no-op, so a shared bundle imports nothing native. */
class WebMetaClient implements MetaClient {
  readonly isNoop = true;
  async init(_options: MetaAnalyticsOptions): Promise<void> {}
  logEvent(_name: string, _valueToSum?: number, _params?: EventProperties): void {}
  logPurchase(_amount: number, _currency: string, _params?: EventProperties): void {}
  setUserData(_traits?: EventProperties): void {}
  clearUserData(): void {}
}

export const client: MetaClient = new WebMetaClient();
