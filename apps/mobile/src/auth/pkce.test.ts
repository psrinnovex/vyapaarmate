import { parseAuthorizationCallback } from "@/auth/pkce";
import { describe, expect, it } from "@jest/globals";

describe("native authorization callback", () => {
  it("accepts only the fixed host callback and matching state", () => {
    expect(
      parseAuthorizationCallback(
        "com.pshrinnovex.vyapaarmate://oauth2redirect?state=known-state&code=authorization-code",
        "known-state",
      ),
    ).toBe("authorization-code");
  });

  it("rejects a different host, a nested path, and a mismatched state", () => {
    expect(() =>
      parseAuthorizationCallback(
        "com.pshrinnovex.vyapaarmate://unexpected?state=known-state&code=authorization-code",
        "known-state",
      ),
    ).toThrow("unexpected redirect");
    expect(() =>
      parseAuthorizationCallback(
        "com.pshrinnovex.vyapaarmate://oauth2redirect/extra?state=known-state&code=authorization-code",
        "known-state",
      ),
    ).toThrow("unexpected redirect");
    expect(() =>
      parseAuthorizationCallback(
        "com.pshrinnovex.vyapaarmate://oauth2redirect?state=other-state&code=authorization-code",
        "known-state",
      ),
    ).toThrow("could not be verified");
  });
});
