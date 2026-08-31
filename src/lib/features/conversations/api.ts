import { fetchAuthorizedBlob, request, unwrapItem, unwrapList, uploadFile } from "@/lib/http"
import type { Conversation, ConversationFilter, Message, MessageType } from "./types"

export interface UploadedMedia {
	mediaId: string
	url: string
	mimeType: string
	filename: string
	size: number
}

export interface SendMessagePayload {
	type: MessageType | (string & {})
	text?: string
	mediaId?: string
}

export const conversationsApi = {
	async list(status: ConversationFilter = "all", signal?: AbortSignal): Promise<Conversation[]> {
		const payload = await request<unknown>(`/conversations?status=${status}`, { signal })
		return unwrapList<Conversation>(payload, "conversations")
	},

	async get(id: string, signal?: AbortSignal): Promise<Conversation> {
		const payload = await request<unknown>(`/conversations/${id}`, { signal })

		return unwrapItem<Conversation>(payload, "conversation")
	},

	async messages(id: string, options: { after?: string; markRead?: boolean; signal?: AbortSignal } = {}): Promise<Message[]> {
		const { after, markRead, signal } = options

		const params = new URLSearchParams()

		if (after) params.set("after", after)
		// Tells the backend to also write conversation_reads for this agent,
		// so the unread badge stays cleared after logout/login. Only pass this
		// for a genuine "the person opened this chat" load — never on a
		// background refresh/prefetch, or badges would clear silently for
		// chats nobody actually looked at.
		if (markRead) params.set("markRead", "true")

		const query = params.toString() ? `?${params.toString()}` : ""

		const payload = await request<unknown>(`/conversations/${id}/messages${query}`, { signal })
		return unwrapList<Message>(payload, "messages")
	},

	/** Debounced "still reading" ping for new inbound messages that arrive
	 *  while the chat is already open — the initial open is already covered
	 *  by `messages({ markRead: true })`, so this is only for the follow-up. */
	async markRead(id: string): Promise<void> {
		await request<void>(`/conversations/${id}/read`, { method: "POST" })
	},

	async sendMessage(id: string, payload: SendMessagePayload, clientMessageId: string): Promise<Message> {
		const body: Record<string, unknown> = { clientMessageId, type: payload.type }

		if (payload.text) body.text = payload.text
		if (payload.mediaId) body.mediaId = payload.mediaId

		const res = await request<unknown>(`/conversations/${id}/messages`, { method: "POST", body })

		return unwrapItem<Message>(res, "message")
	},

	async uploadMedia(file: File, signal?: AbortSignal): Promise<UploadedMedia> {
		return uploadFile<UploadedMedia>("/media", file, signal)
	},

	async mediaBlobUrl(mediaId: string, signal?: AbortSignal): Promise<string> {
		const blob = await fetchAuthorizedBlob(`/media/${mediaId}`, signal)
		return URL.createObjectURL(blob)
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
