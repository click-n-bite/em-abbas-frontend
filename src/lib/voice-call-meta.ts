import { Phone, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing } from "lucide-react"
import type { VoiceCall } from "@/lib/features/voice/types"

export type CallTone = "ok" | "bad" | "warn" | "neutral"

export function callMeta(call: VoiceCall) {
	const outgoing = call.direction === "outbound"

	switch (call.status) {
		case "incoming":
		case "ringing":
			return {
				Icon: outgoing ? PhoneOutgoing : PhoneIncoming,
				labelKey: outgoing ? "calls.bubble.calling" : "calls.bubble.ringing",
				tone: "ok" as CallTone,
				showDuration: false,
				live: true
			}

		case "in_progress":
			return {
				Icon: PhoneCall,
				labelKey: "calls.bubble.ongoing",
				tone: "ok" as CallTone,
				showDuration: false,
				live: true
			}

		// Finished normally
		case "completed":
			return {
				Icon: outgoing ? PhoneOutgoing : PhoneIncoming,
				labelKey: outgoing ? "calls.bubble.outgoing" : "calls.bubble.incoming",
				tone: "ok" as CallTone,
				showDuration: true,
				live: false
			}

		case "missed":
			return {
				Icon: PhoneMissed,
				labelKey: outgoing ? "calls.bubble.noAnswer" : "calls.bubble.missed",
				tone: "bad" as CallTone,
				showDuration: false,
				live: false
			}

		case "rejected":
			return {
				Icon: PhoneOff,
				labelKey: outgoing ? "calls.bubble.declined" : "calls.bubble.rejected",
				tone: "bad" as CallTone,
				showDuration: false,
				live: false
			}

		case "failed":
			return {
				Icon: PhoneOff,
				labelKey: "calls.bubble.failed",
				tone: "warn" as CallTone,
				showDuration: false,
				live: false
			}

		default:
			return {
				Icon: Phone,
				labelKey: "calls.bubble.generic",
				tone: "neutral" as CallTone,
				showDuration: false,
				live: false
			}
	}
}
