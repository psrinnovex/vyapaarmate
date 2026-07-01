import { createHmac, timingSafeEqual } from "node:crypto";

export type WhatsAppTemplateInput = {
  phone: string;
  templateName: string;
  variables: string[];
};

export type WhatsAppTemplateResult = {
  status: "placeholder" | "queued";
  messageId: string;
  templateName: string;
  phone: string;
};

export type WhatsAppOutboundResult = {
  status: "placeholder" | "queued";
  messageId: string;
  phone: string;
};

export type WhatsAppProviderConfig = {
  liveSendsEnabled?: boolean;
  accessToken?: string | null;
  phoneNumberId?: string | null;
  graphApiVersion?: string | null;
};

export type WhatsAppListSection = {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
};

export type WhatsAppStatusUpdate = {
  providerMessageId: string;
  status: "SENT" | "DELIVERED" | "FAILED";
  timestamp: Date;
  errorMessage?: string;
};

export type WhatsAppInboundOrderItem = {
  productRetailerId: string;
  quantity: number;
  itemPrice?: number;
  currency?: string;
};

export type WhatsAppInboundMessage = {
  providerMessageId: string;
  from: string;
  profileName?: string;
  type: "text" | "interactive" | "order" | "unknown";
  text?: string;
  interactiveReplyId?: string;
  interactiveReplyTitle?: string;
  orderItems: WhatsAppInboundOrderItem[];
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  timestamp: Date;
};

type WhatsAppApiResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string };
};

function placeholderMessageId() {
  return `wamid.placeholder.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeWhatsAppRecipient(phone: string) {
  return phone.replace(/\D/g, "");
}

export function createWhatsAppDeepLink(phone: string, message: string) {
  const recipient = normalizeWhatsAppRecipient(phone);
  if (!recipient) return null;

  const params = new URLSearchParams({ text: message });
  return `https://wa.me/${recipient}?${params.toString()}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getErrorMessage(payload: unknown) {
  const record = asRecord(payload);
  const error = asRecord(record?.error);
  return typeof error?.message === "string" ? error.message : undefined;
}

function getWhatsAppConfig(config?: WhatsAppProviderConfig) {
  return {
    liveSendsEnabled: config?.liveSendsEnabled ?? process.env.WHATSAPP_LIVE_SENDS_ENABLED === "true",
    accessToken: config?.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: config?.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID,
    graphApiVersion: config?.graphApiVersion ?? process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0"
  };
}

function truncateWhatsAppText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

