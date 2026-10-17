# @tiledev/sdk-analytics-meta

Meta (Facebook) **App Events** for React Native / Expo apps — a provider adapter for
[`@tiledev/sdk-analytics-core`](https://www.npmjs.com/package/@tiledev/sdk-analytics-core) backed by
`react-native-fbsdk-next`, plus an Expo config plugin that wires the native Facebook SDK.

It reports the catalogue's canonical e-commerce events (`DefaultEvents` — `addToCart`, `purchase`,
`initiateCheckout`, `productView`, `search`, …) to Meta as Facebook conversion events, which Meta's ad
platform uses for **install/purchase attribution and campaign optimisation**. This is a *measurement*
integration (App Events), not ad buying and not the Conversions API.

## Install

```sh
npm i @tiledev/sdk-analytics-meta react-native-fbsdk-next
```

Peers: `@tiledev/sdk-analytics-core`, `react`, `react-native`, and (native only) `react-native-fbsdk-next`.

## 1. Native setup (Expo config plugin)

Add the plugin to `app.json`. It writes the Facebook keys into Info.plist / strings.xml / AndroidManifest.
Credentials come from the plugin props **or** from `extra.integrations.metaAds` (`fb_appId`,
`fb_clientToken`) — the same place the Apptile dashboard/pipeline stores them. With no credentials the
native build is left untouched.

```json
{
  "expo": {
    "plugins": ["@tiledev/sdk-analytics-meta"],
    "extra": {
      "integrations": {
        "metaAds": { "fb_appId": "", "fb_clientToken": "" }
      }
    }
  }
}
```

Then `npx expo prebuild` (or run a dev/EAS build). The native Facebook SDK auto-initialises from the
baked keys.

## 2. Register the adapter

```ts
import { createMetaAnalyticsAdapter } from "@tiledev/sdk-analytics-meta";

analyticsService.use([
  // …other adapters…
  createMetaAnalyticsAdapter({
    appId: META.fbAppId,          // optional — baked natively by the plugin
    clientToken: META.fbClientToken,
    // iOS: hand us the ATT result so advertiser tracking matches the user's choice
    getTrackingAuthorized: async () =>
      (await getTrackingPermissionsAsync()).status === "granted",
  }),
]);
```

The adapter no-ops on web and when the native SDK is absent, so it is safe to register unconditionally.

## Event mapping

| Canonical event | Facebook event |
| --- | --- |
| `productView` / `selectProduct` / `viewCart` | ViewedContent |
| `collectionView` | ViewedContent (product_group) |
| `search` | Searched |
| `addToCart` | AddedToCart |
| `addToWishlist` | AddedToWishlist |
| `initiateCheckout` / `checkout` | InitiatedCheckout |
| `purchase` / `itemPurchased` | Purchase (`logPurchase`) |
| `signup` / `customerRegistered` | CompleteRegistration |

Everything else is skipped (no Meta standard counterpart).

## iOS App Tracking Transparency

Advertiser tracking must respect ATT. The host owns the ATT prompt (e.g. `expo-tracking-transparency`)
and passes the result via `getTrackingAuthorized`; the adapter flips `setAdvertiserTrackingEnabled` to
match on `init`.
