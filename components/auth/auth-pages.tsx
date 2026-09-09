"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, CreditCard, KeyRound, LogIn, Mail, MapPin, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { EmailInput, PasswordInput, PhoneInput } from "@/components/ui/form-fields";
import { BusinessTypeSelect } from "@/components/ui/business-type-select";
import {
  authPath,
  nextPathForPortal,
  portalLabels,
  safeAuthNextPath,
  safeRoleRedirectPath,
  selectedAuthPortal,
  signInPathForPortal,
  type AuthPortal
} from "@/lib/auth-portal";
import { getBusinessConsoleIcons } from "@/lib/business-console-icons";
import { defaultBusinessServiceTypeName } from "@/lib/business-service-types";
import { pricingPlans } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { trackMarketingEvent } from "@/components/marketing/marketing-runtime";
import { launchMarket, launchSingleCityRestricted, launchOffer } from "@/lib/launch-policy";
import { isMobileAuthorizationPath } from "@/lib/mobile-client-contract";

type RegisterPortal = Extract<AuthPortal, "business" | "user">;
type AuthPage = "/login" | "/register" | "/forgot-password";

const fieldLabels: Record<string, string> = {
  name: "Name",
  businessName: "Business name",
  email: "Email",
  phone: "Phone",
  password: "Password",
  businessType: "Business type",
  city: "Launch city",
  state: "Launch state",
  subscriptionPlan: "Subscription plan",
  whatsappEnabled: "WhatsApp customer flow"
};

const portalNames: Record<AuthPortal, string> = {
  admin: "Admin",
  support: "Support",
  business: "Business",
  user: "User"
};

const publicAuthPortals: AuthPortal[] = ["business", "user"];

const loginCopy: Record<AuthPortal, { title: string; body: string; placeholder: string }> = {
  admin: {
    title: "Admin login",
    body: "Access the PSHR Innovex admin panel.",
    placeholder: "admin@example.com"
  },
  support: {
    title: "VyapaarMate Support login",
    body: "Access the VyapaarMate Support portal.",
    placeholder: "support@example.com"
  },
  business: {
    title: "Business login",
    body: "Access your business dashboard.",
    placeholder: "owner@example.com"
  },
  user: {
    title: "User login",
    body: "Sign in to browse local businesses, view services, and continue through the user portal.",
    placeholder: "you@example.com"
  }
};

const forgotCopy: Record<AuthPortal, { title: string; body: string; placeholder: string }> = {
  admin: {
    title: "Reset admin password",
    body: "Enter the email linked to your admin account. If it exists, we will send a secure reset link.",
    placeholder: "admin@example.com"
  },
  support: {
    title: "Reset support password",
    body: "Enter the email linked to your VyapaarMate Support account. If it exists, we will send a secure reset link.",
    placeholder: "support@example.com"
  },
  business: {
    title: "Reset business password",
    body: "Enter the email linked to your business dashboard account. If it exists, we will send a secure reset link.",
    placeholder: "owner@example.com"
  },
  user: {
    title: "Reset user password",
    body: "Enter the email linked to your user portal account. If it exists, we will send a secure reset link.",
    placeholder: "you@example.com"
  }
};

function selectedRegisterPortal(value: string | null, nextPath?: string | null): RegisterPortal {
  return selectedAuthPortal(value, nextPath) === "user" ? "user" : "business";
}

