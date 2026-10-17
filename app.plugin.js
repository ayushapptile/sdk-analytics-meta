// Expo config plugin for @tiledev/sdk-analytics-meta — the managed-Expo equivalent of the engine's
// apptile-seed native setup. It bakes the Facebook App Id + Client Token into the native projects so
// `react-native-fbsdk-next` self-initialises, mirroring exactly what iosProjectSetup/androidProjectSetup
// write:
//   iOS Info.plist: FacebookAppID, FacebookClientToken, FacebookDisplayName,
//     FacebookAutoLogAppEventsEnabled=true, FacebookAdvertiserIDCollectionEnabled=false,
//     a fb<appId> URL scheme, FB query schemes, and an ATT usage string.
//   Android strings.xml: facebook_app_id, facebook_client_token
//   Android manifest: com.facebook.sdk.ApplicationId / com.facebook.sdk.ClientToken meta-data.
//
// Credentials come from the plugin props, or fall back to `extra.integrations.metaAds` (where the
// Apptile build pipeline / dashboard puts them, same as logrocket). With no creds the build is left
// untouched — so a store without Meta configured is unaffected.
const {
  withInfoPlist,
  withStringsXml,
  withAndroidManifest,
  AndroidConfig,
} = require("@expo/config-plugins");

const DEFAULT_ATT =
  "Allows this app to measure the performance of ads and show you more relevant content.";

function resolveCreds(config, props) {
  const extra =
    (config.extra && config.extra.integrations && config.extra.integrations.metaAds) || {};
  const appId = String((props && props.appId) || extra.fb_appId || "").trim();
  const clientToken = String((props && props.clientToken) || extra.fb_clientToken || "").trim();
  return { appId, clientToken };
}

const withMetaIos = (config, props) =>
  withInfoPlist(config, (c) => {
    const { appId, clientToken } = resolveCreds(c, props);
    if (!appId || !clientToken) return c; // no creds → leave the build untouched

    const plist = c.modResults;
    plist.FacebookAppID = appId;
    plist.FacebookClientToken = clientToken;
    plist.FacebookDisplayName = (props && props.displayName) || c.name || "App";
    plist.FacebookAutoLogAppEventsEnabled = true;
    plist.FacebookAdvertiserIDCollectionEnabled = false;

    const scheme = `fb${appId}`;
    plist.CFBundleURLTypes = plist.CFBundleURLTypes || [];
    const hasScheme = plist.CFBundleURLTypes.some(
      (t) => Array.isArray(t.CFBundleURLSchemes) && t.CFBundleURLSchemes.includes(scheme)
    );
    if (!hasScheme) plist.CFBundleURLTypes.push({ CFBundleURLSchemes: [scheme] });

    plist.LSApplicationQueriesSchemes = Array.from(
      new Set([
        ...(plist.LSApplicationQueriesSchemes || []),
        "fbapi",
        "fb-messenger-share-api",
        "fbauth2",
        "fbshareextension",
      ])
    );

    if (!plist.NSUserTrackingUsageDescription) {
      plist.NSUserTrackingUsageDescription =
        (props && props.userTrackingPermission) || DEFAULT_ATT;
    }
    return c;
  });

const withMetaAndroid = (config, props) => {
  let next = withStringsXml(config, (c) => {
    const { appId, clientToken } = resolveCreds(c, props);
    if (!appId || !clientToken) return c;
    c.modResults = AndroidConfig.Strings.setStringItem(
      [
        { $: { name: "facebook_app_id", translatable: "false" }, _: appId },
        { $: { name: "facebook_client_token", translatable: "false" }, _: clientToken },
      ],
      c.modResults
    );
    return c;
  });

  next = withAndroidManifest(next, (c) => {
    const { appId, clientToken } = resolveCreds(c, props);
    if (!appId || !clientToken) return c;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      "com.facebook.sdk.ApplicationId",
      "@string/facebook_app_id"
    );
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      "com.facebook.sdk.ClientToken",
      "@string/facebook_client_token"
    );
    return c;
  });

  return next;
};

const withMetaAds = (config, props = {}) => {
  config = withMetaIos(config, props);
  config = withMetaAndroid(config, props);
  return config;
};

module.exports = withMetaAds;
