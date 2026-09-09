import assert from "node:assert/strict";
import test from "node:test";
import {
  canOfferInstalledApp,
  detectInstallPlatform,
  isBackOfficeSurface,
  platformAccessForRole
} from "./platform-access";

test("detects iPhone, iPad desktop mode, Android, Mac, Windows, ChromeOS, and Linux", () => {
  assert.equal(detectInstallPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
  assert.equal(detectInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 5), "ios");
  assert.equal(detectInstallPlatform("Mozilla/5.0 (Linux; Android 16; Pixel 10)"), "android");
  assert.equal(detectInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6)"), "macos");
  assert.equal(detectInstallPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "windows");
  assert.equal(detectInstallPlatform("Mozilla/5.0 (X11; CrOS x86_64 16093.68.0)"), "chromeos");
  assert.equal(detectInstallPlatform("Mozilla/5.0 (X11; Linux x86_64)"), "linux");
});

test("recognizes admin and support routes and auth destinations", () => {
  assert.equal(isBackOfficeSurface("/admin/businesses"), true);
  assert.equal(isBackOfficeSurface("/support"), true);
  assert.equal(isBackOfficeSurface("/login", "?type=support"), true);
  assert.equal(isBackOfficeSurface("/login", "?next=%2Fadmin%2Fpayments"), true);
  assert.equal(isBackOfficeSurface("/dashboard"), false);
});

test("mobile installation is limited to customer and business surfaces", () => {
  assert.equal(canOfferInstalledApp({ platform: "ios", role: "CUSTOMER", pathname: "/user" }), true);
  assert.equal(canOfferInstalledApp({ platform: "android", role: "OWNER", pathname: "/dashboard" }), true);
  assert.equal(canOfferInstalledApp({ platform: "ios", role: "SUPER_ADMIN", pathname: "/" }), false);
  assert.equal(canOfferInstalledApp({ platform: "android", role: null, pathname: "/support" }), false);
  assert.equal(canOfferInstalledApp({ platform: "ios", role: null, pathname: "/" }), false);
  assert.equal(canOfferInstalledApp({ platform: "android", role: "OWNER", pathname: "/login", search: "?type=support" }), false);
});

test("desktop and Mac installation remains available for every role", () => {
  assert.equal(canOfferInstalledApp({ platform: "windows", role: "SUPER_ADMIN", pathname: "/admin" }), true);
  assert.equal(canOfferInstalledApp({ platform: "macos", role: "SUPPORT_AGENT", pathname: "/support" }), true);
  assert.equal(canOfferInstalledApp({ platform: "windows", role: null, pathname: "/" }), false);
  assert.equal(canOfferInstalledApp({ platform: "linux", role: "SUPER_ADMIN", pathname: "/admin" }), false);
  assert.equal(canOfferInstalledApp({ platform: "chromeos", role: "OWNER", pathname: "/dashboard" }), false);
});

test("the published role matrix keeps back office out of phone installs", () => {
  assert.equal(platformAccessForRole("CUSTOMER").iosInstalledApp, true);
  assert.equal(platformAccessForRole("OWNER").androidInstalledApp, true);
  assert.equal(platformAccessForRole("SUPER_ADMIN").iosInstalledApp, false);
  assert.equal(platformAccessForRole("SUPPORT_AGENT").androidInstalledApp, false);
  assert.equal(platformAccessForRole("SUPPORT_AGENT").macosInstalledApp, true);
  assert.equal(platformAccessForRole("SUPER_ADMIN").website, true);
});
