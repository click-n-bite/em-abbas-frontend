"use client"

import { CalendarClock, Send } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { DateField } from "@/components/ui/date-field"
import { cn } from "@/lib/utils"
import { LANGUAGES } from "@/lib/features/campaigns/mock"
import type { CampaignDraft, ScheduleMode } from "@/lib/features/campaigns/types"

interface Props {
	draft: CampaignDraft
	onChange: (patch: Partial<CampaignDraft>) => void
	recipientCount: number
}

export function ScheduleReview({ draft, onChange, recipientCount }: Props) {
	const { t, locale } = useI18n()

	const dateLabel = draft.scheduleDate
		? new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { dateStyle: "medium" }).format(
				new Date(`${draft.scheduleDate}T00:00:00`)
			)
		: t("campaigns.schedule.pickDate")

	const modes: { value: ScheduleMode; icon: typeof Send }[] = [
		{ value: "now", icon: Send },
		{ value: "later", icon: CalendarClock }
	]

	const rows = [
		[t("campaigns.summary.name"), draft.name],
		[t("campaigns.summary.category"), t(`campaigns.category.${draft.category}`)],
		[t("campaigns.summary.language"), LANGUAGES.find((language) => language.code === draft.language)?.label ?? ""],
		[t("campaigns.summary.recipients"), String(recipientCount)],
		[
			t("campaigns.summary.when"),
			draft.scheduleMode === "now"
				? t("campaigns.summary.now")
				: t("campaigns.summary.at", { date: dateLabel, time: draft.scheduleTime })
		]
	]

	return (
		<div className='grid gap-4 md:grid-cols-2'>
			<section className='card space-y-3 p-4 md:p-5'>
				<h2 className='flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50'>
					<CalendarClock className='h-4 w-4' aria-hidden='true' />
					{t("campaigns.schedule.title")}
				</h2>

				<div role='radiogroup' aria-label={t("campaigns.schedule.title")} className='space-y-2'>
					{modes.map(({ value, icon: Icon }) => {
						const selected = draft.scheduleMode === value

						return (
							<button
								key={value}
								type='button'
								role='radio'
								aria-checked={selected}
								onClick={() => onChange({ scheduleMode: value })}
								className={cn(
									"flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-start transition",
									selected
										? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30"
										: "border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800/50"
								)}>
								<span
									className={cn(
										"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
										selected ? "border-emerald-500" : "border-ink-300 dark:border-ink-500"
									)}>
									{selected ? <span className='h-2.5 w-2.5 rounded-full bg-emerald-500' /> : null}
								</span>
								<span className='min-w-0 flex-1'>
									<span className='block text-sm font-medium text-ink-900 dark:text-ink-50'>
										{t(`campaigns.schedule.${value}`)}
									</span>
									<span className='block text-xs text-ink-500 dark:text-ink-400'>
										{t(`campaigns.schedule.${value}Hint`)}
									</span>
								</span>
								<Icon className='h-4 w-4 shrink-0 text-ink-400' aria-hidden='true' />
							</button>
						)
					})}
				</div>

				{draft.scheduleMode === "later" ? (
					<div className='grid grid-cols-2 gap-2'>
						<DateField
							value={draft.scheduleDate}
							min={new Date().toISOString().slice(0, 10)}
							display={dateLabel}
							label={t("campaigns.schedule.pickDate")}
							onChange={(next) => onChange({ scheduleDate: next })}
						/>
						<input
							type='time'
							value={draft.scheduleTime}
							onChange={(event) => onChange({ scheduleTime: event.target.value })}
							aria-label={t("campaigns.schedule.pickTime")}
							className='input h-11'
						/>
					</div>
				) : null}
			</section>

			<section className='card p-4 md:p-5'>
				<h2 className='mb-3 text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("campaigns.summary.title")}</h2>
				<dl className='divide-y divide-ink-100 text-sm dark:divide-ink-700'>
					{rows.map(([label, value]) => (
						<div key={label} className='flex items-start justify-between gap-3 py-2.5'>
							<dt className='text-ink-500 dark:text-ink-400'>{label}</dt>
							<dd className='min-w-0 break-words text-end font-medium text-ink-900 dark:text-ink-50'>{value}</dd>
						</div>
					))}
				</dl>
			</section>
		</div>
	)
}
