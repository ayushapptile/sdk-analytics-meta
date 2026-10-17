import { DefaultEvents, type EventProperties } from "@tiledev/sdk-analytics-core";
import type { MetaEvent } from "./types";

/**
 * Facebook standard event + parameter names (the `fb_*` wire strings `AppEventsLogger.AppEvents` /
 * `AppEventParams` resolve to). Hard-coded as literals so this module is pure — it never imports the
 * native SDK, which keeps the web bundle and tests free of `react-native-fbsdk-next`.
 */
const FBEvent = {
  AddedToCart: "fb_mobile_add_to_cart",
  AddedToWishlist: "fb_mobile_add_to_wishlist",
  InitiatedCheckout: "fb_mobile_initiated_checkout",
  Searched: "fb_mobile_search",
  ViewedContent: "fb_mobile_content_view",
  CompletedRegistration: "fb_mobile_complete_registration",
} as const;

const FBParam = {
  Content: "fb_content",
  ContentID: "fb_content_id",
  ContentType: "fb_content_type",
  Currency: "fb_currency",
  NumItems: "fb_num_items",
  SearchString: "fb_search_string",
  Description: "fb_description",
  OrderId: "fb_order_id",
} as const;

const DEFAULT_CURRENCY = "USD";

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};

const pick = (props: EventProperties, keys: string[]): unknown => {
  for (const k of keys) if (props[k] !== undefined && props[k] !== null) return props[k];
  return undefined;
};

const currencyOf = (props: EventProperties): string =>
  (pick(props, ["currency", "currencyCode"]) as string) || DEFAULT_CURRENCY;

const valueOf = (props: EventProperties): number | undefined =>
  num(pick(props, ["totalValue", "price", "value", "amount", "total"]));

const numItemsOf = (props: EventProperties): number | undefined => {
  const n = num(pick(props, ["totalItems", "numItems", "quantity"]));
  if (n !== undefined) return n;
  const items = pick(props, ["items", "contents", "products", "lineItems"]);
  return Array.isArray(items) ? items.length : undefined;
};

/** `fb_content`: a JSON string of `{ id, quantity }` — from an items array, or a single product. */
const contentOf = (props: EventProperties): string | undefined => {
  const items = pick(props, ["items", "contents", "products", "lineItems"]);
  if (Array.isArray(items) && items.length) {
    const mapped = items.map((it: Record<string, unknown>) => ({
      id: it.productId ?? it.id ?? it.variantId ?? it.merchandiseId ?? null,
      quantity: num(it.quantity) ?? 1,
    }));
    return JSON.stringify(mapped);
  }
  const id = pick(props, ["productId", "id", "variantId"]);
  return id ? JSON.stringify([{ id, quantity: 1 }]) : undefined;
};

const contentIdOf = (props: EventProperties): unknown =>
  pick(props, ["productId", "id", "variantId"]);

/** Drops undefined values so FBSDK never receives `undefined` params. */
const clean = (obj: Record<string, unknown>): EventProperties => {
  const out: EventProperties = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) out[k] = v;
  return out;
};

/**
 * Map one canonical analytics event (`DefaultEvents`) onto a Meta/Facebook conversion event.
 * Returns `null` for events Meta has no standard counterpart for, which the adapter then skips.
 */
export function toMetaEvent(event: string, props: EventProperties = {}): MetaEvent | null {
  switch (event) {
    case DefaultEvents.PURCHASE:
    case DefaultEvents.ITEM_PURCHASED:
      return {
        kind: "purchase",
        amount: valueOf(props) ?? 0,
        currency: currencyOf(props),
        params: clean({
          [FBParam.Content]: contentOf(props),
          [FBParam.NumItems]: numItemsOf(props),
          [FBParam.OrderId]: pick(props, ["orderId", "orderName"]),
          [FBParam.Currency]: currencyOf(props),
        }),
      };

    case DefaultEvents.ADD_TO_CART:
      return {
        kind: "event",
        name: FBEvent.AddedToCart,
        valueToSum: valueOf(props),
        params: clean({
          [FBParam.Currency]: currencyOf(props),
          [FBParam.ContentType]: "product",
          [FBParam.ContentID]: contentIdOf(props),
          [FBParam.Content]: contentOf(props),
        }),
      };

    case DefaultEvents.ADD_TO_WISHLIST:
      return {
        kind: "event",
        name: FBEvent.AddedToWishlist,
        valueToSum: valueOf(props),
        params: clean({
          [FBParam.Currency]: currencyOf(props),
          [FBParam.ContentType]: "product",
          [FBParam.ContentID]: contentIdOf(props),
          [FBParam.Content]: contentOf(props),
        }),
      };

    case DefaultEvents.INITIATE_CHECKOUT:
    case DefaultEvents.CHECKOUT:
      return {
        kind: "event",
        name: FBEvent.InitiatedCheckout,
        valueToSum: valueOf(props),
        params: clean({
          [FBParam.Currency]: currencyOf(props),
          [FBParam.NumItems]: numItemsOf(props),
          [FBParam.Content]: contentOf(props),
        }),
      };

    case DefaultEvents.SEARCH:
      return {
        kind: "event",
        name: FBEvent.Searched,
        params: clean({
          [FBParam.SearchString]: pick(props, ["query", "searchTerm", "search", "q", "term"]),
          [FBParam.ContentType]: "product",
        }),
      };

    case DefaultEvents.PRODUCT_VIEW:
    case DefaultEvents.SELECT_PRODUCT:
    case DefaultEvents.VIEW_CART:
    case DefaultEvents.COLLECTION_VIEW:
      return {
        kind: "event",
        name: FBEvent.ViewedContent,
        valueToSum: valueOf(props),
        params: clean({
          [FBParam.Currency]: currencyOf(props),
          [FBParam.ContentType]: event === DefaultEvents.COLLECTION_VIEW ? "product_group" : "product",
          [FBParam.ContentID]: contentIdOf(props),
          [FBParam.Content]: contentOf(props),
          [FBParam.Description]: pick(props, ["title", "name"]),
        }),
      };

    case DefaultEvents.SIGNUP:
    case DefaultEvents.CUSTOMER_REGISTERED:
    case DefaultEvents.SIGNUP_SUCCESS:
      return {
        kind: "event",
        name: FBEvent.CompletedRegistration,
        params: clean({ [FBParam.ContentType]: "registration" }),
      };

    default:
      // Everything else (lifecycle, login, cart quantity, merchandising, live-selling) has no Meta
      // standard event — skipped rather than sent as a custom event the ad platform cannot optimise on.
      return null;
  }
}
