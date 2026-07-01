type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

export async function sendEmail(input: EmailInput) {
  const apiKey = process.env.RESEND_API_KEY ?? process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email verification is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
    }
    return { status: "placeholder", to: input.to, subject: input.subject };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {})
    })
  });

  const payload = (await response.json().catch(() => ({}))) as ResendResponse;
  if (!response.ok) {
    throw new Error(payload.message ?? payload.name ?? `Email API request failed with status ${response.status}`);
  }

  return { status: "queued", to: input.to, subject: input.subject, messageId: payload.id };
}
