import { request, unwrapItem, unwrapList } from "@/lib/http"
import type {
	ChatSuggestion,
	Contact,
	ContactEvent,
	ContactInput,
	ContactSuggestion,
	ContactsListParams,
	ContactsPage,
	SaveFromChatInput
} from "./types"

type Query = Record<string, string | number | boolean | undefined | null>

async function call<T>(
	method: "GET" | "POST" | "PATCH" | "DELETE",
	path: string,
	options: { query?: Query; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
	const params = new URLSearchParams()

	for (const [key, value] of Object.entries(options.query ?? {})) {
		if (value !== undefined && value !== null && value !== "") params.set(key, String(value))
	}

	const suffix = params.toString() ? `?${params.toString()}` : ""

	return request<T>(`/api/contacts${path}${suffix}`, {
		method,
		body: options.body,
		signal: options.signal
	})
}

function contactOf(payload: unknown): Contact {
	return unwrapItem<Contact>(payload, "contact")
}

function pageOf(payload: unknown): ContactsPage {
	const record =
		payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {}

	const root =
		record.data && typeof record.data === "object" && !Array.isArray(record.data)
			? (record.data as Record<string, unknown>)
			: record

	const items = unwrapList<Contact>(payload, "items")

	return {
		...root,
		items: items.length > 0 ? items : unwrapList<Contact>(payload, "content")
	} as unknown as ContactsPage
}

export const contactsApi = {
	async list(params: ContactsListParams = {}, signal?: AbortSignal): Promise<ContactsPage> {
		const result = await call<unknown>("GET", "", {
			signal,
			query: {
				search: params.search,
				trusted: params.trusted,
				linked: params.linked,
				sort: params.sort,
				direction: params.direction,
				page: params.page ?? 0,
				size: params.size ?? 20
			}
		})

		return pageOf(result)
	},

	async get(id: number, signal?: AbortSignal): Promise<Contact> {
		return contactOf(await call<unknown>("GET", `/${id}`, { signal }))
	},

	async create(input: ContactInput): Promise<Contact> {
		return contactOf(await call<unknown>("POST", "", { body: input }))
	},

	async update(id: number, input: ContactInput): Promise<Contact> {
		return contactOf(await call<unknown>("PATCH", `/${id}`, { body: input }))
	},

	/** Admin only. */
	remove(id: number) {
		return call<null>("DELETE", `/${id}`)
	},

	async events(id: number, signal?: AbortSignal): Promise<ContactEvent[]> {
		return unwrapList<ContactEvent>(await call<unknown>("GET", `/${id}/events`, { signal }), "events")
	},

	async link(id: number, conversationId: string): Promise<Contact> {
		return contactOf(await call<unknown>("POST", `/${id}/links`, { body: { conversationId } }))
	},

	async unlink(id: number, customerId: number): Promise<Contact> {
		return contactOf(await call<unknown>("DELETE", `/${id}/links/${customerId}`))
	},

	async chatSuggestions(id: number, signal?: AbortSignal): Promise<ChatSuggestion[]> {
		return unwrapList<ChatSuggestion>(await call<unknown>("GET", `/${id}/suggestions`, { signal }), "suggestions")
	},

	async contactSuggestions(conversationId: string, signal?: AbortSignal): Promise<ContactSuggestion[]> {
		return unwrapList<ContactSuggestion>(
			await call<unknown>("GET", "/suggestions", { signal, query: { conversationId } }),
			"suggestions"
		)
	},

	async fromConversation(conversationId: string, input: SaveFromChatInput = {}): Promise<Contact> {
		return contactOf(
			await call<unknown>("POST", `/from-conversation/${encodeURIComponent(conversationId)}`, { body: input })
		)
	}
}
