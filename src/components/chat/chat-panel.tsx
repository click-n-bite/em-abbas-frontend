"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	AlertCircle,
	ArrowLeft,
	Bot,
	Check,
	CheckCheck,
	Clock,
	Download,
	FileText,
	Headphones,
	MessageSquare,
	Paperclip,
	Send,
	Undo2,
	UserRound
} from "lucide-react"
import { api } from "@/lib/api"
import { errorKey } from "@/lib/errors"
import { playNotificationSound } from "@/lib/sound"
import { cn, colorFromString, isToday, isYesterday, uuid } from "@/lib/utils"
import { useI18n } from "@/providers/i18n-provider"
import { useAuth } from "@/providers/auth-provider"
import { useToast } from "@/providers/toast-provider"
import { Avatar } from "@/components/ui/avatar"
import { ModeBadge } from "@/components/ui/badges"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { useRealtime, type ConnectionState } from "@/hooks/use-realtime"
import type { Conversation, Message, RealtimeEvent } from "@/lib/types"

interface Props {
	conversation: Conversation | null
	onConversationChange: (conversation: Conversation) => void
	/** Shows a WhatsApp-style back arrow (mobile only) that returns to the list. */
	onBack?: () => void
}

/** WhatsApp convention: one grey check = sent, two grey checks = delivered,
 *  two blue checks = read. Pending/failed get their own icon entirely. */
function statusIcon(status: Message["status"]) {
	if (status === "pending") return Clock

	if (status === "failed") return AlertCircle

	if (status === "sent") return Check

	return CheckCheck // delivered or read
}

function statusIconClass(status: Message["status"]) {
	if (status === "read") return "text-sky-300"

	return undefined
}

