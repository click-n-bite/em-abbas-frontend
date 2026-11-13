import { request, unwrapItem } from "@/lib/http"
import type {
	VoiceCall,
	VoiceCallsCount,
	VoiceCallsCountParams,
	VoiceCallsListParams,
	VoiceCallsPage,
	VoiceTranscript,
	VoiceTranscriptParams
} from "./types"

/** Upper bound for auto-paging a transcript (25 pages x 200 turns). */
const MAX_TRANSCRIPT_PAGES = 25

function listQuery(params: VoiceCallsListParams): string {
	const search = new URLSearchParams()

	if (params.search) search.set("search", params.search)

	if (params.channel) search.set("channel", params.channel)

	if (params.status && params.status !== "all") search.set("status", params.status)

	if (params.from) search.set("from", params.from)

	if (params.to) search.set("to", params.to)

	search.set("page", String(params.page ?? 0))
	search.set("size", String(params.size ?? 20))

	return search.toString()
}

function encode(id: string): string {
	return encodeURIComponent(id)
}

export const voiceApi = {
	async count(params: VoiceCallsCountParams = {}, signal?: AbortSignal): Promise<VoiceCallsCount> {
		const search = new URLSearchParams()

		if (params.from) search.set("from", params.from)

		if (params.to) search.set("to", params.to)

		const query = search.toString() ? `?${search.toString()}` : ""

		const payload = await request<unknown>(`/v1/voice/calls/count${query}`, {
			signal
		})

		return unwrapItem<VoiceCallsCount>(payload, "data")
	},

	async list(params: VoiceCallsListParams = {}, signal?: AbortSignal): Promise<VoiceCallsPage> {
		const payload = await request<unknown>(`/v1/voice/calls?${listQuery(params)}`, { signal })

		return unwrapItem<VoiceCallsPage>(payload, "data")
	},

	async get(callId: string, signal?: AbortSignal): Promise<VoiceCall> {
		const payload = await request<unknown>(`/v1/voice/calls/${encode(callId)}`, {
			signal
		})

		return unwrapItem<VoiceCall>(payload, "data")
	},

	async conversationCalls(
		conversationId: string,
		params: VoiceCallsListParams = {},
		signal?: AbortSignal
	): Promise<VoiceCallsPage> {
		const payload = await request<unknown>(`/v1/conversations/${encode(conversationId)}/calls?${listQuery(params)}`, {
			signal
		})

		return unwrapItem<VoiceCallsPage>(payload, "data")
	},

	/** One page of the transcript. */
	async transcriptPage(
		callId: string,
		params: VoiceTranscriptParams = {},
		signal?: AbortSignal
	): Promise<VoiceTranscript> {
		const search = new URLSearchParams()

		search.set("afterSequence", String(params.afterSequence ?? 0))
		search.set("size", String(params.size ?? 100))

		const payload = await request<unknown>(`/v1/voice/calls/${encode(callId)}/transcript?${search.toString()}`, {
			signal
		})

		return unwrapItem<VoiceTranscript>(payload, "data")
	},

	/**
	 * The whole transcript, always read from `afterSequence=0`: a late event can
	 * change interruption or playback info of an earlier AI turn, so a live
	 * update must never be merged onto a cached copy.
	 */
	async transcript(callId: string, signal?: AbortSignal): Promise<VoiceTranscript> {
		let afterSequence = 0

		let last: VoiceTranscript | null = null

		const items = new Map<string, VoiceTranscript["items"][number]>()

		for (let page = 0; page < MAX_TRANSCRIPT_PAGES; page += 1) {
			const result = await voiceApi.transcriptPage(callId, { afterSequence, size: 200 }, signal)

			last = result
			;(result.items ?? []).forEach((item) => items.set(item.id, item))

			const next = result.nextAfterSequence

			if (!result.hasMore || next == null || next <= afterSequence) break

			afterSequence = next
		}

		const ordered = [...items.values()].sort((a, b) => a.sequence - b.sequence)

		return {
			...(last as VoiceTranscript),
			reasons: last?.reasons ?? [],
			items: ordered
		}
	}
}
