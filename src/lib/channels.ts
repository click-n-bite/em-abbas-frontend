export type ChannelKey =
	| "whatsapp"
	| "instagram"
	| "facebook"
	| "telegram"
	| "tiktok"
	| "threads"
	| "twitter"
	| "web"
	| "sip"
	| "unknown"

export interface ChannelCapabilities {
	serviceWindow: boolean
	templates: boolean
	readReceipts: boolean
	deliveryStatus: boolean
	blockByNumber: boolean
	messageFirst: boolean
	phoneIdentity: boolean
	voiceNotes: boolean
	media: { image: boolean; audio: boolean; video: boolean; document: boolean }
}

const NONE: ChannelCapabilities = {
	serviceWindow: false,
	templates: false,
	readReceipts: false,
	deliveryStatus: false,
	blockByNumber: false,
	messageFirst: false,
	phoneIdentity: false,
	voiceNotes: false,
	media: { image: false, audio: false, video: false, document: false }
}

const ALL_MEDIA = { image: true, audio: true, video: true, document: true }

export const CHANNELS: Record<
	Exclude<ChannelKey, "unknown">,
	{ aliases: string[]; capabilities: ChannelCapabilities }
> = {
	whatsapp: {
		aliases: ["wa"],
		capabilities: {
			serviceWindow: true,
			templates: true,
			readReceipts: true,
			deliveryStatus: true,
			blockByNumber: true,
			messageFirst: true,
			phoneIdentity: true,
			voiceNotes: true,
			media: ALL_MEDIA
		}
	},
	instagram: {
		aliases: ["ig", "instagram_dm"],
		capabilities: {
			...NONE,
			serviceWindow: true,
			readReceipts: true,
			deliveryStatus: true,
			voiceNotes: true,
			media: { image: true, audio: true, video: true, document: false }
		}
	},
	facebook: {
		aliases: ["messenger", "fb"],
		capabilities: {
			...NONE,
			serviceWindow: true,
			readReceipts: true,
			deliveryStatus: true,
			voiceNotes: true,
			media: ALL_MEDIA
		}
	},
	telegram: {
		aliases: ["tg"],
		capabilities: {
			...NONE,
			voiceNotes: true,
			media: ALL_MEDIA
		}
	},
	tiktok: {
		aliases: ["tt"],
		capabilities: {
			...NONE,
			serviceWindow: true,
			media: { image: true, audio: false, video: false, document: false }
		}
	},
	threads: {
		aliases: [],
		capabilities: {
			...NONE,
			media: { image: true, audio: false, video: false, document: false }
		}
	},
	twitter: {
		aliases: ["x", "x.com"],
		capabilities: {
			...NONE,
			deliveryStatus: true,
			messageFirst: true,
			media: { image: true, audio: false, video: true, document: false }
		}
	},
	web: {
		aliases: ["webchat", "widget"],
		capabilities: {
			...NONE,
			deliveryStatus: true,
			media: { image: true, audio: false, video: false, document: true }
		}
	},
	sip: {
		aliases: ["voice"],
		capabilities: { ...NONE, phoneIdentity: true }
	}
}

const ALIAS_TO_KEY = new Map<string, ChannelKey>()

for (const [key, def] of Object.entries(CHANNELS)) {
	ALIAS_TO_KEY.set(key, key as ChannelKey)
	def.aliases.forEach((alias) => ALIAS_TO_KEY.set(alias, key as ChannelKey))
}

export function channelKeyOf(channel?: string | null): ChannelKey {
	const raw = channel?.trim().toLowerCase()

	return (raw && ALIAS_TO_KEY.get(raw)) || "unknown"
}

export function capabilitiesFor(channel?: string | null): ChannelCapabilities {
	const key = channelKeyOf(channel)

	return key === "unknown" ? NONE : CHANNELS[key].capabilities
}

export function matchesChannel(channel: string | null | undefined, filter: ChannelKey | "all"): boolean {
	return filter === "all" || channelKeyOf(channel) === filter
}

export function listChannels(items: { channel?: string | null }[]): { key: ChannelKey; count: number }[] {
	const counts = new Map<ChannelKey, number>()

	for (const item of items) {
		const key = channelKeyOf(item.channel)

		counts.set(key, (counts.get(key) ?? 0) + 1)
	}

	const order = Object.keys(CHANNELS) as ChannelKey[]

	return [...counts.entries()]
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => {
			const ai = order.indexOf(a.key)

			const bi = order.indexOf(b.key)

			return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
		})
}
