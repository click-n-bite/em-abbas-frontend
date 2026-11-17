import {
	AtSign,
	Facebook,
	Globe,
	HelpCircle,
	Instagram,
	MessageCircle,
	Music2,
	Phone,
	Send,
	Twitter,
	type LucideIcon
} from "lucide-react"
import { channelKeyOf, type ChannelKey } from "@/lib/channels"
import { useI18n } from "@/providers/i18n-provider"
import { cn } from "@/lib/utils"

const STYLE: Record<ChannelKey, { Icon: LucideIcon; tone: string }> = {
	whatsapp: {
		Icon: MessageCircle,
		tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
	},
	instagram: {
		Icon: Instagram,
		tone: "bg-pink-50 text-pink-700 dark:bg-pink-900/40 dark:text-pink-200"
	},
	facebook: {
		Icon: Facebook,
		tone: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
	},
	telegram: {
		Icon: Send,
		tone: "bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200"
	},
	tiktok: {
		Icon: Music2,
		tone: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-200"
	},
	threads: {
		Icon: AtSign,
		tone: "bg-ink-100 text-ink-800 dark:bg-ink-700 dark:text-ink-100"
	},
	twitter: {
		Icon: Twitter,
		tone: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200"
	},
	web: {
		Icon: Globe,
		tone: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
	},
	sip: {
		Icon: Phone,
		tone: "bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200"
	},
	unknown: {
		Icon: HelpCircle,
		tone: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200"
	}
}

export function ChannelBadge({
	channel,
	iconOnly = false,
	className
}: {
	channel?: string | null
	iconOnly?: boolean
	className?: string
}) {
	const { t } = useI18n()

	const key = channelKeyOf(channel)

	const { Icon, tone } = STYLE[key]

	const label = key === "unknown" ? channel?.trim() || t("channels.unknown") : t(`channels.${key}`)

	return (
		<span className={cn("badge whitespace-nowrap", tone, className)} title={label}>
			<Icon className='h-3 w-3' aria-hidden='true' />
			{iconOnly ? <span className='sr-only'>{label}</span> : label}
		</span>
	)
}
