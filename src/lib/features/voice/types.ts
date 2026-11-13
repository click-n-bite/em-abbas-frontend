export type VoiceCallStatus =
	| "incoming"
	| "ringing"
	| "in_progress"
	| "completed"
	| "missed"
	| "rejected"
	| "failed"
	| "unknown"

/** Statuses the backend groups under `status=active`. */
export const ACTIVE_VOICE_STATUSES: readonly VoiceCallStatus[] = ["incoming", "ringing", "in_progress"]

export type VoiceCallStatusFilter = "all" | "active" | VoiceCallStatus

export interface VoiceCall {
	id: string
	phone: string
	/** Null until the call is linked to a customer. */
	customerId: number | null
	customerName: string | null
	/** Null until the call is linked to a conversation. */
	conversationId: string | null
	channel: string
	direction: string
	status: VoiceCallStatus
	startedAt: string
	answeredAt: string | null
	endedAt: string | null
	/** Null while the end is not confirmed. */
	durationMs: number | null
	talkDurationMs: number | null
	endCause: string | null
	lastObservedAt: string | null
	updatedAt: string | null
}

export interface VoiceCallsPage {
	items: VoiceCall[]
	page: number
	size: number
	total: number
	totalPages: number
}

export interface VoiceCallsListParams {
	search?: string
	channel?: string
	status?: VoiceCallStatusFilter
	conversationId?: string
	/** ISO timestamp, inclusive. */
	from?: string
	/** ISO timestamp, exclusive. */
	to?: string
	page?: number
	size?: number
}

export interface VoiceCallsCountParams {
	from?: string
	to?: string
}

export interface VoiceCallsCount {
	totalCalls: number
}

export type VoiceTranscriptSpeaker = "caller" | "ai"

export interface VoiceTranscriptItem {
	id: string
	sequence: number
	speaker: VoiceTranscriptSpeaker
	text: string
	occurredAt: string
	/** e.g. `recognized`, `generated_playback_unconfirmed`. */
	deliveryState: string | null
	interrupted: boolean
	playedAudioOffsetMs: number | null
	playbackLimited: boolean
}

export interface VoiceTranscript {
	callId: string
	/** `available` when the transcript is complete enough to trust. */
	availability: string
	reasons: string[]
	historyEnded: boolean
	lastEventSequence: number | null
	lastUpdatedAt: string | null
	total: number
	items: VoiceTranscriptItem[]
	hasMore: boolean
	nextAfterSequence: number | null
}

export interface VoiceTranscriptParams {
	afterSequence?: number
	size?: number
}

export type VoiceEventName = "voice.call.updated" | "voice.call.ended" | "voice.transcript.updated"

/** WebSocket refresh hint. Carries no phone, transcript text or call record. */
export interface VoiceRealtimeEvent {
	schemaVersion: number
	eventId: string
	event: VoiceEventName
	callId: string
	conversationId: string | null
	source?: string
	sequence?: number
	reason?: string
	occurredAt: string
}
