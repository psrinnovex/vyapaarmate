type OtpInput = {
  phone: string;
  purpose: "LOGIN" | "VERIFY_PHONE";
};

type TwilioVerifyResponse = {
  sid?: string;
  status?: string;
  message?: string;
};

type VerifyOtpInput = {
  phone: string;
  code: string;
};

function twilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  return { accountSid, authToken, verifyServiceSid };
}

export function smsVerificationEnabled() {
  return process.env.SMS_VERIFICATION_ENABLED === "true";
}

function requireTwilioCredentials() {
  if (!smsVerificationEnabled()) return null;

  const credentials = twilioCredentials();
  if (credentials.accountSid && credentials.authToken && credentials.verifyServiceSid) return credentials;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SMS verification is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID."
    );
  }
  return null;
}

export async function sendOtp(input: OtpInput) {
  const credentials = requireTwilioCredentials();

  if (!credentials) {
    if (!smsVerificationEnabled()) {
      return { status: "disabled", phone: input.phone, purpose: input.purpose };
    }
    return { status: "placeholder", phone: input.phone, code: "123456", purpose: input.purpose };
  }

  const response = await fetch(`https://verify.twilio.com/v2/Services/${credentials.verifyServiceSid}/Verifications`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      To: input.phone,
      Channel: "sms"
    })
  });

  const payload = (await response.json().catch(() => ({}))) as TwilioVerifyResponse;
  if (!response.ok) {
    throw new Error(payload.message ?? `SMS OTP API request failed with status ${response.status}`);
  }

  return {
    status: payload.status ?? "queued",
    phone: input.phone,
    purpose: input.purpose,
    verificationSid: payload.sid
  };
}

export async function verifyOtp(input: VerifyOtpInput) {
  const credentials = requireTwilioCredentials();
  if (!credentials) {
    if (!smsVerificationEnabled()) {
      return { approved: true, status: "disabled" };
    }
    return { approved: input.code === "123456", status: input.code === "123456" ? "approved" : "pending" };
  }

  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${credentials.verifyServiceSid}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ To: input.phone, Code: input.code })
    }
  );

  const payload = (await response.json().catch(() => ({}))) as TwilioVerifyResponse;
  if (!response.ok) {
    if (response.status === 404 || response.status === 400) {
      return { approved: false, status: payload.status ?? "pending" };
    }
    throw new Error(payload.message ?? `SMS OTP verification failed with status ${response.status}`);
  }

  return { approved: payload.status === "approved", status: payload.status ?? "pending" };
}
