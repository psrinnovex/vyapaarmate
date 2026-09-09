type Translations = {
  [key: string]: {
    [lang: string]: string;
  };
};

export const whatsappTranslations: Translations = {
  whatsapp_catalog_empty: {
    en: "{{businessName}} has not published any available items or services yet. You can reply here and the team will help you.",
    hi: "{{businessName}} ने अभी तक कोई आइटम या सेवा प्रकाशित नहीं की है। आप यहां उत्तर दे सकते हैं और टीम आपकी मदद करेगी।"
  },
  whatsapp_catalog_menu_body_appointment: {
    en: "Choose a service. After selecting it, reply with your preferred date, time, and any notes. Reply clear to reset your selection.",
    hi: "कोई सेवा चुनें। इसे चुनने के बाद, अपनी पसंद की तारीख, समय और कोई नोट्स के साथ उत्तर दें। अपना चयन रीसेट करने के लिए 'clear' का उत्तर दें।"
  },
  whatsapp_catalog_menu_body_product: {
    en: "Choose an item from the catalog. Reply menu to add more, pay when ready, or clear to empty the cart.",
    hi: "कैटलॉग से कोई आइटम चुनें। अधिक जोड़ने के लिए 'menu' का उत्तर दें, तैयार होने पर भुगतान करें, या कार्ट खाली करने के लिए 'clear' का उत्तर दें।"
  },
  whatsapp_catalog_menu_footer: {
    en: "Reply menu, pay, clear, or help anytime.",
    hi: "किसी भी समय 'menu', 'pay', 'clear' या 'help' का उत्तर दें।"
  },
  whatsapp_catalog_menu_button_appointment: {
    en: "View services",
    hi: "सेवाएं देखें"
  },
  whatsapp_catalog_menu_button_product: {
    en: "View catalog",
    hi: "कैटलॉग देखें"
  },
  whatsapp_item_unavailable: {
    en: "That item or service is not available right now. Reply menu to choose another option.",
    hi: "वह आइटम या सेवा अभी उपलब्ध नहीं है। कोई अन्य विकल्प चुनने के लिए 'menu' का उत्तर दें।"
  },
  whatsapp_booking_started: {
    en: "{{itemName}} is selected for {{orderNumber}}.\n\nReply with your preferred date/time, location if needed, and any notes. Reply clear to reset this selection.",
    hi: "{{itemName}} को {{orderNumber}} के लिए चुना गया है।\n\nअपनी पसंद की तारीख/समय, यदि आवश्यक हो तो स्थान और किसी भी नोट्स के साथ उत्तर दें। अपना चयन रीसेट करने के लिए 'clear' का उत्तर दें।"
  },
  whatsapp_cart_updated: {
    en: "{{orderSummary}}\n\nReply menu to add more items, pay when you are ready, or clear to empty this cart.",
    hi: "{{orderSummary}}\n\nअधिक आइटम जोड़ने के लिए 'menu' का उत्तर दें, तैयार होने पर भुगतान करें, या इस कार्ट को खाली करने के लिए 'clear' का उत्तर दें।"
  },
  whatsapp_no_pending_clear_cart_appointment: {
    en: "There is no pending WhatsApp cart to clear. Reply menu to choose a service.",
    hi: "खाली करने के लिए कोई लंबित WhatsApp कार्ट नहीं है। कोई सेवा चुनने के लिए 'menu' का उत्तर दें।"
  },
  whatsapp_no_pending_clear_cart_product: {
    en: "There is no pending WhatsApp cart to clear. Reply menu to choose items.",
    hi: "खाली करने के लिए कोई लंबित WhatsApp कार्ट नहीं है। आइटम चुनने के लिए 'menu' का उत्तर दें।"
  },
  whatsapp_cart_clear_skipped: {
    en: "This WhatsApp cart was already updated. Reply menu to start again.",
    hi: "यह WhatsApp कार्ट पहले ही अपडेट हो चुका था। फिर से शुरू करने के लिए 'menu' का उत्तर दें।"
  }
};

export function translateWhatsAppTemplate(
  templateKey: string,
  lang: string,
  variables?: Record<string, string>
): string {
  const template = whatsappTranslations[templateKey];
  if (!template) return templateKey;

  let text = template[lang] || template["en"];
  if (!text) return templateKey;

  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      text = text.replace(new RegExp(`{{${key}}}`, "g"), value);
    }
  }
  return text;
}