async function sendWhatsAppPayload(
  phone: string,
  payload: Record<string, unknown>,
  config?: WhatsAppProviderConfig
): Promise<WhatsAppOutboundResult> {
  const { liveSendsEnabled, accessToken, phoneNumberId, graphApiVersion } = getWhatsAppConfig(config);

  if (!liveSendsEnabled || !accessToken || !phoneNumberId) {
    return {
      status: "placeholder",
      messageId: placeholderMessageId(),
      phone
    };
  }

  const response = await fetch(`https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizeWhatsAppRecipient(phone),
      ...payload
    })
  });

  const responsePayload = (await response.json().catch(() => ({}))) as WhatsAppApiResponse;
  if (!response.ok) {
    throw new Error(getErrorMessage(responsePayload) ?? `WhatsApp API request failed with status ${response.status}`);
  }

  const messageId = responsePayload.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("WhatsApp API response did not include a message id.");
  }

  return {
    status: "queued",
    messageId,
    phone
  };
}

export async function sendWhatsAppText(
  phone: string,
  body: string,
  config?: WhatsAppProviderConfig
): Promise<WhatsAppOutboundResult> {
  return sendWhatsAppPayload(phone, {
    type: "text",
    text: {
      preview_url: true,
      body
    }
  }, config);
}

export async function sendWhatsAppImage(input: {
  phone: string;
  imageUrl: string;
  caption?: string;
  config?: WhatsAppProviderConfig;
}): Promise<WhatsAppOutboundResult> {
  return sendWhatsAppPayload(input.phone, {
    type: "image",
    image: {
      link: input.imageUrl,
      ...(input.caption ? { caption: truncateWhatsAppText(input.caption, 1024) } : {})
    }
  }, input.config);
}

export async function sendWhatsAppInteractiveList(input: {
  phone: string;
  header?: string;
  body: string;
  footer?: string;
  buttonText: string;
  sections: WhatsAppListSection[];
  config?: WhatsAppProviderConfig;
}): Promise<WhatsAppOutboundResult> {
  return sendWhatsAppPayload(input.phone, {
    type: "interactive",
    interactive: {
      type: "list",
      ...(input.header ? { header: { type: "text", text: truncateWhatsAppText(input.header, 60) } } : {}),
      body: { text: truncateWhatsAppText(input.body, 1024) },
      ...(input.footer ? { footer: { text: truncateWhatsAppText(input.footer, 60) } } : {}),
      action: {
        button: truncateWhatsAppText(input.buttonText, 20),
        sections: input.sections.slice(0, 10).map((section) => ({
          title: truncateWhatsAppText(section.title, 24),
          rows: section.rows.slice(0, 10).map((row) => ({
            id: truncateWhatsAppText(row.id, 200),
            title: truncateWhatsAppText(row.title, 24),
            ...(row.description ? { description: truncateWhatsAppText(row.description, 72) } : {})
          }))
        }))
      }
    }
  }, input.config);
}

export async function sendWhatsAppTemplate(input: WhatsAppTemplateInput & { config?: WhatsAppProviderConfig }): Promise<WhatsAppTemplateResult> {
  const { liveSendsEnabled, accessToken, phoneNumberId, graphApiVersion } = getWhatsAppConfig(input.config);

  if (!liveSendsEnabled || !accessToken || !phoneNumberId) {
    return {
      status: "placeholder",
      messageId: placeholderMessageId(),
      templateName: input.templateName,
      phone: input.phone
    };
  }

  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US";
  const components = input.variables.length
    ? [
        {
          type: "body",
          parameters: input.variables.map((text) => ({ type: "text", text }))
        }
      ]
    : undefined;

  const response = await fetch(`https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizeWhatsAppRecipient(input.phone),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: languageCode },
        ...(components ? { components } : {})
      }
    })
  });

  const payload = (await response.json().catch(() => ({}))) as WhatsAppApiResponse;
  if (!response.ok) {
    throw new Error(getErrorMessage(payload) ?? `WhatsApp API request failed with status ${response.status}`);
  }

  const messageId = payload.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("WhatsApp API response did not include a message id.");
  }

  return {
    status: "queued",
    messageId,
    templateName: input.templateName,
    phone: input.phone
  };
}

