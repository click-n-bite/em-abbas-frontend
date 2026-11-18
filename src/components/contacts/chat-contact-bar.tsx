"use client"

import { useState } from "react"
import Link from "next/link"
import { BookUser, UserPlus } from "lucide-react"
import type { Contact } from "@/lib/features/contacts/types"
import type { Conversation } from "@/lib/types"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { ChatContactSuggestions } from "@/components/contacts/contact-suggestions"
import { ContactPickerModal } from "@/components/contacts/contact-picker-modal"
import { SaveContactModal } from "@/components/contacts/save-contact-modal"
import { TrustedStar } from "@/components/contacts/trusted-star"

interface Props {
	conversation: Conversation
	onConversationChange: (conversation: Conversation) => void
}

export function ChatContactBar({ conversation, onConversationChange }: Props) {
	const { t } = useI18n()

	const { push } = useToast()

	const [saveOpen, setSaveOpen] = useState(false)

	const [pickOpen, setPickOpen] = useState(false)

	const contact = conversation.contact ?? null

	const apply = (card: Contact) => {
		onConversationChange({
			...conversation,
			contact: { id: card.id, name: card.displayName, trusted: card.trusted },
			displayName: card.displayName
		})
		push(t("contacts.linked"), "success")
	}

	if (contact) {
		return (
			<div className='flex flex-shrink-0 items-center gap-2 border-b border-ink-200 bg-ink-50/60 px-3 py-1.5 text-xs dark:border-ink-700 dark:bg-ink-900/30'>
				<BookUser className='h-3.5 w-3.5 text-ink-400' aria-hidden='true' />
				<span className='flex min-w-0 items-center gap-1 text-ink-600 dark:text-ink-300'>
					<span className='truncate'>{t("contacts.linkedTo", { name: contact.name })}</span>
					{contact.trusted ? <TrustedStar /> : null}
				</span>
				<Link
					href={`/contacts/${contact.id}`}
					className='ms-auto shrink-0 font-semibold text-brand-600 hover:underline dark:text-brand-300'>
					{t("contacts.openContact")}
				</Link>
			</div>
		)
	}

	return (
		<div className='flex-shrink-0 space-y-1.5 border-b border-ink-200 bg-ink-50/60 px-3 py-1.5 dark:border-ink-700 dark:bg-ink-900/30'>
			<div className='flex flex-wrap items-center gap-2'>
				<button type='button' className='btn-secondary px-2.5 py-1 text-xs' onClick={() => setSaveOpen(true)}>
					<UserPlus className='h-3.5 w-3.5' aria-hidden='true' />
					{t("contacts.saveAsContact.action")}
				</button>
				<button type='button' className='btn-ghost px-2.5 py-1 text-xs' onClick={() => setPickOpen(true)}>
					<BookUser className='h-3.5 w-3.5' aria-hidden='true' />
					{t("contacts.linkToContact")}
				</button>
			</div>

			<ChatContactSuggestions conversationId={conversation.id} onLinked={apply} />

			<SaveContactModal
				open={saveOpen}
				conversationId={conversation.id}
				defaultName={conversation.customerName?.trim() ?? ""}
				onClose={() => setSaveOpen(false)}
				onSaved={apply}
			/>

			<ContactPickerModal
				open={pickOpen}
				conversationId={conversation.id}
				onClose={() => setPickOpen(false)}
				onLinked={apply}
			/>
		</div>
	)
}
