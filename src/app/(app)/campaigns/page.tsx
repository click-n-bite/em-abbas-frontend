"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Eye, Send, X } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import { TemplateSetup } from "@/components/campaigns/template-setup"
import { RecipientsPanel } from "@/components/campaigns/recipients-panel"
import { ScheduleReview } from "@/components/campaigns/schedule-review"
import { EMPTY_DRAFT, MOCK_CONTACTS, validateStep } from "@/lib/features/campaigns/mock"
import type { CampaignContact, CampaignDraft } from "@/lib/features/campaigns/types"
import { PhonePreview } from "@/components/campaigns/phone-preview"
import { CampaignStepper } from "@/components/campaigns/campaign-stepper"

const STEP_KEYS = ["template", "recipients", "schedule"] as const

export default function NewCampaignPage() {
	const router = useRouter()

	const { t } = useI18n()

	const { push } = useToast()

	const [step, setStep] = useState(0)

	const [draft, setDraft] = useState<CampaignDraft>(EMPTY_DRAFT)

	const [contacts, setContacts] = useState<CampaignContact[]>(MOCK_CONTACTS)

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

	// Phone preview lives in a sheet below the lg breakpoint (iPad / mobile).
	const [previewOpen, setPreviewOpen] = useState(false)

	const patch = useCallback((next: Partial<CampaignDraft>) => setDraft((current) => ({ ...current, ...next })), [])

	useEffect(() => {
		if (!previewOpen) return

		const onKey = (event: KeyboardEvent) => event.key === "Escape" && setPreviewOpen(false)

		window.addEventListener("keydown", onKey)

		return () => window.removeEventListener("keydown", onKey)
	}, [previewOpen])

	const last = step === STEP_KEYS.length - 1

	// TODO(backend): replace these handlers with campaignsApi.* calls.
	const saveDraft = () => push(t("campaigns.draftSaved"), "success")

	const sendTest = () => push(t("campaigns.testSent"), "success")

	const next = () => {
		const problem = validateStep(step, draft, selectedIds.size)

		if (problem) return push(t(problem), "error")

		if (!last) return setStep(step + 1)

		push(t(draft.scheduleMode === "now" ? "campaigns.sent" : "campaigns.scheduled", { n: selectedIds.size }), "success")
	}

	return (
		<AppShell
			title={t("campaigns.createTitle")}
			subtitle={t("campaigns.createSubtitle")}
			actions={
				<button
					type='button'
					className='btn-secondary px-3 py-2'
					onClick={() => router.back()}
					aria-label={t("common.back")}
					title={t("common.back")}>
					<ArrowLeft className='h-4 w-4 rtl:rotate-180' aria-hidden='true' />
				</button>
			}>
			<div className='mx-auto max-w-6xl space-y-4'>
				<CampaignStepper
					steps={STEP_KEYS.map((key) => ({ key, label: t(`campaigns.steps.${key}`) }))}
					current={step}
					onSelect={setStep}
				/>

				<div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]'>
					<div className='min-w-0'>
						{step === 0 ? <TemplateSetup draft={draft} onChange={patch} /> : null}
						{step === 1 ? (
							<RecipientsPanel
								contacts={contacts}
								selectedIds={selectedIds}
								onSelectedChange={setSelectedIds}
								onImport={(imported) => setContacts((current) => [...imported, ...current])}
							/>
						) : null}
						{step === 2 ? <ScheduleReview draft={draft} onChange={patch} recipientCount={selectedIds.size} /> : null}
					</div>

					{/* Desktop: live preview stays visible while you edit. */}
					<aside className='card sticky top-4 hidden p-4 lg:block'>
						<h2 className='mb-3 text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("campaigns.preview.title")}</h2>
						<PhonePreview draft={draft} />
					</aside>
				</div>

				<div className='card sticky bottom-3 z-20 flex flex-wrap items-center gap-2 p-3'>
					{step > 0 ? (
						<button type='button' className='btn-secondary min-h-11' onClick={() => setStep(step - 1)}>
							<ArrowLeft className='h-4 w-4 rtl:rotate-180' aria-hidden='true' />
							{t("campaigns.back")}
						</button>
					) : null}

					<span className='flex-1' />

					<button type='button' className='btn-secondary min-h-11 lg:hidden' onClick={() => setPreviewOpen(true)}>
						<Eye className='h-4 w-4' aria-hidden='true' />
						<span className='hidden sm:inline'>{t("campaigns.preview.open")}</span>
					</button>
					<button type='button' className='btn-secondary min-h-11' onClick={saveDraft}>
						{t("campaigns.saveDraft")}
					</button>
					{last ? (
						<button type='button' className='btn-secondary min-h-11' onClick={sendTest}>
							<Send className='h-4 w-4' aria-hidden='true' />
							<span className='hidden sm:inline'>{t("campaigns.sendTest")}</span>
						</button>
					) : null}
					<button type='button' className='btn-primary min-h-11' onClick={next}>
						{last ? t(draft.scheduleMode === "now" ? "campaigns.send" : "campaigns.scheduleCta") : t("campaigns.next")}
						{!last ? <ArrowRight className='h-4 w-4 rtl:rotate-180' aria-hidden='true' /> : null}
					</button>
				</div>
			</div>

			{previewOpen ? (
				<div
					className='fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-3 md:items-center lg:hidden'
					onClick={() => setPreviewOpen(false)}>
					<div
						role='dialog'
						aria-modal='true'
						aria-label={t("campaigns.preview.title")}
						className='card max-h-full w-full max-w-sm overflow-y-auto p-4'
						onClick={(event) => event.stopPropagation()}>
						<div className='mb-3 flex items-center justify-between'>
							<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("campaigns.preview.title")}</h2>
							<button
								type='button'
								className='btn-ghost h-9 w-9 justify-center p-0'
								onClick={() => setPreviewOpen(false)}
								aria-label={t("campaigns.preview.close")}>
								<X className='h-4 w-4' aria-hidden='true' />
							</button>
						</div>
						<PhonePreview draft={draft} />
					</div>
				</div>
			) : null}
		</AppShell>
	)
}