export function extractWhatsAppInboundMessages(payload: unknown): WhatsAppInboundMessage[] {
  const root = asRecord(payload);
  if (!root) return [];

  return asArray(root.entry).flatMap((entryValue) => {
    const entry = asRecord(entryValue);
    if (!entry) return [];

    return asArray(entry.changes).flatMap((changeValue) => {
      const change = asRecord(changeValue);
      const value = asRecord(change?.value);
      if (!value) return [];

      const metadata = asRecord(value.metadata);
      const phoneNumberId = typeof metadata?.phone_number_id === "string" ? metadata.phone_number_id : undefined;
      const displayPhoneNumber = typeof metadata?.display_phone_number === "string" ? metadata.display_phone_number : undefined;
      const contacts = asArray(value.contacts);

      return asArray(value.messages).flatMap((messageValue): WhatsAppInboundMessage[] => {
        const message = asRecord(messageValue);
        if (!message) return [];

        const providerMessageId = typeof message.id === "string" ? message.id : "";
        const from = typeof message.from === "string" ? message.from : "";
        if (!providerMessageId || !from) return [];

        const contact = contacts
          .map((contactValue) => asRecord(contactValue))
          .find((candidate) => candidate?.wa_id === from);
        const profile = asRecord(contact?.profile);
        const profileName = typeof profile?.name === "string" ? profile.name : undefined;
        const timestampSeconds = typeof message.timestamp === "string" ? Number(message.timestamp) : NaN;
        const timestamp = Number.isFinite(timestampSeconds) ? new Date(timestampSeconds * 1000) : new Date();
        const rawType = typeof message.type === "string" ? message.type : "";

        if (rawType === "text") {
          const text = asRecord(message.text);
          return [{
            providerMessageId,
            from,
            profileName,
            type: "text" as const,
            text: typeof text?.body === "string" ? text.body : "",
            orderItems: [],
            phoneNumberId,
            displayPhoneNumber,
            timestamp
          }];
        }

        if (rawType === "interactive") {
          const interactive = asRecord(message.interactive);
          const listReply = asRecord(interactive?.list_reply);
          const buttonReply = asRecord(interactive?.button_reply);
          const reply = listReply ?? buttonReply;

          return [{
            providerMessageId,
            from,
            profileName,
            type: "interactive" as const,
            interactiveReplyId: typeof reply?.id === "string" ? reply.id : undefined,
            interactiveReplyTitle: typeof reply?.title === "string" ? reply.title : undefined,
            orderItems: [],
            phoneNumberId,
            displayPhoneNumber,
            timestamp
          }];
        }

        if (rawType === "order") {
          const order = asRecord(message.order);
          const productItems = asArray(order?.product_items).flatMap((itemValue): WhatsAppInboundOrderItem[] => {
            const item = asRecord(itemValue);
            if (!item) return [];
            const productRetailerId = typeof item?.product_retailer_id === "string" ? item.product_retailer_id : "";
            if (!productRetailerId) return [];

            const quantity = typeof item.quantity === "string" ? Number(item.quantity) : Number(item.quantity);
            const itemPrice = typeof item.item_price === "string" ? Number(item.item_price) : Number(item.item_price);

            return [{
              productRetailerId,
              quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
              itemPrice: Number.isFinite(itemPrice) ? itemPrice : undefined,
              currency: typeof item.currency === "string" ? item.currency : undefined
            }];
          });

          return [{
            providerMessageId,
            from,
            profileName,
            type: "order" as const,
            orderItems: productItems,
            phoneNumberId,
            displayPhoneNumber,
            timestamp
          }];
        }

        return [{
          providerMessageId,
          from,
          profileName,
          type: "unknown" as const,
          orderItems: [],
          phoneNumberId,
          displayPhoneNumber,
          timestamp
        }];
      });
    });
  });
}

export function verifyWhatsAppWebhookToken(mode: string | null, token: string | null) {
  return mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
}

export function verifyWhatsAppWebhookSignature(rawBody: string, signature: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return process.env.NODE_ENV !== "production";
  if (!signature?.startsWith("sha256=")) return false;

  const receivedHex = signature.slice("sha256=".length);
  if (!/^[a-f0-9]+$/i.test(receivedHex)) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = Buffer.from(receivedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  return received.length === expected.length && timingSafeEqual(received, expected);
}

function mapWhatsAppStatus(status: string): WhatsAppStatusUpdate["status"] | null {
  switch (status) {
    case "sent":
      return "SENT";
    case "delivered":
    case "read":
      return "DELIVERED";
    case "failed":
      return "FAILED";
    default:
      return null;
  }
}

export function extractWhatsAppStatusUpdates(payload: unknown): WhatsAppStatusUpdate[] {
  const root = asRecord(payload);
  if (!root) return [];

  return asArray(root.entry).flatMap((entryValue) => {
    const entry = asRecord(entryValue);
    if (!entry) return [];

    return asArray(entry.changes).flatMap((changeValue) => {
      const change = asRecord(changeValue);
      const value = asRecord(change?.value);
      if (!value) return [];

      return asArray(value.statuses).flatMap((statusValue) => {
        const statusRecord = asRecord(statusValue);
        if (!statusRecord) return [];

        const providerMessageId = typeof statusRecord.id === "string" ? statusRecord.id : "";
        const statusText = typeof statusRecord.status === "string" ? statusRecord.status : "";
        const status = mapWhatsAppStatus(statusText);
        if (!providerMessageId || !status) return [];

        const timestampSeconds = typeof statusRecord.timestamp === "string" ? Number(statusRecord.timestamp) : NaN;
        const timestamp = Number.isFinite(timestampSeconds) ? new Date(timestampSeconds * 1000) : new Date();
        const firstError = asRecord(asArray(statusRecord.errors)[0]);
        const errorMessage = typeof firstError?.message === "string" ? firstError.message : undefined;

        return [{ providerMessageId, status, timestamp, errorMessage }];
      });
    });
  });
}
