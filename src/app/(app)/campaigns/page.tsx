"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import type { CampaignContact, CampaignDraft } from "@/lib/features/campaigns/types"
import { EMPTY_DRAFT, MOCK_CONTACTS, validateDraft } from "@/lib/features/campaigns/mock"
import { TemplateSetup } from "@/components/campaigns/template-setup"
import { RecipientsPanel } from "@/components/campaigns/recipients-panel"
import { PreviewSend } from "@/components/campaigns/preview-send"

export default function NewCampaignPage() {
	const router = useRouter()

	const { t } = useI18n()

	const { push } = useToast()

	const [draft, setDraft] = useState<CampaignDraft>(EMPTY_DRAFT)

	const [contacts, setContacts] = useState<CampaignContact[]>(MOCK_CONTACTS)

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

	const patch = useCallback((next: Partial<CampaignDraft>) => setDraft((current) => ({ ...current, ...next })), [])

	const saveDraft = () => push(t("campaigns.draftSaved"), "success")

	const useTemplate = () => push(t("campaigns.templateApplied"), "success")

	const sendTest = () => push(t("campaigns.testSent"), "success")

	const review = () => {
		const problem = validateDraft(draft, selectedIds.size)

		if (problem) return push(t(problem), "error")

		push(t("campaigns.readyToReview", { n: selectedIds.size }), "success")
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
			<div className='grid min-h-0 gap-4 lg:h-full lg:grid-cols-3'>
				<TemplateSetup draft={draft} onChange={patch} onSaveDraft={saveDraft} onUseTemplate={useTemplate} />
				<RecipientsPanel
					contacts={contacts}
					selectedIds={selectedIds}
					onSelectedChange={setSelectedIds}
					onImport={(imported) => setContacts((current) => [...imported, ...current])}
				/>
				<PreviewSend
					draft={draft}
					recipientCount={selectedIds.size}
					onChange={patch}
					onSendTest={sendTest}
					onReview={review}
				/>
			</div>
		</AppShell>
	)
}