function agentKeyOf(message: Message): string | null {
	const key = message.agentId ?? message.agentName ?? null

	return key && key.trim() ? key.trim() : null
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
	if (incoming.length === 0) return current

	const byId = new Map<string, Message>()

	const order: string[] = []

	const put = (message: Message) => {
		const existingKey = message.clientMessageId
			? order.find((key) => byId.get(key)?.clientMessageId === message.clientMessageId)
			: undefined

		const key = existingKey ?? message.id

		if (!byId.has(key)) order.push(key)

		const previous = byId.get(key)

		byId.set(key, previous ? { ...previous, ...message, optimistic: false } : message)
	}

	current.forEach(put)
	incoming.forEach(put)

	return order
		.map((key) => byId.get(key) as Message)
		.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/** Fetches `GET /media/{id}` with the JWT and hands back an object URL —
 *  <img>/<audio>/<video> can't attach an Authorization header themselves,
 *  so the bytes have to come through an authenticated fetch first. */
function useMediaBlobUrl(mediaId: string | null | undefined) {
	const [url, setUrl] = useState<string | null>(null)

	const [loading, setLoading] = useState(false)

	const [error, setError] = useState(false)

	useEffect(() => {
		if (!mediaId) {
			setUrl(null)
			setError(false)

			return
		}

		let objectUrl: string | null = null

		let cancelled = false

		const controller = new AbortController()

		setLoading(true)
		setError(false)

		api
			.mediaBlobUrl(mediaId, controller.signal)
			.then((blobUrl) => {
				if (cancelled) {
					URL.revokeObjectURL(blobUrl)

					return
				}

				objectUrl = blobUrl
				setUrl(blobUrl)
			})
			.catch((err) => {
				if ((err as Error)?.name === "AbortError") return

				if (!cancelled) setError(true)
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})

		return () => {
			cancelled = true
			controller.abort()

			if (objectUrl) URL.revokeObjectURL(objectUrl)
		}
	}, [mediaId])

	return { url, loading, error }
}

function MessageMedia({ message, outbound }: { message: Message; outbound: boolean }) {
	const [lightbox, setLightbox] = useState(false)

	// Still uploading locally (optimistic bubble, no mediaId from the server yet).
	if (!message.mediaId) {
		if (message.filename) {
			return (
				<div
					className={cn(
						"mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
						outbound ? "bg-white/15" : "bg-ink-100 dark:bg-ink-900"
					)}>
					<Spinner />
					<span className='truncate'>{message.filename}</span>
				</div>
			)
		}

		return null
	}

	return <LoadedMedia message={message} outbound={outbound} lightbox={lightbox} setLightbox={setLightbox} />
}

function LoadedMedia({
	message,
	outbound,
	lightbox,
	setLightbox
}: {
	message: Message
	outbound: boolean
	lightbox: boolean
	setLightbox: (value: boolean) => void
}) {
	const { t } = useI18n()

	const { url, loading, error } = useMediaBlobUrl(message.mediaId)

	if (loading) {
		return (
			<div className='mb-1 flex h-32 w-48 max-w-full items-center justify-center rounded-lg bg-black/10'>
				<Spinner />
			</div>
		)
	}

	if (error || !url) {
		return (
			<div
				className={cn(
					"mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
					outbound ? "bg-white/15" : "bg-ink-100 dark:bg-ink-900"
				)}>
				<AlertCircle className='h-4 w-4 flex-shrink-0' aria-hidden='true' />
				{t("chat.mediaFailed")}
			</div>
		)
	}

	if (message.type === "image" || message.type === "sticker") {
		return (
			<>
				<button type='button' onClick={() => setLightbox(true)} className='mb-1 block overflow-hidden rounded-lg'>
					{/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image can't optimize it */}
					<img src={url} alt={message.filename ?? t("chat.image")} className='max-h-64 w-full object-cover' />
				</button>

				{lightbox ? (
					<div
						className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4'
						onClick={() => setLightbox(false)}
						role='dialog'
						aria-modal='true'>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={url} alt={message.filename ?? t("chat.image")} className='max-h-full max-w-full rounded-lg' />
					</div>
				) : null}
			</>
		)
	}

	if (message.type === "video") {
		return <video src={url} controls className='mb-1 max-h-64 w-full rounded-lg' />
	}

	if (message.type === "audio") {
		return <audio src={url} controls className='' />
	}

	return (
		<a
			href={url}
			download={message.filename ?? "file"}
			className={cn(
				"mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:opacity-90",
				outbound ? "bg-white/15" : "bg-ink-100 dark:bg-ink-900"
			)}>
			<FileText className='h-5 w-5 flex-shrink-0' aria-hidden='true' />
			<span className='min-w-0 flex-1 truncate'>{message.filename ?? t("chat.download")}</span>
			<Download className='h-4 w-4 flex-shrink-0' aria-hidden='true' />
		</a>
	)
}

export function ChatPanel({ conversation, onConversationChange, onBack }: Props) {
	const { t, formatTime, formatDateTime } = useI18n()

	const { agent } = useAuth()

	const { push } = useToast()

	const [messages, setMessages] = useState<Message[]>([])

	const [loading, setLoading] = useState(false)

	const [failure, setFailure] = useState<string | null>(null)

	const [draft, setDraft] = useState("")

	const [sending, setSending] = useState(false)

	const [modeBusy, setModeBusy] = useState(false)

	const scrollRef = useRef<HTMLDivElement>(null)

	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const conversationId = conversation?.id ?? null

	const scrollToEnd = useCallback((smooth = true) => {
		const node = scrollRef.current

		if (!node) return

		node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" })
	}, [])

	useEffect(() => {
		if (!conversationId) {
			setMessages([])

			return
		}

		const controller = new AbortController()

		setLoading(true)
		setFailure(null)
		setDraft("")

		api
			.messages(conversationId, undefined, controller.signal)
			.then((list) => {
				setMessages(list)
				window.setTimeout(() => scrollToEnd(false), 30)
			})
			.catch((error) => {
				if ((error as Error)?.name === "AbortError") return

				setFailure(errorKey(error))
			})
			.finally(() => setLoading(false))

		return () => controller.abort()
	}, [conversationId, scrollToEnd])

	const onConversationChangeRef = useRef(onConversationChange)

	onConversationChangeRef.current = onConversationChange

	const conversationRef = useRef(conversation)

	conversationRef.current = conversation

	const onRealtimeEvent = useCallback(
		(payload: unknown) => {
			const event = payload as RealtimeEvent | null

			const current = conversationRef.current

			if (!event || typeof event.event !== "string" || !current) return

			if (event.event === "message.created") {
				if (event.conversationId !== current.id) return

				const incoming = event as unknown as Message

				setMessages((prev) => mergeMessages(prev, [incoming]))
				window.setTimeout(() => scrollToEnd(), 20)

				// Chat is already open, so the inbox-level chime is skipped for this
				// conversation — play it here instead.
				if (incoming.direction === "inbound") playNotificationSound()

				return
			}

			if (event.event === "message.status") {
				if (event.conversationId !== current.id) return

				const status = event.status as Message["status"] | undefined

				const id = event.id as string | undefined

				if (!status || !id) return

				setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, status } : message)))

				return
			}

			if (event.event === "conversation.assigned") {
				if (event.conversationId !== current.id) return

				onConversationChangeRef.current({
					...current,
					mode: (event.mode as Conversation["mode"]) ?? current.mode,
					assigneeId: (event.assigneeId as string | null | undefined) ?? null
				})
			}
		},
		[scrollToEnd]
	)

	const socketTopics = useMemo(
		() => (conversationId ? [`/topic/conversation/${conversationId}`] : []),
		[conversationId]
	)

	const connectionState: ConnectionState = useRealtime({
		topics: socketTopics,
		onEvent: onRealtimeEvent,
		enabled: Boolean(conversationId)
	})

	const mine = Boolean(conversation?.assigneeId && conversation.assigneeId === agent?.id)

	const canReply = conversation?.mode === "agent" && mine

	const lockedReason =
		conversation == null
			? null
			: conversation.mode !== "agent"
				? t("chat.inputLockedBot")
				: !mine
					? t("chat.inputLockedOther")
					: null

	const [uploading, setUploading] = useState(false)

	const fileInputRef = useRef<HTMLInputElement>(null)

	const send = async () => {
		const text = draft.trim()

		if (!conversationId || !text || sending || !conversation) return

		const clientMessageId = uuid()

		const sentAt = new Date().toISOString()

		const optimistic: Message = {
			id: `local-${clientMessageId}`,
			conversationId,
			direction: "outbound",
			source: "agent",
			type: "text",
			text,
			mediaId: null,
			mediaUrl: null,
			mimeType: null,
			filename: null,
			status: "pending",
			wamid: null,
			clientMessageId,
			createdAt: sentAt,
			optimistic: true
		}

		setMessages((current) => mergeMessages(current, [optimistic]))
		setDraft("")
		setSending(true)
		window.setTimeout(() => scrollToEnd(), 20)

		onConversationChangeRef.current({
			...conversation,
			preview: text,
			lastMessageAt: sentAt
		})

		try {
			const saved = await api.sendMessage(conversationId, { type: "text", text }, clientMessageId)

			setMessages((current) => mergeMessages(current, [{ ...optimistic, ...saved, optimistic: false }]))
		} catch (error) {
			setMessages((current) =>
				current.map((message) =>
					message.clientMessageId === clientMessageId ? { ...message, status: "failed", optimistic: false } : message
				)
			)
			push(t(errorKey(error)), "error")
		} finally {
			setSending(false)
			textareaRef.current?.focus()
		}
	}

	const MAX_MEDIA_BYTES = 16 * 1024 * 1024

	function mediaTypeOf(mimeType: string): "image" | "audio" | "video" | "document" {
		if (mimeType.startsWith("image/")) return "image"

		if (mimeType.startsWith("audio/")) return "audio"

		if (mimeType.startsWith("video/")) return "video"

		return "document"
	}

	const sendFile = async (file: File) => {
		if (!conversationId || !conversation || uploading) return

		if (file.size > MAX_MEDIA_BYTES) {
			push(t("chat.mediaTooLarge"), "error")

			return
		}

		const clientMessageId = uuid()

		const sentAt = new Date().toISOString()

		const type = mediaTypeOf(file.type || "application/octet-stream")

		const optimistic: Message = {
			id: `local-${clientMessageId}`,
			conversationId,
			direction: "outbound",
			source: "agent",
			type,
			text: null,
			mediaId: null,
			mediaUrl: null,
			mimeType: file.type || null,
			filename: file.name,
			status: "pending",
			wamid: null,
			clientMessageId,
			createdAt: sentAt,
			optimistic: true
		}

		setMessages((current) => mergeMessages(current, [optimistic]))
		setUploading(true)
		window.setTimeout(() => scrollToEnd(), 20)

		onConversationChangeRef.current({
			...conversation,
			preview: t(`chat.mediaPreview.${type}`),
			lastMessageAt: sentAt
		})

		try {
			const uploaded = await api.uploadMedia(file)

			const saved = await api.sendMessage(conversationId, { type, mediaId: uploaded.mediaId }, clientMessageId)

			setMessages((current) => mergeMessages(current, [{ ...optimistic, ...saved, optimistic: false }]))
		} catch (error) {
			setMessages((current) =>
				current.map((message) =>
					message.clientMessageId === clientMessageId ? { ...message, status: "failed", optimistic: false } : message
				)
			)
			push(t(errorKey(error)), "error")
		} finally {
			setUploading(false)

			if (fileInputRef.current) fileInputRef.current.value = ""
		}
	}

	const changeMode = async (action: "takeover" | "handoff") => {
		if (!conversationId || modeBusy) return

		setModeBusy(true)

		try {
			const updated = action === "takeover" ? await api.takeover(conversationId) : await api.handoffToAi(conversationId)

			onConversationChange(updated)

			if (action === "takeover") textareaRef.current?.focus()
		} catch (error) {
			push(t(errorKey(error)), "error")
		} finally {
			setModeBusy(false)
		}
	}

	if (!conversation) {
		return (
			<div className='flex h-full items-center justify-center'>
				<EmptyState icon={<MessageSquare className='h-5 w-5' aria-hidden='true' />} title={t("inbox.selectHint")} />
			</div>
		)
	}

	let lastDay = ""

	return (
		<div className='flex h-full flex-col overflow-hidden'>
			<header className='flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-ink-200 p-3 dark:border-ink-700'>
				{onBack ? (
					<button
						type='button'
						onClick={onBack}
						className='btn-ghost -ms-1.5 h-9 w-9 shrink-0 justify-center rounded-full p-0 lg:hidden'
						aria-label={t("common.back")}
						title={t("common.back")}>
						<ArrowLeft className='h-4.5 w-4.5 rtl:rotate-180' aria-hidden='true' />
					</button>
				) : null}
				<Avatar name={conversation.customerName} seed={conversation.phone} />
				<div className='min-w-0 flex-1'>
					<p dir='auto' className='truncate text-sm font-semibold text-ink-900 dark:text-ink-50'>
						{conversation.customerName?.trim() || conversation.phone}
					</p>
					<p className='truncate text-xs text-ink-500 dark:text-ink-400' dir='ltr'>
						{conversation.phone}
					</p>
				</div>

				<ModeBadge mode={conversation.mode} />

				{connectionState !== "connected" ? (
					<span
						className='flex items-center gap-1 text-[11px] text-ink-400'
						title={t(connectionState === "connecting" ? "chat.reconnecting" : "chat.offline")}>
						<span className='h-1.5 w-1.5 rounded-full bg-amber-500' aria-hidden='true' />
						{t(connectionState === "connecting" ? "chat.reconnecting" : "chat.offline")}
					</span>
				) : null}

				{conversation.mode === "agent" && mine ? (
					<button type='button' className='btn-secondary' onClick={() => changeMode("handoff")} disabled={modeBusy}>
						{modeBusy ? <Spinner /> : <Undo2 className='h-4 w-4' aria-hidden='true' />}
						{modeBusy ? t("chat.handingOff") : t("chat.handoff")}
					</button>
				) : conversation.mode !== "agent" ? (
					<button type='button' className='btn-primary' onClick={() => changeMode("takeover")} disabled={modeBusy}>
						{modeBusy ? <Spinner /> : <Headphones className='h-4 w-4' aria-hidden='true' />}
						{modeBusy ? t("chat.takingOver") : t("chat.takeover")}
					</button>
				) : null}
			</header>

			<div ref={scrollRef} className='relative min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6'>
				{loading ? (
					<div className='flex flex-col gap-3'>
						{[0, 1, 2, 3].map((index) => (
							<span key={index} className={cn("skeleton h-12", index % 2 === 0 ? "me-auto w-2/3" : "ms-auto w-1/2")} />
						))}
					</div>
				) : failure ? (
					<EmptyState icon={<AlertCircle className='h-5 w-5' aria-hidden='true' />} title={t(failure)} />
				) : messages.length === 0 ? (
					<EmptyState icon={<MessageSquare className='h-5 w-5' aria-hidden='true' />} title={t("chat.emptyThread")} />
				) : (
					messages.map((message) => {
						const outbound = message.direction === "outbound"

						const StatusIcon = statusIcon(message.status)

						const agentKey = message.source === "agent" ? agentKeyOf(message) : null

						const fromMe =
							agentKey !== null && (agentKey === agent?.id || agentKey === agent?.name || agentKey === agent?.email)

						const tint =
							outbound && agentKey && !fromMe && message.status !== "failed" ? colorFromString(agentKey) : null

						const dayLabel = isToday(message.createdAt)
							? t("chat.today")
							: isYesterday(message.createdAt)
								? t("chat.yesterday")
								: formatDateTime(message.createdAt).split(",")[0]

						const showDay = dayLabel !== lastDay

						lastDay = dayLabel

						return (
							<div key={message.id}>
								{showDay ? (
									<p className='my-4 text-center text-[11px] font-medium uppercase tracking-wide text-ink-400'>
										{dayLabel}
									</p>
								) : null}
								<div className={cn("flex py-1", outbound ? "justify-end" : "justify-start")}>
									<div
										style={tint ? { backgroundColor: tint } : undefined}
										className={cn(
											"max-w-[85%] animate-fade-in rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
											outbound
												? cn("bubble-out text-white", !tint && "bg-brand-600")
												: "bubble-in bg-white text-ink-800 dark:bg-ink-800 dark:text-ink-100",
											message.status === "failed" && "bg-rose-600"
										)}>
										{outbound && agentKey && !fromMe ? (
											<p className='mb-1 flex items-center gap-1 text-[11px] font-semibold text-white/90'>
												<UserRound className='h-3 w-3' aria-hidden='true' />
												{message.agentName?.trim() || t("chat.otherAgent")}
											</p>
										) : null}

										{message.source === "bot" || (outbound && message.source !== "agent") ? (
											<p
												className={cn(
													"mb-1 flex items-center gap-1 text-[11px] font-medium",
													outbound ? "text-brand-100" : "text-ink-400"
												)}>
												<Bot className='h-3 w-3' aria-hidden='true' />
												{t("chat.bot")}
											</p>
										) : null}

										<MessageMedia message={message} outbound={outbound} />

										{message.text || (!message.mediaId && !message.filename) ? (
											<p className='whitespace-pre-wrap break-words'>{message.text ?? `[${message.type}]`}</p>
										) : null}

										<p
											className={cn(
												"mt-1 flex items-center justify-end gap-1 text-[10px]",
												outbound ? "text-brand-100/90" : "text-ink-400"
											)}>
											<span dir='ltr'>{formatTime(message.createdAt)}</span>
											{outbound ? (
												<>
													<StatusIcon className={cn("h-3 w-3", statusIconClass(message.status))} aria-hidden='true' />
													<span className='sr-only'>
														{t(`chat.status${message.status.charAt(0).toUpperCase()}${message.status.slice(1)}`)}
													</span>
												</>
											) : null}
										</p>
									</div>
								</div>
							</div>
						)
					})
				)}
			</div>

			<footer className='flex-shrink-0 border-t border-ink-200 p-3 dark:border-ink-700'>
				{lockedReason ? (
					<p className='rounded-xl bg-ink-100 px-3 py-2 text-center text-xs text-ink-500 dark:bg-ink-900 dark:text-ink-400'>
						{lockedReason}
					</p>
				) : (
					<div className='flex items-end gap-2'>
						<input
							ref={fileInputRef}
							type='file'
							className='hidden'
							onChange={(event) => {
								const file = event.target.files?.[0]

								if (file) void sendFile(file)
							}}
						/>
						<button
							type='button'
							className='btn-secondary h-[2.6rem] flex-shrink-0 px-3'
							onClick={() => fileInputRef.current?.click()}
							disabled={!canReply || uploading}
							aria-label={t("chat.attach")}
							title={t("chat.attach")}>
							{uploading ? <Spinner /> : <Paperclip className='h-4 w-4' aria-hidden='true' />}
						</button>
						<textarea
							ref={textareaRef}
							rows={1}
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault()
									void send()
								}
							}}
							placeholder={t("chat.inputPlaceholder")}
							aria-label={t("chat.inputPlaceholder")}
							disabled={!canReply}
							className='input max-h-32 min-h-[2.6rem] resize-y py-2.5'
						/>
						<button
							type='button'
							className='btn-primary h-[2.6rem] flex-shrink-0 px-4'
							onClick={() => void send()}
							disabled={!canReply || sending || uploading || draft.trim().length === 0}
							aria-label={t("chat.send")}>
							{sending ? <Spinner /> : <Send className='h-4 w-4' aria-hidden='true' />}
							<span className='hidden sm:inline'>{sending ? t("chat.sending") : t("chat.send")}</span>
						</button>
					</div>
				)}
				{lockedReason ? null : <p className='mt-1.5 text-[11px] text-ink-400'>{t("chat.typingHint")}</p>}
			</footer>
		</div>
	)
}
