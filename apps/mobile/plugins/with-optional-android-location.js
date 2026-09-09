const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withOptionalAndroidLocation(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;
    const features = manifest["uses-feature"] ?? [];
    const withoutLocation = features.filter(
      (feature) => feature.$?.["android:name"] !== "android.hardware.location",
    );

    manifest["uses-feature"] = [
      ...withoutLocation,
      {
        $: {
          "android:name": "android.hardware.location",
          "android:required": "false",
        },
      },
    ];
    return nextConfig;
  });
};
