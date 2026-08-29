import { request, unwrapItem, unwrapList } from "@/lib/http"
import type { Conversation, ConversationFilter, Message } from "./types"

export const conversationsApi = {
	async list(status: ConversationFilter = "all", signal?: AbortSignal): Promise<Conversation[]> {
		const payload = await request<unknown>(`/conversations?status=${status}`, { signal })
		return unwrapList<Conversation>(payload, "conversations")
	},

	async get(id: string, signal?: AbortSignal): Promise<Conversation> {
		const payload = await request<unknown>(`/conversations/${id}`, { signal })

		return unwrapItem<Conversation>(payload, "conversation")
	},

	async messages(id: string, after?: string, signal?: AbortSignal): Promise<Message[]> {
		const query = after ? `?after=${encodeURIComponent(after)}` : ""

		const payload = await request<unknown>(`/conversations/${id}/messages${query}`, { signal })
		return unwrapList<Message>(payload, "messages")
	},

	async sendMessage(id: string, text: string, clientMessageId: string): Promise<Message> {
		const payload = await request<unknown>(`/conversations/${id}/messages`, {
			method: "POST",
			body: { clientMessageId, type: "text", text }
		})

		return unwrapItem<Message>(payload, "message")
	},

	async takeover(id: string): Promise<Conversation> {
		const payload = await request<unknown>(`/conversations/${id}/takeover`, { method: "POST" })

		return unwrapItem<Conversation>(payload, "conversation")
	},

	async handoffToAi(id: string): Promise<Conversation> {
		const payload = await request<unknown>(`/conversations/${id}/handoff-to-ai`, {
			method: "POST"
		})

		return unwrapItem<Conversation>(payload, "conversation")
	}
}
