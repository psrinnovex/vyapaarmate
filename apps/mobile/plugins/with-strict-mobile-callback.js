const { withAndroidManifest, withInfoPlist } = require("expo/config-plugins");

const callbackScheme = "com.pshrinnovex.vyapaarmate";
const callbackHost = "oauth2redirect";

function isCallbackFilter(filter) {
  const data = filter.data ?? [];
  return data.some((entry) => entry.$?.["android:scheme"] === callbackScheme);
}

function isExactCallbackFilter(filter) {
  const data = filter.data ?? [];
  return (
    data.length === 1 &&
    data[0].$?.["android:scheme"] === callbackScheme &&
    data[0].$?.["android:host"] === callbackHost &&
    !data[0].$?.["android:path"] &&
    !data[0].$?.["android:pathPrefix"] &&
    !data[0].$?.["android:pathPattern"]
  );
}

module.exports = function withStrictMobileCallback(config) {
  const withStrictAndroidCallback = withAndroidManifest(config, (nextConfig) => {
    const application = nextConfig.modResults.manifest.application?.[0];
    const mainActivity = application?.activity?.find(
      (activity) => activity.$?.["android:name"] === ".MainActivity",
    );
    if (!mainActivity) throw new Error("VyapaarMate MainActivity was not found while restricting the OAuth callback.");

    const filters = mainActivity["intent-filter"] ?? [];
    const unrelated = filters.filter((filter) => !isCallbackFilter(filter));
    const exact = filters.find(isExactCallbackFilter);
    mainActivity["intent-filter"] = [
      ...unrelated,
      exact ?? {
        $: { "data-generated": "true" },
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        category: [
          { $: { "android:name": "android.intent.category.BROWSABLE" } },
          { $: { "android:name": "android.intent.category.DEFAULT" } },
        ],
        data: [{ $: { "android:scheme": callbackScheme, "android:host": callbackHost } }],
      },
    ];
    return nextConfig;
  });

  return withInfoPlist(withStrictAndroidCallback, (nextConfig) => {
    const urlTypes = nextConfig.modResults.CFBundleURLTypes ?? [];
    nextConfig.modResults.CFBundleURLTypes = urlTypes.map((urlType) => ({
      ...urlType,
      CFBundleURLSchemes: [...new Set(urlType.CFBundleURLSchemes ?? [])],
    }));
    return nextConfig;
  });
};
