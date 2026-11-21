"use client"

import { Tag } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { textDirOf } from "@/lib/utils"
import { renderBody } from "@/lib/features/campaigns/mock"
import type { CampaignDraft } from "@/lib/features/campaigns/types"

export function PhonePreview({ draft }: { draft: CampaignDraft }) {
	const { t } = useI18n()

	const buttons = draft.buttons.enabled ? draft.buttons.items.filter((item) => item.trim()) : []

	return (
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
							<p dir={textDirOf(draft.header.text)} className='mb-1 text-xs font-bold text-ink-900 dark:text-ink-50'>
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
	)
}