function verificationCodeValue(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

async function readResponseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;

    if (body.error && typeof body.error === "object") {
      const flattened = body.error as {
        fieldErrors?: Record<string, string[] | undefined>;
        formErrors?: string[];
      };
      const formErrors = flattened.formErrors ?? [];
      const fieldErrors = Object.entries(flattened.fieldErrors ?? {}).flatMap(([field, messages]) =>
        (messages ?? []).map((message) => `${fieldLabels[field] ?? field}: ${message}`)
      );
      const errors = [...formErrors, ...fieldErrors];
      if (errors.length > 0) return errors.join(" ");
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function AuthPortalSwitch({
  portal,
  page,
  nextPath,
  portals = publicAuthPortals
}: {
  portal: AuthPortal;
  page: AuthPage;
  nextPath?: string | null;
  portals?: AuthPortal[];
}) {
  const gridColumns = portals.length === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`mt-5 grid ${gridColumns} rounded-lg border border-line bg-mist p-1 text-sm font-bold`}>
      {portals.map((option) => {
        const active = portal === option;

        return (
          <Link
            key={option}
            href={authPath(page, option, nextPathForPortal(option, nextPath))}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 items-center justify-center rounded-md transition ${
              active ? "bg-ink text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-ink"
            }`}
          >
            {portalNames[option]}
          </Link>
        );
      })}
    </div>
  );
}

function AuthShell({
  title,
  body,
  switcher,
  showDemoNotice = true,
  lockedToApp = false,
  children
}: {
  title: string;
  body: string;
  switcher?: React.ReactNode;
  showDemoNotice?: boolean;
  lockedToApp?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen min-w-0 grid-cols-[minmax(0,1fr)] place-items-center bg-mesh-light px-4 py-10">
      <div className="w-full min-w-0 max-w-md">
        {lockedToApp ? (
          <div className="mb-6 flex items-center justify-center gap-2 font-bold text-ink" aria-label="VyapaarMate secure app sign in">
            <BrandMark />
            <span>VyapaarMate</span>
          </div>
        ) : (
          <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-bold text-ink">
            <BrandMark />
            <span>VyapaarMate</span>
          </Link>
        )}
        <Card className="bg-white/90 p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          {switcher}
          {showDemoNotice && process.env.NODE_ENV !== "production" && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Local development. Use the test accounts created for this database; demo activity is not customer or revenue evidence.
            </div>
          )}
          {children}
        </Card>
      </div>
    </main>
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const portal = selectedAuthPortal(params.get("type"), params.get("next"));
  const nextPath = params.get("next");
  const isMobileAuthorization = isMobileAuthorizationPath(nextPath);
  const isPrivateTeamPortal = portal === "admin" || portal === "support";
  const isUser = portal === "user";
  const copy = loginCopy[portal];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email")),
        password: String(form.get("password"))
      })
    });
    setLoading(false);

    if (!response.ok) {
      const body = (await response.clone().json().catch(() => ({}))) as {
        verificationRequired?: boolean;
        registrationId?: string;
        phoneVerificationRequired?: boolean;
        role?: string;
      };
      if (response.status === 403 && body.verificationRequired && body.registrationId) {
        const smsParam = body.phoneVerificationRequired ? "&sms=1" : "";
        const verificationPortal = body.role === "CUSTOMER" ? "user" : "business";
        const typeParam = verificationPortal === "user" ? "type=user&" : "";
        const safeNextPath = safeAuthNextPath(nextPath);
        const nextParam = safeNextPath ? `&next=${encodeURIComponent(safeNextPath)}` : "";
        window.location.assign(`/register?${typeParam}verification=${encodeURIComponent(body.registrationId)}${smsParam}${nextParam}`);
        return;
      }
      setError(await readResponseError(response, "Login failed. Check the credentials and environment setup."));
      return;
    }

    const body = (await response.json()) as { user?: { role?: string } };
    window.location.assign(safeRoleRedirectPath(nextPath, body.user?.role));
  }

  return (
    <AuthShell
      title={copy.title}
      body={copy.body}
      switcher={!isPrivateTeamPortal && !isMobileAuthorization ? <AuthPortalSwitch portal={portal} page="/login" nextPath={nextPath} /> : undefined}
      showDemoNotice={!isUser}
      lockedToApp={isMobileAuthorization}
    >
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" />
            <EmailInput id="email" name="email" className="pl-10" placeholder={copy.placeholder} required />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" name="password" showLockIcon required />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={loading} icon={<ArrowRight className="size-4" />}>
          {loading ? "Signing in" : "Sign In"}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm font-semibold text-ocean">
        <Link href={authPath("/forgot-password", portal, nextPath)}>Forgot password?</Link>
        {!isPrivateTeamPortal && !isMobileAuthorization && (
          <Link href={authPath("/register", isUser ? "user" : "business", nextPath)}>
            {isUser ? "Create user account" : "Register business"}
          </Link>
        )}
      </div>
    </AuthShell>
  );
}

export function RegisterForm() {
  const params = useSearchParams();
  const portal = selectedRegisterPortal(params.get("type"), params.get("next"));
  const nextPath = params.get("next");
  const isMobileAuthorization = isMobileAuthorizationPath(nextPath);
  const isUser = portal === "user";
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [businessType, setBusinessType] = useState(defaultBusinessServiceTypeName);
  const [subscriptionPlan, setSubscriptionPlan] = useState<(typeof pricingPlans)[number]["id"]>(() =>
    params.get("plan")?.toUpperCase() === "PRO" ? "PRO" : "STARTER"
  );
  const [registrationId, setRegistrationId] = useState(() => params.get("verification") ?? "");
  const [maskedEmail, setMaskedEmail] = useState("your email");
  const [maskedPhone, setMaskedPhone] = useState("your phone");
  const [phoneVerificationRequired, setPhoneVerificationRequired] = useState(() => params.get("sms") === "1");
  const [devCodes, setDevCodes] = useState<{ email?: string; sms?: string } | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const BusinessIcon = getBusinessConsoleIcons(businessType).businessIcon;

  async function submitBusinessRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name")),
        businessName: String(form.get("businessName")),
        email: String(form.get("email")),
        phone: String(form.get("phone")),
        password: String(form.get("password")),
        businessType: String(form.get("businessType")),
        city: String(form.get("city")),
        state: String(form.get("state")),
        subscriptionPlan: String(form.get("subscriptionPlan")),
        whatsappEnabled: form.get("whatsappEnabled") === "on"
      })
    });
    setLoading(false);

    if (!response.ok) {
      setError(await readResponseError(response, "Registration failed. Check fields, database, and environment variables."));
      return;
    }

    trackMarketingEvent("sign_up", {
      method: "business_registration"
    });
    trackMarketingEvent("business_registration_submitted", {
      business_type: String(form.get("businessType")),
      subscription_plan: String(form.get("subscriptionPlan")),
      whatsapp_enabled: form.get("whatsappEnabled") === "on"
    });

    const body = (await response.json()) as {
      registrationId: string;
      maskedEmail?: string;
      maskedPhone?: string;
      phoneVerificationRequired?: boolean;
      devCodes?: { email?: string; sms?: string };
    };
    setRegistrationId(body.registrationId);
    setMaskedEmail(body.maskedEmail ?? "your email");
    setMaskedPhone(body.maskedPhone ?? "your phone");
    setPhoneVerificationRequired(Boolean(body.phoneVerificationRequired));
    setDevCodes(body.devCodes ?? null);
    setEmailCode("");
    setSmsCode("");
    const smsParam = body.phoneVerificationRequired ? "&sms=1" : "";
    window.history.replaceState(null, "", `/register?verification=${encodeURIComponent(body.registrationId)}${smsParam}`);
  }

  async function submitUserRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/user-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name")),
        email: String(form.get("email")),
        phone: String(form.get("phone")),
        password: String(form.get("password"))
      })
    });
    setLoading(false);

    if (!response.ok) {
      setError(await readResponseError(response, "User registration failed. Check fields and try again."));
      return;
    }

    trackMarketingEvent("sign_up", {
      method: "user_registration"
    });
    trackMarketingEvent("user_registration_submitted", {
      portal: "user"
    });

    const body = (await response.json()) as {
      registrationId: string;
      maskedEmail?: string;
      maskedPhone?: string;
      phoneVerificationRequired?: boolean;
      devCodes?: { email?: string; sms?: string };
    };
    setRegistrationId(body.registrationId);
    setMaskedEmail(body.maskedEmail ?? "your email");
    setMaskedPhone(body.maskedPhone ?? "your phone");
    setPhoneVerificationRequired(Boolean(body.phoneVerificationRequired));
    setDevCodes(body.devCodes ?? null);
    setEmailCode("");
    setSmsCode("");
    const smsParam = body.phoneVerificationRequired ? "&sms=1" : "";
    const safeNextPath = safeAuthNextPath(nextPath);
    const nextParam = safeNextPath ? `&next=${encodeURIComponent(safeNextPath)}` : "";
    window.history.replaceState(null, "", `/register?type=user&verification=${encodeURIComponent(body.registrationId)}${smsParam}${nextParam}`);
  }

  async function verifyRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registrationId,
        emailCode,
        ...(phoneVerificationRequired ? { smsCode } : {})
      })
    });
    setLoading(false);

    if (!response.ok) {
      setError(await readResponseError(response, "Verification failed. Check both codes and try again."));
      return;
    }

    const body = (await response.json().catch(() => ({}))) as { redirectPath?: string; role?: string };
    const redirectPath =
      body.role === "CUSTOMER" && safeAuthNextPath(nextPath)
        ? safeRoleRedirectPath(nextPath, "CUSTOMER")
        : body.redirectPath ?? "/dashboard/setup";
    trackMarketingEvent("registration_verified", {
      portal,
      role: body.role ?? (portal === "user" ? "CUSTOMER" : "BUSINESS_OWNER")
    });
    window.location.assign(redirectPath);
  }

  async function resendCodes() {
    setResending(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/register/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId })
    });
    setResending(false);

    if (!response.ok) {
      setError(await readResponseError(response, "We could not resend the codes."));
      return;
    }

    const body = (await response.json()) as {
      message?: string;
      phoneVerificationRequired?: boolean;
      devCodes?: { email?: string; sms?: string };
    };
    setMessage(body.message ?? "New verification codes were sent.");
    setPhoneVerificationRequired(Boolean(body.phoneVerificationRequired));
    setDevCodes(body.devCodes ?? null);
    setEmailCode("");
    setSmsCode("");
  }

  if (registrationId) {
    return (
      <AuthShell
        title={phoneVerificationRequired ? "Verify your email and phone" : "Verify your email"}
        body={
          phoneVerificationRequired
            ? `Enter the codes sent to ${maskedEmail} and ${maskedPhone}. Both are required before your account is activated.`
            : `Enter the code sent to ${maskedEmail}. Phone numbers are still kept unique, but SMS verification is disabled.`
        }
        lockedToApp={isMobileAuthorization}
      >
        <form key={`verification-${registrationId}`} onSubmit={verifyRegistration} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="emailCode">Email verification code</Label>
            <Input
              id="emailCode"
              name="emailCode"
              type="text"
              value={emailCode}
              onChange={(event) => setEmailCode(verificationCodeValue(event.currentTarget.value, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="6-digit code"
              required
            />
          </div>
          {phoneVerificationRequired && (
            <div className="grid gap-2">
              <Label htmlFor="smsCode">SMS verification code</Label>
              <Input
                id="smsCode"
                name="smsCode"
                type="text"
                value={smsCode}
                onChange={(event) => setSmsCode(verificationCodeValue(event.currentTarget.value, 10))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                pattern="[0-9]{4,10}"
                maxLength={10}
                placeholder="Code from SMS"
                required
              />
            </div>
          )}
          {devCodes && (devCodes.email || devCodes.sms) && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Local test code: email <strong>{devCodes.email ?? "sent by provider"}</strong>
              {phoneVerificationRequired ? (
                <>
                  , SMS <strong>{devCodes.sms ?? "sent by provider"}</strong>
                </>
              ) : null}
              .
            </p>
          )}
          {message && <p className="rounded-lg bg-emerald/10 p-3 text-sm font-semibold text-emerald">{message}</p>}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={loading} variant="emerald" icon={<ShieldCheck className="size-4" />}>
            {loading ? "Verifying" : "Verify and Continue"}
          </Button>
          <Button
            type="button"
            disabled={resending}
            variant="secondary"
            icon={<RefreshCw className="size-4" />}
            onClick={resendCodes}
          >
            {resending ? "Sending" : "Resend Codes"}
          </Button>
          <ButtonLink href={authPath("/login", portal, nextPath)} variant="secondary" className="w-full" icon={<LogIn className="size-4" />}>
            Back to Sign In
          </ButtonLink>
        </form>
      </AuthShell>
    );
  }

  if (isMobileAuthorization) {
    return (
      <AuthShell
        title="Sign in to continue in the app"
        body="New account and subscription enrollment are available on the VyapaarMate website, not inside the mobile app sign-in flow."
        showDemoNotice={false}
        lockedToApp
      >
        <div className="mt-6">
          <ButtonLink href={authPath("/login", portal, nextPath)} variant="emerald" className="w-full" icon={<LogIn className="size-4" />}>
            Back to Sign In
          </ButtonLink>
        </div>
      </AuthShell>
    );
  }

  if (isUser) {
    return (
      <AuthShell
        title="Create your user account"
        body="Register as a user to browse active businesses, view services, and continue from the user portal."
        switcher={<AuthPortalSwitch portal={portal} page="/register" nextPath={nextPath} portals={["business", "user"]} />}
        showDemoNotice={false}
      >
        <form onSubmit={submitUserRegistration} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" placeholder="Your name" autoComplete="name" required />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">Email</Label>
              <EmailInput id="email" name="email" placeholder="you@example.com" autoComplete="email" required />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <PhoneInput id="phone" name="phone" required />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" name="password" autoComplete="new-password" placeholder="10+ characters" minLength={10} required />
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={loading} variant="emerald" icon={<ArrowRight className="size-4" />}>
            {loading ? "Creating" : "Create User Account"}
          </Button>
          <ButtonLink href={authPath("/login", "user", nextPath)} variant="secondary" className="w-full" icon={<LogIn className="size-4" />}>
            Sign In
          </ButtonLink>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Business Register"
      body={`Apply for the ${launchMarket.displayName} business launch, verify your account, confirm your operating location, then review your cohort’s applicable subscription total plus GST before payment and KYC.`}
      switcher={<AuthPortalSwitch portal={portal} page="/register" nextPath={nextPath} portals={["business", "user"]} />}
    >
      <form onSubmit={submitBusinessRegistration} className="mt-6 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Owner name</Label>
          <Input id="name" name="name" placeholder="Owner name" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="businessName">Business name</Label>
          <div className="relative">
            <BusinessIcon className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" />
            <Input id="businessName" name="businessName" className="pl-10" placeholder="HSR Fresh Foods" required />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="city">Current launch location</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-3 size-5 text-emerald" />
              <Input id="city" name="city" defaultValue={launchSingleCityRestricted ? launchMarket.city : ""} className="pl-10" readOnly={launchSingleCityRestricted} required />
            </div>
            <Input id="state" name="state" defaultValue={launchSingleCityRestricted ? launchMarket.state : ""} readOnly={launchSingleCityRestricted} required />
          </div>
          <p className="text-xs leading-5 text-slate-500">
            {launchSingleCityRestricted
              ? "Your operating address and map pin will be verified inside the Bengaluru launch area before payment."
              : "Enter the city and state where the business operates. The map pin will be verified before payment."}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="email">Email</Label>
            <EmailInput id="email" name="email" placeholder="owner@example.com" required />
          </div>
          <div>
            <Label htmlFor="phone">Business phone</Label>
            <PhoneInput id="phone" name="phone" required />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="businessType">Business type</Label>
            <BusinessTypeSelect
              id="businessType"
              name="businessType"
              required
              onChange={(event) => setBusinessType(event.currentTarget.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" name="password" autoComplete="new-password" placeholder="10+ characters" required />
          </div>
        </div>
        <div className="grid gap-3">
          <Label>Subscription plan</Label>
          <input type="hidden" name="subscriptionPlan" value={subscriptionPlan} />
          <div className="grid gap-3 sm:grid-cols-2">
            {pricingPlans.map((plan) => {
              const selected = subscriptionPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  className={`rounded-lg border p-4 text-left transition ${
                    selected ? "border-emerald bg-emerald/10 shadow-sm" : "border-line bg-white hover:border-ocean/30"
                  }`}
                  onClick={() => {
                    setSubscriptionPlan(plan.id);
                    trackMarketingEvent("select_subscription_plan", {
                      subscription_plan: plan.id,
                      value: plan.price
                    });
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink">{plan.name}</span>
                    {selected ? <CheckCircle2 className="size-5 text-emerald" /> : <CreditCard className="size-5 text-slate-400" />}
                  </span>
                  <span className="mt-2 block text-2xl font-extrabold text-ink">{formatINR(plan.price)}</span>
                  {launchOffer.publiclyAdvertised && (
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      <span className="line-through">{formatINR(plan.listPrice)}</span>{" "}
                      <span className="text-emerald">{launchOffer.discountLabel}</span>
                    </span>
                  )}
                  <span className="mt-1 block text-xs font-semibold text-slate-500">per 30 days, plus GST; setup and provider usage are separate</span>
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-lg border border-line bg-mist p-3">
          <span>
            <span className="block text-sm font-bold text-ink">Enable WhatsApp customer flow</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">Turn this off for website-only orders until you are ready for WhatsApp setup.</span>
          </span>
          <input name="whatsappEnabled" type="checkbox" defaultChecked className="peer sr-only" />
          <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
        </label>
        <p className="text-xs leading-5 text-slate-500">
          By creating an account, you agree to the <Link href="/terms" className="font-semibold text-ocean">Terms</Link> and acknowledge the{" "}
          <Link href="/privacy" className="font-semibold text-ocean">Privacy Policy</Link>. You will review the final discounted amount, GST, and any separate setup or provider charges before payment.
        </p>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button
          type="submit"
          disabled={loading}
          variant="emerald"
          icon={<ArrowRight className="size-4" />}
          className="h-auto min-h-10 min-w-0 whitespace-normal px-3 py-2 text-center leading-5"
        >
          {loading ? "Submitting" : `Create account for ${formatINR(pricingPlans.find((plan) => plan.id === subscriptionPlan)?.price ?? pricingPlans[0].price)} + GST`}
        </Button>
        <ButtonLink href={authPath("/login", "business", nextPath)} variant="secondary" className="w-full" icon={<LogIn className="size-4" />}>
          Sign In
        </ButtonLink>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const params = useSearchParams();
  const portal = selectedAuthPortal(params.get("type"), params.get("next"));
  const nextPath = params.get("next");
  const isMobileAuthorization = isMobileAuthorizationPath(nextPath);
  const isPrivateTeamPortal = portal === "admin" || portal === "support";
  const copy = forgotCopy[portal];
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    setDevResetUrl("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(form.get("email")), portal })
    });
    setLoading(false);

    if (!response.ok) {
      setError(await readResponseError(response, "We could not process the reset request. Try again shortly."));
      return;
    }

    const body = (await response.json()) as { message?: string; devResetUrl?: string };
    setMessage(body.message ?? "If an account exists for that email, a secure password reset link has been sent.");
    setDevResetUrl(body.devResetUrl ?? "");
  }

  return (
    <AuthShell
      title={copy.title}
      body={copy.body}
      switcher={!isPrivateTeamPortal && !isMobileAuthorization ? <AuthPortalSwitch portal={portal} page="/forgot-password" nextPath={nextPath} /> : undefined}
      showDemoNotice={false}
      lockedToApp={isMobileAuthorization}
    >
      <form className="mt-6 grid gap-4" onSubmit={submit}>
        <div className="grid gap-2">
          <Label htmlFor="email">Account email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" />
            <EmailInput id="email" name="email" className="pl-10" placeholder={copy.placeholder} required />
          </div>
        </div>
        {message && (
          <p className="rounded-lg bg-emerald/10 p-3 text-sm font-semibold leading-6 text-emerald">
            {message}
          </p>
        )}
        {devResetUrl && (
          <ButtonLink href={devResetUrl} variant="secondary" className="w-full" icon={<KeyRound className="size-4" />}>
            Open Local Reset Link
          </ButtonLink>
        )}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={loading} variant="emerald" icon={<Mail className="size-4" />}>
          {loading ? "Sending" : "Send Reset Link"}
        </Button>
        <ButtonLink href={signInPathForPortal(portal, nextPath)} variant="secondary" className="w-full" icon={<LogIn className="size-4" />}>
          Back to Sign In
        </ButtonLink>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const portal = selectedAuthPortal(params.get("type"), params.get("next"));
  const nextPath = params.get("next");
  const isMobileAuthorization = isMobileAuthorizationPath(nextPath);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signInHref, setSignInHref] = useState(() => signInPathForPortal(portal, nextPath));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmPassword = String(form.get("confirmPassword"));

    if (password !== confirmPassword) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    setLoading(false);

    if (!response.ok) {
      setError(await readResponseError(response, "This reset link could not be used. Request a new link and try again."));
      return;
    }

    const body = (await response.json()) as { message?: string; signInPath?: string };
    setMessage(body.message ?? "Your password has been updated. Sign in with the new password.");
    setSignInHref(body.signInPath ?? signInPathForPortal(portal, nextPath));
    setComplete(true);
  }

  if (!token) {
    return (
      <AuthShell
        title="Reset link missing"
        body="Request a new password reset link and open it from your email."
        showDemoNotice={false}
        lockedToApp={isMobileAuthorization}
      >
        <div className="mt-6 grid gap-3">
          <ButtonLink href={authPath("/forgot-password", portal, nextPath)} variant="emerald" className="w-full" icon={<Mail className="size-4" />}>
            Request New Link
          </ButtonLink>
          <ButtonLink href={signInHref} variant="secondary" className="w-full" icon={<LogIn className="size-4" />}>
            Back to Sign In
          </ButtonLink>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set new password"
      body={`Choose a new password for your ${portalLabels[portal]}. This reset link can be used only once.`}
      showDemoNotice={false}
      lockedToApp={isMobileAuthorization}
    >
      {complete ? (
        <div className="mt-6 grid gap-4">
          <p className="flex gap-3 rounded-lg bg-emerald/10 p-3 text-sm font-semibold leading-6 text-emerald">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{message}</span>
          </p>
          <ButtonLink href={signInHref} variant="emerald" className="w-full" icon={<LogIn className="size-4" />}>
            Sign In
          </ButtonLink>
        </div>
      ) : (
        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <PasswordInput id="password" name="password" autoComplete="new-password" placeholder="10+ characters" minLength={10} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" placeholder="Repeat password" minLength={10} required />
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={loading} variant="emerald" icon={<KeyRound className="size-4" />}>
            {loading ? "Updating" : "Update Password"}
          </Button>
          <ButtonLink href={authPath("/forgot-password", portal, nextPath)} variant="secondary" className="w-full" icon={<Mail className="size-4" />}>
            Request New Link
          </ButtonLink>
        </form>
      )}
    </AuthShell>
  );
}
