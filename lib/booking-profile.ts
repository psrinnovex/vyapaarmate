export type CustomerBookingProfile =
  | {
      status: "guest";
      loginHref: string;
      registerHref: string;
      profileHref: string;
      name: "";
      email: "";
      phone: "";
    }
  | {
      status: "wrong_role";
      loginHref: string;
      registerHref: string;
      profileHref: string;
      name: "";
      email: "";
      phone: "";
    }
  | {
      status: "unverified" | "verified";
      loginHref: string;
      registerHref: string;
      profileHref: string;
      name: string;
      email: string;
      phone: string;
    };

export function customerProfileIsBookingVerified(profile: CustomerBookingProfile) {
  return profile.status === "verified";
}
