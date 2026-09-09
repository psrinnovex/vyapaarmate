import { describe, expect, it, jest } from "@jest/globals";
import { buildExternalUrls, normalizeApiOrigin } from "@/config/runtime";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { apiUrl: "https://www.vyapaarmate.com" },
    },
  },
}));

describe("native external URLs", () => {
  it("uses the dedicated mobile legal notices", () => {
    expect(buildExternalUrls("https://www.vyapaarmate.com/")).toEqual({
      privacy: "https://www.vyapaarmate.com/mobile/privacy",
      terms: "https://www.vyapaarmate.com/mobile/terms",
      support: "https://www.vyapaarmate.com/contact",
    });
  });

  it("accepts only a plain HTTPS origin outside local development", () => {
    expect(normalizeApiOrigin("https://www.vyapaarmate.com/")).toBe("https://www.vyapaarmate.com");
    expect(() => normalizeApiOrigin("http://www.vyapaarmate.com")).toThrow("HTTPS");
    expect(() => normalizeApiOrigin("https://user:password@www.vyapaarmate.com")).toThrow("plain origin");
    expect(() => normalizeApiOrigin("https://www.vyapaarmate.com/api")).toThrow("plain origin");
  });
});
