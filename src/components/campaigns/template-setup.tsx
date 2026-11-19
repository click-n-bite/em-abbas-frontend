"use client"

import type { ReactNode } from "react"
import { ChevronRight, FileText, MessageSquare, Plus, X } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { Select } from "@/components/ui/select"
import { cn, textDirOf } from "@/lib/utils"
import { BODY_LIMIT, CATEGORIES, LANGUAGES } from "@/lib/features/campaigns/mock"
import type { CampaignCategory, CampaignDraft } from "@/lib/features/campaigns/types"

interface Props {
	draft: CampaignDraft
	onChange: (patch: Partial<CampaignDraft>) => void
	onSaveDraft: () => void
	onUseTemplate: () => void
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
	return (
		<button
			type='button'
			role='switch'
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative h-5 w-9 shrink-0 rounded-full transition",
				checked ? "bg-emerald-500" : "bg-ink-200 dark:bg-ink-600"
			)}>
			<span
				className={cn(
					"absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
					checked ? "start-[1.125rem]" : "start-0.5"
				)}
			/>
		</button>
	)
}

function Part({
	title,
	hint,
	enabled,
	onToggle,
	children
}: {
	title: string
	hint: string
	enabled?: boolean
	onToggle?: (next: boolean) => void
	children?: ReactNode
}) {
	return (
		<div className='rounded-xl border border-ink-200 dark:border-ink-700'>
			<div className='flex items-center gap-3 px-3 py-2.5'>
				<span className='min-w-0 flex-1 text-sm font-medium text-ink-800 dark:text-ink-100'>
					{title} <span className='text-xs font-normal text-ink-400'>({hint})</span>
				</span>
				{onToggle ? <Toggle checked={Boolean(enabled)} onChange={onToggle} label={title} /> : null}
				{onToggle && !enabled ? (
					<ChevronRight className='h-4 w-4 text-ink-400 rtl:rotate-180' aria-hidden='true' />
				) : null}
			</div>
			{children ? <div className='space-y-2 border-t border-ink-100 p-3 dark:border-ink-700'>{children}</div> : null}
		</div>
	)
}

