"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
	AlertCircle,
	Bot,
	Check,
	CheckCheck,
	Clock,
	Headphones,
	MessageSquare,
	Send,
	Undo2,
	UserRound,
} from "lucide-react"
import { api } from "@/lib/api"
import { errorKey } from "@/lib/errors"
import { cn, colorFromString, isToday, isYesterday, uuid } from "@/lib/utils"
import { useI18n } from "@/providers/i18n-provider"
import { useAuth } from "@/providers/auth-provider"
import { useToast } from "@/providers/toast-provider"
import { Avatar } from "@/components/ui/avatar"
import { ModeBadge } from "@/components/ui/badges"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import type { Conversation, Message } from "@/lib/types"
import type { ConnectionState } from "@/hooks/use-realtime"

interface Props {
	conversation: Conversation | null
	onConversationChange: (conversation: Conversation) => void
}

function statusIcon(status: Message["status"]) {
	if (status === "pending") return Clock
	if (status === "failed") return AlertCircle
	if (status === "read") return CheckCheck
	if (status === "delivered") return CheckCheck
	return Check
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

export function ChatPanel({ conversation, onConversationChange }: Props) {
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

	const send = async () => {
		const text = draft.trim()
		if (!conversationId || !text || sending) return

		const clientMessageId = uuid()

		const optimistic: Message = {
			id: `local-${clientMessageId}`,
			conversationId,
			direction: "outbound",
			source: "agent",
			type: "text",
			text,
			status: "pending",
			wamid: null,
			clientMessageId,
			createdAt: new Date().toISOString(),
			optimistic: true
		}

		setMessages((current) => mergeMessages(current, [optimistic]))
		setDraft("")
		setSending(true)
		window.setTimeout(() => scrollToEnd(), 20)

		try {
			const saved = await api.sendMessage(conversationId, text, clientMessageId)
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
			<div className="flex h-full items-center justify-center">
				<EmptyState icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />} title={t("inbox.selectHint")} />
			</div>
		)
	}

	let lastDay = ""

	console.log("conversation" , conversation)

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<header className="flex flex-wrap items-center gap-3 border-b border-ink-200 p-3 dark:border-ink-700 flex-shrink-0">
				<Avatar name={conversation.customerName} seed={conversation.phone} />
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">
						{conversation.customerName?.trim() || conversation.phone}
					</p>
					<p className="truncate text-xs text-ink-500 dark:text-ink-400" dir="ltr">
						{conversation.phone}
					</p>
				</div>

				<ModeBadge mode={conversation.mode} />

				{conversation.mode === "agent" && mine ? (
					<button type="button" className="btn-secondary" onClick={() => changeMode("handoff")} disabled={modeBusy}>
						{modeBusy ? <Spinner /> : <Undo2 className="h-4 w-4" aria-hidden="true" />}
						{modeBusy ? t("chat.handingOff") : t("chat.handoff")}
					</button>
				) : conversation.mode !== "agent" ? (
					<button type="button" className="btn-primary" onClick={() => changeMode("takeover")} disabled={modeBusy}>
						{modeBusy ? <Spinner /> : <Headphones className="h-4 w-4" aria-hidden="true" />}
						{modeBusy ? t("chat.takingOver") : t("chat.takeover")}
					</button>
				) : null}
			</header>

			<div
				ref={scrollRef}
				className="flex-1 overflow-y-auto px-3 py-4 sm:px-6"
			>
				{loading ? (
					<div className="flex flex-col gap-3">
						{[0, 1, 2, 3].map((index) => (
							<span key={index} className={cn("skeleton h-12", index % 2 === 0 ? "me-auto w-2/3" : "ms-auto w-1/2")} />
						))}
					</div>
				) : failure ? (
					<EmptyState icon={<AlertCircle className="h-5 w-5" aria-hidden="true" />} title={t(failure)} />
				) : messages.length === 0 ? (
					<EmptyState icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />} title={t("chat.emptyThread")} />
				) : (
					messages.map((message) => {
						const outbound = message.direction === "outbound"
						const StatusIcon = statusIcon(message.status)
						console.log("message sttaus",message.status )
						console.log("message ",message )
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
									<p className="my-4 text-center text-[11px] font-medium uppercase tracking-wide text-ink-400">
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
										)}
									>
										{outbound && agentKey && !fromMe ? (
											<p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-white/90">
												<UserRound className="h-3 w-3" aria-hidden="true" />
												{message.agentName?.trim() || t("chat.otherAgent")}
											</p>
										) : null}

										{message.source === "bot" || (outbound && message.source !== "agent") ? (
											<p
												className={cn(
													"mb-1 flex items-center gap-1 text-[11px] font-medium",
													outbound ? "text-brand-100" : "text-ink-400"
												)}
											>
												<Bot className="h-3 w-3" aria-hidden="true" />
												{t("chat.bot")}
											</p>
										) : null}

										<p className="whitespace-pre-wrap break-words">{message.text ?? `[${message.type}]`}</p>

										<p
											className={cn(
												"mt-1 flex items-center justify-end gap-1 text-[10px]",
												outbound ? "text-brand-100/90" : "text-ink-400"
											)}
										>
											<span dir="ltr">{formatTime(message.createdAt)}</span>
											{outbound ? (
												<>
													<StatusIcon className="h-3 w-3" aria-hidden="true" />
													<span className="sr-only">
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

			<footer className="border-t border-ink-200 p-3 dark:border-ink-700 flex-shrink-0">
				{lockedReason ? (
					<p className="rounded-xl bg-ink-100 px-3 py-2 text-center text-xs text-ink-500 dark:bg-ink-900 dark:text-ink-400">
						{lockedReason}
					</p>
				) : (
					<div className="flex items-end gap-2">
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
							className="input max-h-32 min-h-[2.6rem] resize-y py-2.5"
						/>
						<button
							type="button"
							className="btn-primary h-[2.6rem] px-4 flex-shrink-0"
							onClick={() => void send()}
							disabled={!canReply || sending || draft.trim().length === 0}
							aria-label={t("chat.send")}
						>
							{sending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden="true" />}
							<span className="hidden sm:inline">{sending ? t("chat.sending") : t("chat.send")}</span>
						</button>
					</div>
				)}
				{lockedReason ? null : <p className="mt-1.5 text-[11px] text-ink-400">{t("chat.typingHint")}</p>}
			</footer>
		</div>
	)
}