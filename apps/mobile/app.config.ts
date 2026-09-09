import type { ConfigContext, ExpoConfig } from "expo/config";

const identity = "com.pshrinnovex.vyapaarmate";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "VyapaarMate",
  slug: "vyapaarmate",
  scheme: identity,
  owner: "pshr_innovex_org",
  version: "1.0.0",
  orientation: "default",
  platforms: ["ios", "android"],
  icon: "./assets/brand/icon.png",
  userInterfaceStyle: "automatic",
  runtimeVersion: "1.0.0",
  ios: {
    bundleIdentifier: identity,
    buildNumber: "1",
    supportsTablet: true,
    infoPlist: {
      UIApplicationSupportsIndirectInputEvents: true,
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsLocalNetworking: false,
      },
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhoneNumber",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhysicalAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePurchaseHistory",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeUserID",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
      ],
    },
  },
  android: {
    package: identity,
    versionCode: 1,
    allowBackup: false,
    intentFilters: [
      {
        action: "VIEW",
        category: ["BROWSABLE", "DEFAULT"],
        data: [{ scheme: identity, host: "oauth2redirect" }],
      },
    ],
    adaptiveIcon: {
      backgroundColor: "#F3F6EF",
      foregroundImage: "./assets/brand/adaptive-foreground.png",
      monochromeImage: "./assets/brand/adaptive-monochrome.png",
    },
    blockedPermissions: [
      "android.permission.ACCESS_ADSERVICES_AD_ID",
      "android.permission.CAMERA",
      "android.permission.READ_CONTACTS",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_AUDIO",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.RECORD_AUDIO",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
      "android.permission.VIBRATE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],
  },
  plugins: [
    "expo-router",
    "./plugins/with-optional-android-location",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#10261C",
        image: "./assets/brand/splash.png",
        imageWidth: 180,
        dark: { backgroundColor: "#07150F", image: "./assets/brand/splash.png" },
      },
    ],
    ["expo-secure-store", { faceIDPermission: false }],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "VyapaarMate uses your location only when you ask to sort nearby businesses or confirm a service address.",
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.4",
          privacyManifestAggregationEnabled: true,
        },
      },
    ],
    "./plugins/with-strict-mobile-callback",
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    eas: {
      projectId: "a61afeb8-4746-4441-8b97-e09044fcaef0",
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://www.vyapaarmate.com",
  },
});
