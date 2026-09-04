"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	Ban,
	Bot,
	Check,
	CheckCheck,
	Clock,
	Contact,
	Download,
	Eraser,
	ExternalLink,
	Eye,
	EyeOff,
	FileText,
	Headphones,
	KeyRound,
	ListChecks,
	MapPin,
	Mic,
	MessageSquare,
	MoreVertical,
	MousePointerClick,
	Paperclip,
	Send,
	SendHorizontal,
	ShieldOff,
	Trash2,
	Undo2,
	UserRound,
	Workflow
} from "lucide-react"
import { adminApi, api } from "@/lib/api"
import { errorDetail, errorKey } from "@/lib/errors"
import { cn, colorFromString, isToday, isYesterday, textDirOf, uuid } from "@/lib/utils"
import { useI18n } from "@/providers/i18n-provider"
import { useAuth } from "@/providers/auth-provider"
import { useToast } from "@/providers/toast-provider"
import { Avatar } from "@/components/ui/avatar"
import { ModeBadge } from "@/components/ui/badges"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { BlockNumberFormModal } from "@/components/blocked-numbers/block-number-form-modal"
import { useRealtime, type ConnectionState } from "@/hooks/use-realtime"
import type { Conversation, Message, RealtimeEvent } from "@/lib/types"
import { WhatsAppAudioPlayer } from "./audio-player"

interface Props {
	conversation: Conversation | null
	onConversationChange: (conversation: Conversation) => void
	onBack?: () => void
	onConversationDeleted?: (id: string) => void
	onToggleHide?: (id: string, hide: boolean) => void | Promise<void>
}

function statusIcon(status: Message["status"]) {
	if (status === "pending") return Clock

	if (status === "failed") return AlertCircle

	if (status === "delivered" || status === "read") return CheckCheck

	return Check
}

function statusTint(status: Message["status"]): string | undefined {
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
	const { t, formatTime } = useI18n()

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
		return <WhatsAppAudioPlayer src={url} sentTime={formatTime(message.createdAt)} />
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

/** Message types that carry a `payload` and render their own text + widget instead of the plain text bubble. */
const RICH_TYPES = new Set(["buttons", "list", "template", "otp", "location", "contacts", "flow"])

function RichBody({ message }: { message: Message }) {
	if (!message.text) return null

	return (
		<p dir={textDirOf(message.text)} className='mb-2 whitespace-pre-wrap break-words'>
			{message.text}
		</p>
	)
}

function RichPanel({ outbound, children }: { outbound: boolean; children: React.ReactNode }) {
	return (
		<div className={cn("rounded-lg px-3 py-2 text-xs", outbound ? "bg-white/10" : "bg-ink-50 dark:bg-ink-900/60")}>
			{children}
		</div>
	)
}

function RichLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
	return (
		<p className='mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-80'>
			{icon}
			{children}
		</p>
	)
}

