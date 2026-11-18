"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, BookUser, EyeOff, MessageSquare, Pencil, Star, Trash2, Unlink } from "lucide-react"
import { contactsApi } from "@/lib/features/contacts/api"
import { contactErrorKey, errorCodeOf, formatContactPhone } from "@/lib/features/contacts/format"
import type { Contact, ContactEvent } from "@/lib/features/contacts/types"
import { errorDetail, errorKey } from "@/lib/errors"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import { Avatar } from "@/components/ui/avatar"
import { ChannelBadge } from "@/components/ui/channel-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ContactActivity } from "@/components/contacts/contact-activity"
import { ContactChatSuggestions } from "@/components/contacts/contact-suggestions"
import { ContactFormModal } from "@/components/contacts/contact-form-modal"
import { TrustedStar } from "@/components/contacts/trusted-star"
import { cn, textDirOf } from "@/lib/utils"

const TOPICS = ["/topic/inbox"]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className='card p-5'>
			<h2 className='mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400'>{title}</h2>
			{children}
		</section>
	)
}

export default function ContactDetailPage() {
	const params = useParams<{ id: string }>()

	const router = useRouter()

	const { t, dir, formatDateTime } = useI18n()

	const { canManageUsers } = useAuth() // admin or super admin

	const { push } = useToast()

	const id = Number(params?.id)

	const [contact, setContact] = useState<Contact | null>(null)

	const [events, setEvents] = useState<ContactEvent[]>([])

	const [loading, setLoading] = useState(true)

	const [eventsLoading, setEventsLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [editing, setEditing] = useState(false)

	const [unlinking, setUnlinking] = useState<number | null>(null)

	const [confirmDelete, setConfirmDelete] = useState(false)

	const [trustBusy, setTrustBusy] = useState(false)

	const contactRef = useRef<Contact | null>(null)

	contactRef.current = contact

	const loadEvents = useCallback(async () => {
		try {
			setEvents(await contactsApi.events(id))
		} catch {
			/* keep the history we already have */
		} finally {
			setEventsLoading(false)
		}
	}, [id])

	const loadContact = useCallback(
		async (silent = false) => {
			if (!silent) setLoading(true)

			try {
				setContact(await contactsApi.get(id))
				setFailure(null)
			} catch (error) {
				if (errorCodeOf(error) === "CONTACT_NOT_FOUND") setFailure("contacts.errors.notFound")
				else if (!silent) setFailure(errorKey(error))
			} finally {
				setLoading(false)
			}
		},
		[id]
	)

	useEffect(() => {
		if (!Number.isFinite(id)) return

		void loadContact()
		void loadEvents()
	}, [id, loadContact, loadEvents])

	// When another agent changes a contact, every affected chat gets
	// conversation.upserted with reason "contact.changed". Refresh the card
	// when the event is for one of this contact's chats.
	useRealtime({
		topics: TOPICS,
		enabled: Number.isFinite(id),
		onEvent: (payload: unknown) => {
			const event = payload as {
				event?: string
				reason?: string
				conversationId?: string
				contact?: { id: number } | null
			} | null

			if (!event || event.event !== "conversation.upserted") return

			const mine = contactRef.current

			const forThisContact =
				event.contact?.id === id || mine?.linkedChats.some((chat) => chat.conversationId === event.conversationId)

			if (forThisContact) {
				void loadContact(true)
				void loadEvents()
			}
		}
	})

	const apply = (next: Contact) => {
		setContact(next)
		void loadEvents()
	}

	const toggleTrusted = async () => {
		if (!contact || trustBusy || !canManageUsers) return

		setTrustBusy(true)

		try {
			apply(await contactsApi.update(contact.id, { trusted: !contact.trusted }))
		} catch (error) {
			const key = contactErrorKey(error)

			push(key ? t(key) : (errorDetail(error) ?? t(errorKey(error))), "error")
		} finally {
			setTrustBusy(false)
		}
	}

	const unlink = async () => {
		if (!contact || unlinking === null) return

		try {
			apply(await contactsApi.unlink(contact.id, unlinking))
			push(t("contacts.card.unlinked"), "success")
		} catch (error) {
			const key = contactErrorKey(error)

			push(key ? t(key) : (errorDetail(error) ?? t(errorKey(error))), "error")
		} finally {
			setUnlinking(null)
		}
	}

	const remove = async () => {
		if (!contact) return

		try {
			await contactsApi.remove(contact.id)
			push(t("contacts.deleted"), "success")
			router.push("/contacts")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setConfirmDelete(false)
		}
	}

	const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft

	return (
		<AppShell
			title={contact?.displayName ?? t("contacts.title")}
			subtitle={t("contacts.subtitle")}
			actions={
				<Link href='/contacts' className='btn-secondary'>
					<BackIcon className='h-4 w-4' aria-hidden='true' />
					<span className='hidden sm:inline'>{t("contacts.title")}</span>
				</Link>
			}>
			{loading && !contact ? (
				<div className='space-y-3'>
					{[0, 1, 2].map((index) => (
						<div key={index} className='skeleton h-24 w-full' />
					))}
				</div>
			) : failure || !contact ? (
				<EmptyState
					icon={<BookUser className='h-5 w-5' aria-hidden='true' />}
					title={t(failure ?? "contacts.errors.notFound")}
				/>
			) : (
				<div className='mx-auto max-w-3xl space-y-4'>
					<section className='card flex flex-wrap items-center gap-4 p-5'>
						<Avatar name={contact.displayName} seed={String(contact.id)} />
						<div className='min-w-0 flex-1'>
							<h1
								dir={textDirOf(contact.displayName)}
								className='flex items-center gap-1.5 text-lg font-semibold text-ink-900 dark:text-ink-50'>
								<span className='truncate'>{contact.displayName}</span>
								{contact.trusted ? <TrustedStar /> : null}
							</h1>
							<p className='text-xs text-ink-500 dark:text-ink-400'>
								{t(`contacts.source.${contact.source}`)}
								{" · "}
								{t("contacts.card.createdBy", {
									name: contact.createdBy?.name ?? t("contacts.card.staff")
								})}
								{" · "}
								{formatDateTime(contact.createdAt)}
							</p>
						</div>

						<div className='flex flex-wrap items-center gap-2'>
							<button type='button' className='btn-secondary' onClick={() => setEditing(true)}>
								<Pencil className='h-4 w-4' aria-hidden='true' />
								{t("contacts.edit")}
							</button>

							{/* Trusted and delete are for admins and super admins only. */}
							{canManageUsers ? (
								<>
									<button
										type='button'
										className='btn-secondary'
										disabled={trustBusy}
										onClick={() => void toggleTrusted()}>
										<Star
											className={cn("h-4 w-4", contact.trusted && "fill-amber-400 text-amber-500")}
											aria-hidden='true'
										/>
										{contact.trusted ? t("contacts.card.removeTrusted") : t("contacts.card.markTrusted")}
									</button>
									<button
										type='button'
										className='btn-secondary text-rose-600 dark:text-rose-300'
										onClick={() => setConfirmDelete(true)}>
										<Trash2 className='h-4 w-4' aria-hidden='true' />
										{t("contacts.delete")}
									</button>
								</>
							) : null}
						</div>
					</section>

					<Section title={t("contacts.form.phones")}>
						{contact.phones.length === 0 ? (
							<p className='text-sm text-ink-500 dark:text-ink-400'>{t("contacts.noPhones")}</p>
						) : (
							<ul className='space-y-1.5'>
								{contact.phones.map((phone) => (
									<li key={phone.id} className='flex items-center gap-2 text-sm'>
										<span dir='ltr' className='font-medium text-ink-900 dark:text-ink-50'>
											{formatContactPhone(phone.phone)}
										</span>
										{phone.label ? (
											<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>
												{phone.label}
											</span>
										) : null}
									</li>
								))}
							</ul>
						)}
					</Section>

					{contact.notes ? (
						<Section title={t("contacts.card.notes")}>
							<p
								dir={textDirOf(contact.notes)}
								className='whitespace-pre-wrap break-words text-sm text-ink-800 dark:text-ink-100'>
								{contact.notes}
							</p>
						</Section>
					) : null}

					<Section title={t("contacts.card.linkedChats")}>
						<div className='space-y-3'>
							<ContactChatSuggestions
								contactId={contact.id}
								refreshKey={contact.phones.map((p) => p.phone).join(",")}
								onLinked={apply}
							/>

							{contact.linkedChats.length === 0 ? (
								<p className='text-sm text-ink-500 dark:text-ink-400'>{t("contacts.card.noLinkedChats")}</p>
							) : (
								<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
									{contact.linkedChats.map((chat) => (
										<li
											key={chat.conversationId}
											className={cn(
												"flex flex-wrap items-center gap-3 py-2.5",
												// The chat was removed from the inbox: show it greyed out.
												chat.hidden && "opacity-50"
											)}>
											<ChannelBadge channel={chat.channel} />
											<div className='min-w-0 flex-1'>
												<p
													dir={textDirOf(chat.customerName)}
													className='truncate text-sm font-medium text-ink-900 dark:text-ink-50'>
													{chat.customerName?.trim() || formatContactPhone(chat.phone) || t("common.unknown")}
												</p>
												<p className='text-xs text-ink-500 dark:text-ink-400'>
													{chat.phone ? <span dir='ltr'>{formatContactPhone(chat.phone)}</span> : null}
													{chat.phone && chat.lastMessageAt ? " · " : null}
													{chat.lastMessageAt ? formatDateTime(chat.lastMessageAt) : null}
													{chat.hidden ? (
														<span className='ms-2 inline-flex items-center gap-1'>
															<EyeOff className='h-3 w-3' aria-hidden='true' />
															{t("contacts.card.hiddenChat")}
														</span>
													) : null}
												</p>
											</div>

											{!chat.hidden ? (
												<Link
													href={`/conversations?id=${chat.conversationId}`}
													className='btn-secondary px-2.5 py-1.5 text-xs'>
													<MessageSquare className='h-3.5 w-3.5' aria-hidden='true' />
													{t("contacts.card.openChat")}
												</Link>
											) : null}
											<button
												type='button'
												className='btn-ghost px-2.5 py-1.5 text-xs'
												onClick={() => setUnlinking(chat.customerId)}>
												<Unlink className='h-3.5 w-3.5' aria-hidden='true' />
												{t("contacts.card.unlink")}
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
					</Section>

					<Section title={t("contacts.card.activity")}>
						<ContactActivity events={events} loading={eventsLoading} />
					</Section>
				</div>
			)}

			<ContactFormModal open={editing} contact={contact} onClose={() => setEditing(false)} onSaved={apply} />

			<ConfirmDialog
				open={unlinking !== null}
				title={t("contacts.card.unlinkTitle")}
				body={t("contacts.card.unlinkBody")}
				confirmLabel={t("contacts.card.unlink")}
				onConfirm={unlink}
				onClose={() => setUnlinking(null)}
			/>

			<ConfirmDialog
				open={confirmDelete}
				title={t("contacts.deleteTitle")}
				body={t("contacts.deleteBody")}
				confirmLabel={t("contacts.delete")}
				tone='danger'
				onConfirm={remove}
				onClose={() => setConfirmDelete(false)}
			/>
		</AppShell>
	)
}
