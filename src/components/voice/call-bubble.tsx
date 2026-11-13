import Link from "next/link"
import { CallDuration } from "@/components/voice/call-badges"
import type { VoiceCall } from "@/lib/features/voice/types"
import { useI18n } from "@/providers/i18n-provider"
import { cn } from "@/lib/utils"
import { callMeta } from "@/lib/voice-call-meta"

function formatTimeAmPm(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true
	}).format(new Date(value))
}

export function CallBubble({ call }: { call: VoiceCall }) {
	const { t } = useI18n()

	const outbound = call.direction === "outbound"

	const { Icon, labelKey, tone, showDuration, live } = callMeta(call)

	const bad = tone === "bad" || tone === "warn"

	return (
		<div className={cn("flex py-1", outbound ? "justify-end" : "justify-start")}>
			<Link
				href={`/calls/${encodeURIComponent(call.id)}`}
				className={cn(
					"flex min-w-[13rem] max-w-[85%] animate-fade-in items-center gap-3 rounded-2xl px-3 py-2 text-sm shadow-sm transition hover:opacity-90 sm:max-w-[70%]",
					outbound
						? "bubble-out bg-brand-600 text-white"
						: "bubble-in bg-white text-ink-800 dark:bg-ink-800 dark:text-ink-100"
				)}>
				<span
					className={cn(
						"relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
						bad
							? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300"
							: outbound
								? "bg-white/20 text-white"
								: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
					)}>
					{live ? <span className='absolute inset-0 animate-ping rounded-full bg-emerald-400/40' /> : null}
					<Icon className='relative h-4 w-4' aria-hidden='true' />
				</span>

				<span className='min-w-0 flex-1'>
					<span className={cn("block font-medium", bad && !outbound && "text-rose-600 dark:text-rose-300")}>
						{t(labelKey)}
					</span>
					<span
						className={cn(
							"mt-0.5 flex items-center justify-end gap-1 text-[10px]",
							outbound ? "text-brand-100/90" : "text-ink-400"
						)}>
						{showDuration ? (
							<>
								<CallDuration call={call} />
								<span aria-hidden='true'>·</span>
							</>
						) : null}
						<span dir='ltr'>{formatTimeAmPm(call.startedAt)}</span>
					</span>
				</span>
			</Link>
		</div>
	)
}