function MessageRichContent({ message, outbound }: { message: Message; outbound: boolean }) {
	const { t } = useI18n()

	const payload = message.payload ?? {}

	const chipClass = cn(
		"inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
		outbound ? "border-white/30" : "border-ink-300 dark:border-ink-600"
	)

	if (message.type === "buttons") {
		const buttons = Array.isArray(payload.buttons) ? payload.buttons : []

		return (
			<div className='mb-1'>
				<RichBody message={message} />

				{buttons.length > 0 ? (
					<div className='flex flex-wrap gap-1.5'>
						{buttons.map((button) => (
							<span key={button.id} className={chipClass}>
								{button.title}
							</span>
						))}
					</div>
				) : null}
			</div>
		)
	}

	if (message.type === "list") {
		const sections = Array.isArray(payload.sections) ? payload.sections : []

		return (
			<div className='mb-1' dir={textDirOf(message.text)}>
				<RichBody message={message} />

				<RichPanel outbound={outbound}>
					{payload.buttonText ? (
						<RichLabel icon={<ListChecks className='h-3.5 w-3.5' aria-hidden='true' />}>{payload.buttonText}</RichLabel>
					) : null}

					{sections.map((section, sectionIndex) => (
						<div
							dir={textDirOf(message.text)}
							key={`${section.title ?? "section"}-${sectionIndex}`}
							className='mb-2 last:mb-0'>
							{section.title ? <p className='mb-1 text-[11px] font-semibold opacity-70'>{section.title}</p> : null}

							<ul className='list-disc ps-4'>
								{(section.rows ?? []).map((row) => (
									<li key={row.id} className='mb-0.5 last:mb-0'>
										<span className='font-medium'>{row.title}</span>

										{row.description ? <span className='opacity-70'> — {row.description}</span> : null}
									</li>
								))}
							</ul>
						</div>
					))}
				</RichPanel>
			</div>
		)
	}

	if (message.type === "template" || message.type === "otp") {
		const isOtp = message.type === "otp"

		return (
			<div className='mb-1'>
				<RichBody message={message} />

				<RichPanel outbound={outbound}>
					<RichLabel
						icon={
							isOtp ? (
								<KeyRound className='h-3.5 w-3.5' aria-hidden='true' />
							) : (
								<FileText className='h-3.5 w-3.5' aria-hidden='true' />
							)
						}>
						{isOtp ? t("chat.rich.otpTemplate") : t("chat.rich.template")}
					</RichLabel>

					{payload.templateName ? <p className='font-mono text-[11px] opacity-90'>{payload.templateName}</p> : null}

					{Array.isArray(payload.bodyParams) && payload.bodyParams.length > 0 ? (
						<ul className='mt-1 list-disc ps-4'>
							{payload.bodyParams.map((param, index) => (
								<li key={index}>{param}</li>
							))}
						</ul>
					) : null}

					{isOtp && payload.code ? (
						<p className='mt-1'>
							<span className='opacity-70'>{t("chat.rich.code")}: </span>
							<span className='font-mono font-semibold tracking-widest'>{payload.code}</span>
						</p>
					) : null}
				</RichPanel>
			</div>
		)
	}

	if (message.type === "location") {
		const hasCoords = typeof payload.latitude === "number" && typeof payload.longitude === "number"

		return (
			<div className='mb-1'>
				<RichBody message={message} />

				<RichPanel outbound={outbound}>
					<RichLabel icon={<MapPin className='h-3.5 w-3.5' aria-hidden='true' />}>{t("chat.rich.location")}</RichLabel>

					{payload.locationName ? <p className='font-medium'>{payload.locationName}</p> : null}

					{payload.address ? <p className='opacity-70'>{payload.address}</p> : null}

					{hasCoords ? (
						<a
							href={`https://www.google.com/maps?q=${payload.latitude},${payload.longitude}`}
							target='_blank'
							rel='noreferrer'
							className='mt-1 inline-flex items-center gap-1 underline underline-offset-2'>
							{t("chat.rich.viewOnMap")}
							<ExternalLink className='h-3 w-3' aria-hidden='true' />
						</a>
					) : null}
				</RichPanel>
			</div>
		)
	}

	if (message.type === "contacts") {
		return (
			<div className='mb-1'>
				<RichBody message={message} />

				<RichPanel outbound={outbound}>
					<RichLabel icon={<Contact className='h-3.5 w-3.5' aria-hidden='true' />}>{t("chat.rich.contact")}</RichLabel>

					{payload.contactName ? <p className='font-medium'>{payload.contactName}</p> : null}
					{payload.phone ? (
						<p dir='ltr' className='opacity-70'>
							{payload.phone}
						</p>
					) : null}
				</RichPanel>
			</div>
		)
	}

	if (message.type === "flow") {
		return (
			<div className='mb-1'>
				<RichBody message={message} />

				<div className={chipClass}>
					<Workflow className='me-1.5 h-3.5 w-3.5' aria-hidden='true' />
					{payload.flowCta || t("chat.rich.flowCta")}
				</div>
			</div>
		)
	}

	return null
}

/** Inbound button/list taps and template quick-replies: show the tapped choice as a small chip above the text. */
function MessageTapHint({ message, outbound }: { message: Message; outbound: boolean }) {
	const { t } = useI18n()

	if (message.type !== "interactive" && message.type !== "button") return null

	const payload = message.payload ?? {}

	const title = payload.button_reply?.title ?? payload.list_reply?.title ?? null

	if (!title) return null

	return (
		<p
			className={cn(
				"mb-1 flex items-center gap-1 text-[11px] font-medium opacity-80",
				outbound ? "text-white" : "text-ink-500"
			)}>
			<MousePointerClick className='h-3 w-3' aria-hidden='true' />
			{t("chat.rich.tapped")}
		</p>
	)
}

