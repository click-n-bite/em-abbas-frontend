"use client"

import { CalendarClock, Eye, Send, Tag } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { DateField } from "@/components/ui/date-field"
import { cn, textDirOf } from "@/lib/utils"
import { renderBody } from "@/lib/features/campaigns/mock"
import type { CampaignDraft, ScheduleMode } from "@/lib/features/campaigns/types"

interface Props {
	draft: CampaignDraft
	recipientCount: number
	onChange: (patch: Partial<CampaignDraft>) => void
	onSendTest: () => void
	onReview: () => void
}

export function PreviewSend({ draft, recipientCount, onChange, onSendTest, onReview }: Props) {
	const { t, locale } = useI18n()

	const buttons = draft.buttons.enabled ? draft.buttons.items.filter((item) => item.trim()) : []

	const dateLabel = draft.scheduleDate
		? new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { dateStyle: "medium" }).format(
				new Date(`${draft.scheduleDate}T00:00:00`)
			)
		: t("campaigns.schedule.pickDate")

	const modes: { value: ScheduleMode; icon: typeof Send }[] = [
		{ value: "now", icon: Send },
		{ value: "later", icon: CalendarClock }
	]

	return (
		<section className='card flex min-h-0 flex-col'>
			<header className='flex items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-700'>
				<span className='flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200'>
					<Eye className='h-5 w-5' aria-hidden='true' />
				</span>
				<div className='min-w-0'>
					<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("campaigns.preview.title")}</h2>
					<p className='text-xs text-ink-500 dark:text-ink-400'>{t("campaigns.preview.subtitle")}</p>
				</div>
			</header>

			<div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
				{/* Phone mock */}
				<div className='mx-auto w-full max-w-[17rem] rounded-[2rem] border-[6px] border-ink-900 bg-ink-900 shadow-lg dark:border-ink-600 dark:bg-ink-600'>
					<div className='overflow-hidden rounded-[1.5rem] bg-emerald-50/70 dark:bg-ink-800'>
						<div className='flex items-center gap-2 bg-white px-3 py-2 dark:bg-ink-900'>
							<span className='flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white'>
								B
							</span>
							<div className='min-w-0 leading-tight'>
								<p className='truncate text-xs font-semibold text-ink-900 dark:text-ink-50'>
									{t("campaigns.preview.business")}
								</p>
								<p className='text-[10px] text-ink-400'>{t("campaigns.preview.businessAccount")}</p>
							</div>
						</div>

						<div className='min-h-[16rem] space-y-1.5 p-3'>
							<p className='mx-auto w-fit rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-ink-500 dark:bg-ink-700 dark:text-ink-300'>
								{t("campaigns.preview.today")}
							</p>
							<div className='rounded-xl rounded-ss-sm bg-white p-2.5 shadow-sm dark:bg-ink-700'>
								{draft.header.enabled && draft.header.text ? (
									<p
										dir={textDirOf(draft.header.text)}
										className='mb-1 text-xs font-bold text-ink-900 dark:text-ink-50'>
										{draft.header.text}
									</p>
								) : null}
								<p
									dir={textDirOf(draft.body)}
									className='whitespace-pre-wrap break-words text-xs leading-5 text-ink-900 dark:text-ink-50'>
									{renderBody(draft.body)}
								</p>
								{draft.footer.enabled && draft.footer.text ? (
									<p dir={textDirOf(draft.footer.text)} className='mt-1 text-[10px] text-ink-400'>
										{draft.footer.text}
									</p>
								) : null}
								<p className='mt-1 text-end text-[10px] text-ink-400'>10:24 AM</p>
							</div>
							{buttons.map((label, index) => (
								<div
									key={index}
									className='flex items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-xs font-medium text-sky-600 shadow-sm dark:bg-ink-700 dark:text-sky-300'>
									<Tag className='h-3.5 w-3.5' aria-hidden='true' />
									{label}
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Scheduling */}
				<div className='space-y-2'>
					<h3 className='flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50'>
						<CalendarClock className='h-4 w-4' aria-hidden='true' />
						{t("campaigns.schedule.title")}
					</h3>

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
										"flex w-full items-center gap-3 rounded-xl border p-3 text-start transition",
										selected
											? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30"
											: "border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800/50"
									)}>
									<span
										className={cn(
											"flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
											selected ? "border-emerald-500" : "border-ink-300 dark:border-ink-500"
										)}>
										{selected ? <span className='h-2 w-2 rounded-full bg-emerald-500' /> : null}
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
								className='input h-11 lg:h-10'
							/>
						</div>
					) : null}
				</div>
			</div>

			<footer className='grid grid-cols-2 gap-2 border-t border-ink-100 p-4 dark:border-ink-700'>
				<button type='button' className='btn-secondary justify-center' onClick={onSendTest}>
					<Send className='h-4 w-4' aria-hidden='true' />
					{t("campaigns.sendTest")}
				</button>
				<button type='button' className='btn-primary justify-center' onClick={onReview} disabled={recipientCount === 0}>
					{t("campaigns.review")}
				</button>
			</footer>
		</section>
	)
}
