import type { Mode } from "@/lib/features/conversations/types"

export interface AppNotification {
	id: string
	type: string
	title: string
	body: string | null
	read: boolean
	conversationId: string | null
	phone: string | null
	mode: Mode | null
	preview: string | null
	createdAt: string
}