export function ChatPanel({ conversation, onConversationChange, onBack, onToggleHide }: Props) {
	const { t, formatTime, formatDateTime, dir } = useI18n()

	const { agent, role, canManageUsers } = useAuth()

	const canChangeMode = role === "agent"

	const { push } = useToast()

	const [messages, setMessages] = useState<Message[]>([])

	const [loading, setLoading] = useState(false)

	const [failure, setFailure] = useState<string | null>(null)

	const [draft, setDraft] = useState("")

	const [sending, setSending] = useState(false)

	const [modeBusy, setModeBusy] = useState(false)

	const [menuOpen, setMenuOpen] = useState(false)

	const [blockModalOpen, setBlockModalOpen] = useState(false)

	const [, setPendingDelete] = useState(false)

	const [pendingClear, setPendingClear] = useState(false)

	const [unblocking, setUnblocking] = useState(false)

	const [blockedEntryId, setBlockedEntryId] = useState<string | null>(null)

	const [hideBusy, setHideBusy] = useState(false)

	const menuRef = useRef<HTMLDivElement>(null)

	const scrollRef = useRef<HTMLDivElement>(null)

	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const conversationId = conversation?.id ?? null

	const scrollToEnd = useCallback((smooth = true) => {
		const node = scrollRef.current

		if (!node) return

		node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" })
	}, [])

	const onConversationChangeRef = useRef(onConversationChange)

	onConversationChangeRef.current = onConversationChange

	const conversationRef = useRef(conversation)

	conversationRef.current = conversation

	const agentRef = useRef(agent)

	agentRef.current = agent

	const markReadTimer = useRef<number | null>(null)

	const scheduleMarkRead = useCallback((id: string) => {
		if (markReadTimer.current) window.clearTimeout(markReadTimer.current)

		markReadTimer.current = window.setTimeout(() => {
			markReadTimer.current = null
			void api.markConversationRead(id).catch(() => undefined)
		}, 1200)
	}, [])

	useEffect(() => {
		return () => {
			if (markReadTimer.current) window.clearTimeout(markReadTimer.current)
		}
	}, [conversationId])

	useEffect(() => {
		setMenuOpen(false)
		setBlockModalOpen(false)
		setPendingDelete(false)
		setPendingClear(false)
	}, [conversationId])

	useEffect(() => {
		if (!menuOpen) return

		const onPointerDown = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
		}

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMenuOpen(false)
		}

		document.addEventListener("mousedown", onPointerDown)
		document.addEventListener("keydown", onKeyDown)

		return () => {
			document.removeEventListener("mousedown", onPointerDown)
			document.removeEventListener("keydown", onKeyDown)
		}
	}, [menuOpen])

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
			.messages(conversationId, { markRead: true, signal: controller.signal })
			.then((list) => {
				setMessages(list)
				window.setTimeout(() => scrollToEnd(false), 30)

				const current = conversationRef.current

				if (current && current.id === conversationId && (current.unreadCount ?? 0) > 0) {
					onConversationChangeRef.current({ ...current, unreadCount: 0 })
				}
			})
			.catch((error) => {
				if ((error as Error)?.name === "AbortError") return

				setFailure(errorKey(error))
			})
			.finally(() => setLoading(false))

		return () => controller.abort()
	}, [conversationId, scrollToEnd])

	useEffect(() => {
		if (!conversationId) return

		const controller = new AbortController()

		api
			.conversation(conversationId, controller.signal)
			.then((fresh) => {
				const current = conversationRef.current

				if (current && current.id === conversationId) {
					onConversationChangeRef.current({ ...current, ...fresh })
				}
			})
			.catch((error) => {
				if ((error as Error)?.name === "AbortError") return
			})

		return () => controller.abort()
	}, [conversationId])

	const onRealtimeEvent = useCallback(
		(payload: unknown) => {
			const event = payload as RealtimeEvent | null

			const current = conversationRef.current

			if (!event || typeof event.event !== "string" || !current) return

			if (event.event === "message.created") {
				if (event.conversationId !== current.id) return

				setMessages((prev) => mergeMessages(prev, [event as unknown as Message]))
				window.setTimeout(() => scrollToEnd(), 20)

				if ((event as unknown as Message).direction === "inbound") {
					if ((current.unreadCount ?? 0) !== 0) {
						onConversationChangeRef.current({ ...current, unreadCount: 0 })
					}

					scheduleMarkRead(current.id)
				}

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

				const nextAssigneeId = (event.assigneeId as string | null | undefined) ?? null

				const agentNow = agentRef.current

				onConversationChangeRef.current({
					...current,
					mode: (event.mode as Conversation["mode"]) ?? current.mode,
					assigneeId: nextAssigneeId,
					assignee:
						nextAssigneeId && agentNow && nextAssigneeId === agentNow.id
							? { id: agentNow.id, name: agentNow.name, email: agentNow.email }
							: null
				})

				if (nextAssigneeId && nextAssigneeId !== agentNow?.id) {
					void api
						.conversation(current.id)
						.then((fresh) => {
							if (conversationRef.current?.id === current.id) {
								onConversationChangeRef.current({ ...conversationRef.current, assignee: fresh.assignee ?? null })
							}
						})
						.catch(() => undefined)
				}

				return
			}

			if (event.event === "conversation.blocked") {
				if (event.conversationId !== current.id) return

				onConversationChangeRef.current({
					...current,
					blocked: Boolean(event.blocked),
					whatsappStatus: (event.whatsappStatus as Conversation["whatsappStatus"]) ?? null
				})
			}
		},
		[scrollToEnd, scheduleMarkRead]
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

	const blocked = Boolean(conversation?.blocked)

	const canReply = conversation?.mode === "agent" && mine && !blocked

	const lockedReason =
		conversation == null
			? null
			: blocked
				? t("chat.inputLockedBlocked")
				: conversation.mode !== "agent"
					? t("chat.inputLockedBot")
					: !mine
						? t("chat.inputLockedOther")
						: null

	const phoneForBlockLookup = conversation?.phone ?? null

	useEffect(() => {
		if (!blocked || !phoneForBlockLookup) {
			setBlockedEntryId(null)

			return
		}

		let cancelled = false

		const controller = new AbortController()

		adminApi
			.listBlockedNumbers("blocked", phoneForBlockLookup, controller.signal)
			.then((entries) => {
				if (!cancelled) setBlockedEntryId(entries[0]?.id ?? null)
			})
			.catch(() => {
				if (!cancelled) setBlockedEntryId(null)
			})

		return () => {
			cancelled = true
			controller.abort()
		}
	}, [blocked, phoneForBlockLookup])

	const [uploading, setUploading] = useState(false)

	const fileInputRef = useRef<HTMLInputElement>(null)

	const [recording, setRecording] = useState(false)

	const [recordSeconds, setRecordSeconds] = useState(0)

	const mediaRecorderRef = useRef<MediaRecorder | null>(null)

	const recordedChunksRef = useRef<Blob[]>([])

	const streamRef = useRef<MediaStream | null>(null)

	const recordTimerRef = useRef<number | null>(null)

	const recordShouldSendRef = useRef(true)

	const recordingSupported =
		typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia)

	function pickAudioFormat(): { recordType: string; uploadType: string; extension: string } | null {
		const candidates = [
			{ recordType: "audio/ogg;codecs=opus", uploadType: "audio/ogg", extension: "ogg" },
			{ recordType: "audio/mp4", uploadType: "audio/mp4", extension: "m4a" },
			{ recordType: "audio/aac", uploadType: "audio/aac", extension: "aac" },
			{ recordType: "audio/webm;codecs=opus", uploadType: "audio/ogg", extension: "ogg" },
			{ recordType: "audio/webm", uploadType: "audio/ogg", extension: "ogg" }
		]

		for (const candidate of candidates) {
			if (MediaRecorder.isTypeSupported(candidate.recordType)) return candidate
		}

		return null
	}

	const stopRecordTimer = () => {
		if (recordTimerRef.current) {
			window.clearInterval(recordTimerRef.current)
			recordTimerRef.current = null
		}
	}

	const releaseMic = () => {
		streamRef.current?.getTracks().forEach((track) => track.stop())
		streamRef.current = null
	}

	const startRecording = async () => {
		if (!canReply || recording || uploading || !recordingSupported) return

		const format = pickAudioFormat()

		if (!format) {
			push(t("chat.recordingUnsupported"), "error")

			return
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

			streamRef.current = stream
			recordedChunksRef.current = []
			recordShouldSendRef.current = true

			const recorder = new MediaRecorder(stream, { mimeType: format.recordType })

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) recordedChunksRef.current.push(event.data)
			}

			recorder.onstop = () => {
				releaseMic()
				stopRecordTimer()

				const shouldSend = recordShouldSendRef.current

				const chunks = recordedChunksRef.current

				recordedChunksRef.current = []
				setRecording(false)
				setRecordSeconds(0)

				if (!shouldSend || chunks.length === 0) return

				const blob = new Blob(chunks, { type: format.uploadType })

				const file = new File([blob], `voice-${Date.now()}.${format.extension}`, { type: format.uploadType })

				void sendFile(file)
			}

			mediaRecorderRef.current = recorder
			recorder.start()

			setRecording(true)
			setRecordSeconds(0)
			recordTimerRef.current = window.setInterval(() => setRecordSeconds((seconds) => seconds + 1), 1000)
		} catch {
			push(t("chat.micDenied"), "error")
			releaseMic()
		}
	}

	const finishRecording = (send: boolean) => {
		recordShouldSendRef.current = send

		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			mediaRecorderRef.current.stop()
		} else {
			releaseMic()
			stopRecordTimer()
			setRecording(false)
			setRecordSeconds(0)
		}
	}

	useEffect(() => {
		return () => {
			stopRecordTimer()
			releaseMic()
		}
	}, [])

	function formatRecordTime(totalSeconds: number): string {
		const minutes = Math.floor(totalSeconds / 60)

		const seconds = totalSeconds % 60

		return `${minutes}:${String(seconds).padStart(2, "0")}`
	}

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
		if (!conversationId || modeBusy || !canChangeMode) return

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

	const submitBlock = async ({ phone, reason }: { phone: string; reason?: string | null }) => {
		if (!conversation) return

		try {
			await adminApi.blockNumber({ phone, reason })
			onConversationChange({ ...conversation, blocked: true, whatsappStatus: "pending" })
			push(t("chat.blockedContact"), "success")
			setBlockModalOpen(false)
			setMenuOpen(false)
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		}
	}

	const handleUnblock = async () => {
		if (!conversation || !blockedEntryId || unblocking) return

		setUnblocking(true)

		try {
			await adminApi.unblockNumber(blockedEntryId)

			onConversationChange({ ...conversation, blocked: false, whatsappStatus: "unblocked" })
			setBlockedEntryId(null)
			push(t("chat.contactUnblocked"), "success")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setUnblocking(false)
		}
	}

	const handleToggleHide = async () => {
		if (!conversationId || !conversation || hideBusy) return

		const hide = !conversation.hidden

		setHideBusy(true)
		setMenuOpen(false)

		try {
			if (onToggleHide) {
				await onToggleHide(conversationId, hide)
			} else {
				const updated = hide ? await api.hideConversation(conversationId) : await api.unhideConversation(conversationId)

				onConversationChange(updated)
				push(t(hide ? "chat.conversationHidden" : "chat.conversationUnhidden"), "success")
			}

			if (hide) onBack?.()
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setHideBusy(false)
		}
	}

	const confirmClear = async () => {
		if (!conversationId || !conversation) return

		try {
			await api.clearConversationMessages(conversationId)
			setMessages([])
			onConversationChange({ ...conversation, preview: null, lastMessageId: null })
			push(t("chat.messagesCleared"), "success")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setMenuOpen(false)
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
			<header className='flex flex-shrink-0 flex-col gap-2 border-b border-ink-200 p-3 dark:border-ink-700 lg:flex-row lg:items-center lg:gap-3'>
				<div className='flex min-w-0 items-center gap-3'>
					{onBack ? (
						<button
							type='button'
							onClick={onBack}
							aria-label={t("chat.back")}
							title={t("chat.back")}
							className='btn-ghost -ms-1 flex-shrink-0 p-2 lg:hidden'>
							{dir === "rtl" ? (
								<ArrowRight className='h-4 w-4' aria-hidden='true' />
							) : (
								<ArrowLeft className='h-4 w-4' aria-hidden='true' />
							)}
						</button>
					) : null}
					<Avatar name={conversation.customerName} seed={conversation.phone} />
					<div className='min-w-0 flex-1'>
						<p
							dir={textDirOf(conversation.customerName)}
							className='truncate text-sm font-semibold text-ink-900 dark:text-ink-50'>
							{conversation.customerName?.trim() || conversation.phone}
						</p>
						<p className='truncate text-xs text-ink-500 dark:text-ink-400' dir='ltr'>
							{conversation.phone}
						</p>
					</div>
				</div>

				<div className='flex flex-wrap items-center justify-end gap-2 ps-1 lg:ms-auto lg:flex-nowrap lg:ps-0'>
					<ModeBadge mode={conversation.mode} />

					{blocked ? (
						<span
							className='badge bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200'
							title={t("chat.blockedBadgeHint")}>
							<ShieldOff className='h-3 w-3' aria-hidden='true' />
							{t(
								conversation.whatsappStatus === "blocked"
									? "chat.blockedBadge"
									: conversation.whatsappStatus === "failed" || conversation.whatsappStatus === "unblocked"
										? "chat.blockedBadgeLocalOnly"
										: "chat.blockedBadgePending"
							)}
						</span>
					) : null}

					{connectionState !== "connected" ? (
						<span
							className='flex items-center gap-1 text-[11px] text-ink-400'
							title={t(connectionState === "connecting" ? "chat.reconnecting" : "chat.offline")}>
							<span className='h-1.5 w-1.5 rounded-full bg-amber-500' aria-hidden='true' />
							{t(connectionState === "connecting" ? "chat.reconnecting" : "chat.offline")}
						</span>
					) : null}

					{!canChangeMode ? null : conversation.mode === "agent" && mine ? (
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

					{canManageUsers ? (
						<div ref={menuRef} className='relative'>
							<button
								type='button'
								className='btn-secondary px-2.5'
								onClick={() => setMenuOpen((value) => !value)}
								aria-haspopup='menu'
								aria-expanded={menuOpen}
								aria-label={t("chat.moreActions")}
								title={t("chat.moreActions")}>
								<MoreVertical className='h-4 w-4' aria-hidden='true' />
							</button>

							{menuOpen ? (
								<div
									role='menu'
									className='absolute end-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg dark:border-ink-700 dark:bg-ink-800'>
									<button
										type='button'
										role='menuitem'
										disabled={blocked}
										onClick={() => {
											setBlockModalOpen(true)
											setMenuOpen(false)
										}}
										className='flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-ink-200 dark:hover:bg-ink-700'>
										<Ban className='h-4 w-4' aria-hidden='true' />
										{blocked ? t("chat.contactAlreadyBlocked") : t("chat.blockContact")}
									</button>

									<button
										type='button'
										role='menuitem'
										disabled={hideBusy}
										onClick={() => void handleToggleHide()}
										className='flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-ink-200 dark:hover:bg-ink-700'>
										{hideBusy ? (
											<Spinner />
										) : conversation.hidden ? (
											<Eye className='h-4 w-4' aria-hidden='true' />
										) : (
											<EyeOff className='h-4 w-4' aria-hidden='true' />
										)}
										{t(conversation.hidden ? "chat.unhideConversation" : "chat.hideConversation")}
									</button>

									<button
										type='button'
										role='menuitem'
										onClick={() => {
											setPendingClear(true)
											setMenuOpen(false)
										}}
										className='flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-ink-700 transition hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700'>
										<Eraser className='h-4 w-4' aria-hidden='true' />
										{t("chat.clearMessages")}
									</button>
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</header>

			<div ref={scrollRef} className='min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6'>
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

										<MessageTapHint message={message} outbound={outbound} />

										{RICH_TYPES.has(message.type) ? (
											<MessageRichContent message={message} outbound={outbound} />
										) : message.text || (!message.mediaId && !message.filename) ? (
											<p dir={textDirOf(message.text)} className='whitespace-pre-wrap break-words'>
												{message.text ?? `[${message.type}]`}
											</p>
										) : null}

										{message.type !== "audio" ? (
											<p
												className={cn(
													"mt-1 flex items-center justify-end gap-1 text-[10px]",
													outbound ? "text-brand-100/90" : "text-ink-400"
												)}>
												<span dir='ltr'>{formatTime(message.createdAt)}</span>

												{outbound ? (
													<>
														<StatusIcon className={cn("h-3 w-3", statusTint(message.status))} aria-hidden='true' />
														<span className='sr-only'>
															{t(`chat.status${message.status.charAt(0).toUpperCase()}${message.status.slice(1)}`)}
														</span>
													</>
												) : null}
											</p>
										) : null}
									</div>
								</div>
							</div>
						)
					})
				)}
			</div>

			<footer className='flex-shrink-0 border-t border-ink-200 p-3 dark:border-ink-700'>
				{blocked ? (
					<div className='flex flex-wrap items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-center text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200'>
						<ShieldOff className='h-3.5 w-3.5 flex-shrink-0' aria-hidden='true' />
						<span>{lockedReason}</span>
						<button
							type='button'
							onClick={() => void handleUnblock()}
							disabled={unblocking || !blockedEntryId}
							className='btn-ghost h-7 flex-shrink-0 px-2.5 py-0 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-200 dark:hover:bg-rose-900'>
							{unblocking ? <Spinner /> : <Undo2 className='h-3.5 w-3.5' aria-hidden='true' />}
							{unblocking ? t("chat.unblocking") : t("chat.unblockContact")}
						</button>
					</div>
				) : lockedReason ? (
					<p className='rounded-xl bg-ink-100 px-3 py-2 text-center text-xs text-ink-500 dark:bg-ink-900 dark:text-ink-400'>
						{lockedReason}
					</p>
				) : recording ? (
					<div className='flex items-center gap-2'>
						<button
							type='button'
							onClick={() => finishRecording(false)}
							className='btn-ghost h-[2.6rem] flex-shrink-0 px-3 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950'
							aria-label={t("chat.cancelRecording")}
							title={t("chat.cancelRecording")}>
							<Trash2 className='h-4 w-4' aria-hidden='true' />
						</button>

						<div className='input flex h-[2.6rem] flex-1 items-center gap-2.5 py-0'>
							<span className='relative flex h-2.5 w-2.5 flex-shrink-0' aria-hidden='true'>
								<span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75' />
								<span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600' />
							</span>
							<span dir='ltr' className='text-sm font-medium tabular-nums text-ink-700 dark:text-ink-200'>
								{formatRecordTime(recordSeconds)}
							</span>
							<span className='truncate text-xs text-ink-400'>{t("chat.recording")}</span>
						</div>

						<button
							type='button'
							onClick={() => finishRecording(true)}
							className='btn-primary h-[2.6rem] flex-shrink-0 px-4'
							aria-label={t("chat.sendRecording")}
							title={t("chat.sendRecording")}>
							<SendHorizontal className='h-4 w-4' aria-hidden='true' />
						</button>
					</div>
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
						{draft.trim().length === 0 && recordingSupported ? (
							<button
								type='button'
								className='btn-primary h-[2.6rem] flex-shrink-0 px-4'
								onClick={() => void startRecording()}
								disabled={!canReply || uploading}
								aria-label={t("chat.recordVoice")}
								title={t("chat.recordVoice")}>
								<Mic className='h-4 w-4' aria-hidden='true' />
							</button>
						) : (
							<button
								type='button'
								className='btn-primary h-[2.6rem] flex-shrink-0 px-4'
								onClick={() => void send()}
								disabled={!canReply || sending || uploading || draft.trim().length === 0}
								aria-label={t("chat.send")}>
								{sending ? <Spinner /> : <Send className='h-4 w-4' aria-hidden='true' />}
								<span className='hidden sm:inline'>{sending ? t("chat.sending") : t("chat.send")}</span>
							</button>
						)}
					</div>
				)}
				{lockedReason || recording ? null : <p className='mt-1.5 text-[11px] text-ink-400'>{t("chat.typingHint")}</p>}
			</footer>

			<BlockNumberFormModal
				open={blockModalOpen}
				initialPhone={conversation.phone}
				onClose={() => setBlockModalOpen(false)}
				onSubmit={submitBlock}
			/>

			<ConfirmDialog
				open={pendingClear}
				title={t("chat.clearMessages")}
				body={t("chat.clearMessagesBody")}
				confirmLabel={t("chat.clearMessages")}
				tone='danger'
				onConfirm={confirmClear}
				onClose={() => setPendingClear(false)}
			/>
		</div>
	)
}
