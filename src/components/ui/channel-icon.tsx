import {
	Camera,
	Globe,
	Mail,
	MessageCircle,
	MessageSquare,
	MessagesSquare,
	Music2,
	Send,
	Smartphone
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChannelStyle {
	icon: LucideIcon
	background: string
}

const STYLES: Record<string, ChannelStyle> = {
	whatsapp: { icon: MessageCircle, background: "#25D366" },
	telegram: { icon: Send, background: "#229ED9" },
	instagram: {
		icon: Camera,
		background: "linear-gradient(45deg,#F9CE34 0%,#EE2A7B 50%,#6228D7 100%)"
	},
	facebook: { icon: MessagesSquare, background: "#1877F2" },
	messenger: { icon: MessagesSquare, background: "#0A7CFF" },
	tiktok: { icon: Music2, background: "#111111" },
	sms: { icon: Smartphone, background: "#16A34A" },
	email: { icon: Mail, background: "#64748B" },
	web: { icon: Globe, background: "#6366F1" },
	webchat: { icon: Globe, background: "#6366F1" }
}

const FALLBACK: ChannelStyle = { icon: MessageSquare, background: "#64748B" }

const SIZES = {
	xs: { box: "h-4 w-4", icon: "h-2.5 w-2.5" },
	sm: { box: "h-5 w-5", icon: "h-3 w-3" },
	md: { box: "h-8 w-8", icon: "h-4 w-4" },
	lg: { box: "h-10 w-10", icon: "h-5 w-5" }
} as const

interface Props {
	channel?: string | null
	size?: keyof typeof SIZES
	className?: string
}

export function ChannelIcon({ channel, size = "sm", className }: Props) {
	const style = STYLES[(channel ?? "whatsapp").toLowerCase()] ?? FALLBACK

	const Icon = style.icon

	return (
		<span
			aria-hidden='true'
			style={{ background: style.background }}
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-full text-white",
				SIZES[size].box,
				className
			)}>
			<Icon className={SIZES[size].icon} />
		</span>
	)
}
