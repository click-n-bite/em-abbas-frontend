export const SKIPPED_VALUE = "__skipped__";

const PERSONAL_FIELDS = [
  "full_name",
  "mother_name",
  "age",
  "country",
  "nationality",
  "marital_status",
  "follows_on_social",
];

const CONTACT_FIELDS = [
  "contacted_om_abbas",
  "prior_contact_when",
  "prior_contact_service",
];

const MEDIA_PATH = /^\/media\/([A-Za-z0-9_-]+)\/?$/;

const IMAGE_FIELD = /(?:^|_)(?:photo|image)s?(?:_\d+)?$/;

export type CollectedEntry = [key: string, value: unknown];

export interface LeadPhoto {
  fieldKey: string;
  value: unknown;
  index: number;
}

export function mediaIdOf(value: unknown): string | null {
  if (typeof value !== "string") return null;

  return MEDIA_PATH.exec(value.trim())?.[1] ?? null;
}

export function imageUrlOf(value: unknown): string | null {
  if (typeof value !== "string") return null;

  return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}

export function formatCollectedValue(value: unknown): string {
  if (value === null || value === undefined) return "—";

  if (typeof value === "string") return value;

  if (typeof value === "number" || typeof value === "boolean")
    return String(value);

  return JSON.stringify(value) ?? "—";
}

function isVisible(value: unknown): boolean {
  if (value === null || value === undefined) return false;

  if (typeof value === "string") return value.trim().length > 0;

  if (Array.isArray(value)) return value.length > 0;

  return true;
}

function isPhotoField(key: string, value: unknown): boolean {
  return (
    IMAGE_FIELD.test(key) ||
    mediaIdOf(value) !== null ||
    (Array.isArray(value) && value.some((item) => mediaIdOf(item) !== null))
  );
}

function photosFor(key: string, value: unknown): LeadPhoto[] {
  const values = Array.isArray(value) ? [...new Set(value)] : [value];

  return values.map((item, index) => ({ fieldKey: key, value: item, index }));
}

export function groupCollectedFields(fields: Record<string, unknown>) {
  const visible = Object.entries(fields).filter(
    ([key, value]) => !key.startsWith("__") && isVisible(value),
  );

  const entries = new Map(visible);

  const orderedEntries = (keys: string[]): CollectedEntry[] =>
    keys.flatMap((key) =>
      entries.has(key) ? [[key, entries.get(key)] as CollectedEntry] : [],
    );

  const personal = orderedEntries(PERSONAL_FIELDS);

  const contact = orderedEntries(CONTACT_FIELDS);

  const service: CollectedEntry[] = [];

  const servicePhotos: LeadPhoto[] = [];

  const previousPhotos: LeadPhoto[] = [];

  const sharedKeys = new Set([...PERSONAL_FIELDS, ...CONTACT_FIELDS]);

  for (const [key, value] of visible) {
    if (key === "prior_contact_photos") {
      if (value === SKIPPED_VALUE) {
        contact.push([key, value]);
      } else {
        previousPhotos.push(...photosFor(key, value));
      }
    } else if (!sharedKeys.has(key)) {
      // Keep unknown service questions. A lead's answers are authoritative;
      // rendering must not depend on a fixed list of supported services.
      if (value !== SKIPPED_VALUE && isPhotoField(key, value)) {
        servicePhotos.push(...photosFor(key, value));
      } else {
        service.push([key, value]);
      }
    }
  }

  return { personal, contact, service, servicePhotos, previousPhotos };
}
