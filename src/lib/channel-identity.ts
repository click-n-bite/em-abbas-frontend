/** Optional fields keep historical phone-only responses readable during rollout. */
export interface ChannelIdentity {
  contractVersion?: number;
  channel?: string;
  connectionId?: string;
  customerId?: number;
  conversationId?: string | null;
  phone?: string | null;
  whatsappUserId?: string | null;
  externalUserType?: string;
  externalUserId?: string;
  externalConversationType?: string;
  externalConversationId?: string;
  replyDestinationType?: string;
  replyDestinationId?: string;
}

type Contact = ChannelIdentity & {
  id?: string | number;
  customerName?: string | null;
  /** Country of residence the customer typed to the bot, when they have answered. */
  customerCountry?: string | null;
};

export function contactIdentifier(contact: Contact): string {
  return (
    contact.phone ||
    contact.externalUserId ||
    contact.whatsappUserId ||
    contact.externalConversationId ||
    contact.conversationId ||
    String(contact.id ?? "")
  );
}

export function contactName(contact: Contact): string {
  return contact.customerName?.trim() || contactIdentifier(contact);
}

/** "Name - Country" when the customer has told us their country; just the name otherwise. */
export function contactNameWithCountry(contact: Contact): string {
  const country = contact.customerCountry?.trim();

  return country
    ? `${contactName(contact)} - ${country}`
    : contactName(contact);
}

/** The country a lead's customer typed (a lead stores its own copy of their answers). */
export function leadCountry(lead: {
  collectedFields?: Record<string, unknown> | null;
}): string | null {
  const value = lead.collectedFields?.country;

  if (typeof value !== "string") return null;

  const country = value.trim();

  return country && country.length <= 100 && country !== "__skipped__"
    ? country
    : null;
}

/** "Name - Country" for a lead; just the name when no country was given. */
export function leadNameWithCountry(
  lead: Contact & { collectedFields?: Record<string, unknown> | null },
): string {
  return contactNameWithCountry({
    ...lead,
    customerCountry: lead.customerCountry ?? leadCountry(lead),
  });
}

export function contactSearchText(contact: Contact): string {
  return [
    contact.customerName,
    contact.customerCountry,
    contact.phone,
    contact.whatsappUserId,
    contact.externalUserId,
    contact.externalConversationId,
    contact.connectionId,
    contact.conversationId,
    contact.id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** V2 aggregate block state includes identity and phone blocks; never overwrite it. */
export function reconcileConversationBlock<
  T extends ChannelIdentity & {
    blocked?: boolean;
    identityBlocked?: boolean;
    whatsappStatus?: string | null;
  },
>(conversation: T, phoneEntry?: { whatsappStatus: string | null }): T {
  if (typeof conversation.blocked === "boolean") return conversation;

  if (conversation.identityBlocked) return { ...conversation, blocked: true };

  return phoneEntry
    ? {
        ...conversation,
        blocked: true,
        whatsappStatus: phoneEntry.whatsappStatus,
      }
    : conversation;
}