export function TemplateSetup({ draft, onChange, onSaveDraft, onUseTemplate }: Props) {
	const { t } = useI18n()

	return (
		<section className='card flex min-h-0 flex-col'>
			<header className='flex items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-700'>
				<span className='flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200'>
					<FileText className='h-5 w-5' aria-hidden='true' />
				</span>
				<div className='min-w-0'>
					<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("campaigns.setup.title")}</h2>
					<p className='text-xs text-ink-500 dark:text-ink-400'>{t("campaigns.setup.subtitle")}</p>
				</div>
			</header>

			<div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
				<label className='block space-y-1.5'>
					<span className='text-xs font-medium text-ink-600 dark:text-ink-300'>{t("campaigns.setup.name")} *</span>
					<input
						value={draft.name}
						onChange={(event) => onChange({ name: event.target.value })}
						placeholder={t("campaigns.setup.namePlaceholder")}
						className='input'
					/>
				</label>

				<label className='block space-y-1.5'>
					<span className='text-xs font-medium text-ink-600 dark:text-ink-300'>{t("campaigns.setup.category")} *</span>
					<Select
						value={draft.category}
						onChange={(event) => onChange({ category: event.target.value as CampaignCategory })}
						mobileLabel={t(`campaigns.category.${draft.category}`)}
						aria-label={t("campaigns.setup.category")}>
						{CATEGORIES.map((category) => (
							<option key={category} value={category}>
								{t(`campaigns.category.${category}`)}
							</option>
						))}
					</Select>
				</label>

				<label className='block space-y-1.5'>
					<span className='text-xs font-medium text-ink-600 dark:text-ink-300'>{t("campaigns.setup.language")} *</span>
					<Select
						value={draft.language}
						onChange={(event) => onChange({ language: event.target.value })}
						mobileLabel={LANGUAGES.find((language) => language.code === draft.language)?.label ?? ""}
						aria-label={t("campaigns.setup.language")}>
						{LANGUAGES.map((language) => (
							<option key={language.code} value={language.code}>
								{language.label}
							</option>
						))}
					</Select>
				</label>

				<div className='overflow-hidden rounded-xl border border-ink-200 dark:border-ink-700'>
					<div className='flex items-center gap-2 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100'>
						<MessageSquare className='h-4 w-4' aria-hidden='true' />
						{t("campaigns.setup.messageTemplate")}
					</div>
					<div className='space-y-1.5 p-3'>
						<textarea
							value={draft.body}
							onChange={(event) => onChange({ body: event.target.value.slice(0, BODY_LIMIT) })}
							dir={textDirOf(draft.body)}
							rows={6}
							aria-label={t("campaigns.setup.body")}
							className='input min-h-[8rem] resize-y'
						/>
						<div className='flex items-center justify-between text-[11px] text-ink-400'>
							<button
								type='button'
								className='btn-ghost px-2 py-1 text-xs'
								onClick={() => onChange({ body: `${draft.body}{{1}}`.slice(0, BODY_LIMIT) })}>
								{t("campaigns.setup.insertName")}
							</button>
							<span className='tabular-nums'>
								{draft.body.length} / {BODY_LIMIT}
							</span>
						</div>
					</div>
				</div>

				<div className='space-y-2'>
					<Part
						title={t("campaigns.setup.header")}
						hint={t("campaigns.optional")}
						enabled={draft.header.enabled}
						onToggle={(enabled) => onChange({ header: { ...draft.header, enabled } })}>
						{draft.header.enabled ? (
							<input
								value={draft.header.text}
								onChange={(event) => onChange({ header: { ...draft.header, text: event.target.value.slice(0, 60) } })}
								placeholder={t("campaigns.setup.headerPlaceholder")}
								className='input'
							/>
						) : null}
					</Part>

					<Part title={t("campaigns.setup.bodyPart")} hint={t("campaigns.required")} />

					<Part
						title={t("campaigns.setup.footer")}
						hint={t("campaigns.optional")}
						enabled={draft.footer.enabled}
						onToggle={(enabled) => onChange({ footer: { ...draft.footer, enabled } })}>
						{draft.footer.enabled ? (
							<input
								value={draft.footer.text}
								onChange={(event) => onChange({ footer: { ...draft.footer, text: event.target.value.slice(0, 60) } })}
								placeholder={t("campaigns.setup.footerPlaceholder")}
								className='input'
							/>
						) : null}
					</Part>

					<Part
						title={t("campaigns.setup.buttons")}
						hint={t("campaigns.optional")}
						enabled={draft.buttons.enabled}
						onToggle={(enabled) => onChange({ buttons: { ...draft.buttons, enabled } })}>
						{draft.buttons.enabled ? (
							<>
								{draft.buttons.items.map((item, index) => (
									<div key={index} className='flex items-center gap-2'>
										<input
											value={item}
											onChange={(event) =>
												onChange({
													buttons: {
														...draft.buttons,
														items: draft.buttons.items.map((value, i) =>
															i === index ? event.target.value.slice(0, 25) : value
														)
													}
												})
											}
											aria-label={t("campaigns.setup.buttonLabel", { n: index + 1 })}
											className='input'
										/>
										<button
											type='button'
											className='btn-ghost h-9 w-9 shrink-0 justify-center p-0'
											aria-label={t("campaigns.setup.removeButton")}
											onClick={() =>
												onChange({
													buttons: { ...draft.buttons, items: draft.buttons.items.filter((_, i) => i !== index) }
												})
											}>
											<X className='h-4 w-4' aria-hidden='true' />
										</button>
									</div>
								))}
								{draft.buttons.items.length < 3 ? (
									<button
										type='button'
										className='btn-ghost px-2 py-1 text-xs'
										onClick={() => onChange({ buttons: { ...draft.buttons, items: [...draft.buttons.items, ""] } })}>
										<Plus className='h-3.5 w-3.5' aria-hidden='true' />
										{t("campaigns.setup.addButton")}
									</button>
								) : null}
							</>
						) : null}
					</Part>
				</div>
			</div>

			<footer className='grid grid-cols-2 gap-2 border-t border-ink-100 p-4 dark:border-ink-700'>
				<button type='button' className='btn-secondary justify-center' onClick={onSaveDraft}>
					{t("campaigns.saveDraft")}
				</button>
				<button type='button' className='btn-primary justify-center' onClick={onUseTemplate}>
					{t("campaigns.useTemplate")}
				</button>
			</footer>
		</section>
	)
}
