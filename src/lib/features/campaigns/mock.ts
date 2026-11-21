import type { CampaignCategory, CampaignContact, CampaignDraft } from "./types"

export const CATEGORIES: CampaignCategory[] = ["marketing", "utility", "authentication"]

export const LANGUAGES = [
	{ code: "en", label: "English" },
	{ code: "ar", label: "العربية" }
]

export const BODY_LIMIT = 1024

export const EMPTY_DRAFT: CampaignDraft = {
	name: "",
	category: "marketing",
	language: "en",
	header: { enabled: false, text: "" },
	body: "Hello {{1}},\n\nEnjoy our special November offer: 30% off selected items. Visit us this weekend!",
	footer: { enabled: false, text: "" },
	buttons: { enabled: true, items: ["Shop Now", "View Offers"] },
	scheduleMode: "now",
	scheduleDate: "",
	scheduleTime: "09:00"
}

const NAMES = [
	"Sarah Khalil",
	"Omar Nader",
	"Lina Haddad",
	"Karim Saab",
	"Maya Aoun",
	"Hadi Fares",
	"Nour Salem",
	"Rami Daher"
]

const TAG_SETS = [["VIP", "Recent Buyer"], ["New Lead"], ["VIP", "New Lead"], ["Recent Buyer"]]

export const MOCK_CONTACTS: CampaignContact[] = Array.from({ length: 32 }, (_, i) => ({
	id: `c${i + 1}`,
	name: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ""}`,
	phone: `+961 7${i % 10} ${String(200 + i * 13).slice(0, 3)} ${String(100 + i * 37).slice(0, 3)}`,
	tags: TAG_SETS[i % TAG_SETS.length]
}))

/** Minimal CSV reader: name,phone,tags (tags separated by ; or |). */
export function parseContactsCsv(text: string): CampaignContact[] {
	const rows = text
		.split(/\r?\n/)
		.map((line) => line.split(",").map((cell) => cell.trim()))
		.filter((cells) => cells.some(Boolean))

	if (rows[0]?.some((cell) => /phone/i.test(cell))) rows.shift()

	const stamp = Date.now()

	return rows
		.filter((cells) => cells[1])
		.map((cells, index) => ({
			id: `imp-${stamp}-${index}`,
			name: cells[0] || cells[1],
			phone: cells[1],
			tags: (cells[2] ?? "")
				.split(/[;|]/)
				.map((tag) => tag.trim())
				.filter(Boolean)
		}))
}

export function renderBody(body: string, name = "Sarah"): string {
	return body.replace(/\{\{1\}\}/g, name)
}

export function validateDraft(draft: CampaignDraft, recipients: number): string | null {
	if (!draft.name.trim()) return "campaigns.errors.name"

	if (!draft.body.trim()) return "campaigns.errors.body"

	if (recipients === 0) return "campaigns.errors.recipients"

	if (draft.scheduleMode === "later" && !draft.scheduleDate) return "campaigns.errors.schedule"

	return null
}

/** Returns an i18n error key for the given wizard step (0 template, 1 recipients, 2 schedule). */
export function validateStep(step: number, draft: CampaignDraft, recipients: number): string | null {
	if (step === 0) {
		if (!draft.name.trim()) return "campaigns.errors.name"

		if (!draft.body.trim()) return "campaigns.errors.body"
	}

	if (step === 1 && recipients === 0) return "campaigns.errors.recipients"

	if (step === 2 && draft.scheduleMode === "later" && !draft.scheduleDate) return "campaigns.errors.schedule"

	return null
}
