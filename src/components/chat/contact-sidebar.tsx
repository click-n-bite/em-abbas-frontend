"use client"

import { useMemo, useState } from "react"
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	Ban,
	ChevronRight,
	Download,
	Eraser,
	ExternalLink,
	Eye,
	EyeOff,
	FileText,
	History,
	Image as ImageIcon,
	Link2,
	ListChecks,
	Mic,
	Pencil,
	Play,
	Search,
	Undo2,
	UserRoundPlus,
	X
} from "lucide-react"

import { contactIdentifier, contactName, contactNameWithCountry } from "@/lib/channel-identity"
import { cn, colorFromString, textDirOf } from "@/lib/utils"
import { useI18n } from "@/providers/i18n-provider"
import { ModeBadge } from "@/components/ui/badges"
import { ChannelIcon } from "@/components/ui/channel-icon"
import { CountryFlag } from "@/components/ui/country-flag"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { TrustedStar } from "@/components/contacts/trusted-star"
import { ActivityPanel } from "@/components/activity/activity-panel"
import type { Conversation, Message } from "@/lib/types"

import { ChatContactBar } from "../contacts/chat-contact-bar"
import { WhatsAppAudioPlayer } from "./audio-player"
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url"

type View = "main" | "media" | "files" | "voices" | "links" | "activity"

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"']+/gi

const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"،؛؟…]+$/

const VISUAL_TYPES = new Set(["image", "video", "sticker"])

function formatDateTime(value: string | number | Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true
	}).format(new Date(value))
}

function initialsOf(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean)

	return `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? ""}`.toUpperCase()
}

function MediaThumb({ message, onOpen }: { message: Message; onOpen: () => void }) {
	const { t } = useI18n()

	const { url, loading, error } = useMediaBlobUrl(message.mediaId)

	if (loading) {
		return (
			<div className='flex aspect-square items-center justify-center rounded-lg bg-ink-100 dark:bg-ink-900'>
				<Spinner />
			</div>
		)
	}

	if (error || !url) {
		return (
			<div className='flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-ink-100 p-2 text-center text-[10px] text-ink-400 dark:bg-ink-900'>
				<AlertCircle className='h-4 w-4' aria-hidden='true' />
				{t("chat.mediaFailed")}
			</div>
		)
	}

	if (message.type === "video") {
		return (
			<button
				type='button'
				onClick={onOpen}
				className='group relative aspect-square overflow-hidden rounded-lg bg-black'
				aria-label={t("chat.mediaPreview.video")}>
				<video src={url} className='h-full w-full object-cover opacity-80 transition group-hover:opacity-60' muted />
				<span className='absolute inset-0 flex items-center justify-center'>
					<span className='flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white'>
						<Play className='h-4 w-4 fill-current' aria-hidden='true' />
					</span>
				</span>
			</button>
		)
	}

	return (
		<button
			type='button'
			onClick={onOpen}
			className='group aspect-square overflow-hidden rounded-lg'
			aria-label={message.filename ?? t("chat.image")}>
			{/* eslint-disable-next-line @next/next/no-img-element -- blob: URL */}
			<img
				src={url}
				alt={message.filename ?? t("chat.image")}
				className='h-full w-full object-cover transition group-hover:opacity-90'
			/>
		</button>
	)
}

function MediaLightbox({ message, onClose }: { message: Message; onClose: () => void }) {
	const { t } = useI18n()

	const { url, loading, error } = useMediaBlobUrl(message.mediaId)

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4'
			onClick={onClose}
			role='dialog'
			aria-modal='true'>
			<div onClick={(event) => event.stopPropagation()} className='max-h-full max-w-full'>
				{loading ? (
					<Spinner />
				) : error || !url ? (
					<p className='text-sm text-white'>{t("chat.mediaFailed")}</p>
				) : message.type === "video" ? (
					<video src={url} controls autoPlay className='max-h-[85vh] max-w-full rounded-lg' />
				) : (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={url} alt={message.filename ?? t("chat.image")} className='max-h-[85vh] max-w-full rounded-lg' />
				)}
			</div>

			<button
				type='button'
				onClick={onClose}
				className='absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20'
				aria-label={t("common.close")}>
				<X className='h-5 w-5' aria-hidden='true' />
			</button>
		</div>
	)
}

function MediaListItem({ message }: { message: Message }) {
	const { t } = useI18n()

	const { url, loading, error } = useMediaBlobUrl(message.mediaId)

	if (message.type === "audio") {
		return (
			<div className='rounded-xl border border-ink-200 p-3 dark:border-ink-700'>
				<div className='mb-2 flex items-center justify-between text-xs text-ink-500 dark:text-ink-400'>
					<span className='flex items-center gap-1.5'>
						<Mic className='h-3.5 w-3.5' aria-hidden='true' />
						{t("chat.voiceMessage")}
					</span>
					<span dir='ltr'>{formatDateTime(message.createdAt)}</span>
				</div>

				{loading ? (
					<Spinner />
				) : error || !url ? (
					<p className='text-xs text-rose-500'>{t("chat.mediaFailed")}</p>
				) : (
					<WhatsAppAudioPlayer src={url} sentTime={formatDateTime(message.createdAt)} />
				)}
			</div>
		)
	}

	return (
		<a
			href={url ?? undefined}
			download={message.filename ?? "file"}
			className={cn(
				"flex items-center gap-3 rounded-xl border border-ink-200 p-3 text-sm transition hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700/40",
				(!url || loading) && "pointer-events-none opacity-60"
			)}>
			<span className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-900 dark:text-ink-300'>
				{loading ? <Spinner /> : <FileText className='h-5 w-5' aria-hidden='true' />}
			</span>
			<span className='min-w-0 flex-1'>
				<span className='block truncate font-medium text-ink-900 dark:text-ink-50'>
					{message.filename ?? t("chat.download")}
				</span>
				<span dir='ltr' className='block text-xs text-ink-400'>
					{formatDateTime(message.createdAt)}
				</span>
			</span>
			{error ? (
				<AlertCircle className='h-4 w-4 flex-shrink-0 text-rose-500' aria-hidden='true' />
			) : (
				<Download className='h-4 w-4 flex-shrink-0 text-ink-400' aria-hidden='true' />
			)}
		</a>
	)
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

function InfoRow({
	icon,
	label,
	count,
	onClick
}: {
	icon: React.ReactNode
	label: string
	count?: number
	onClick: () => void
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className='flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm text-ink-700 transition hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700/50'>
			<span className='flex h-5 w-5 shrink-0 items-center justify-center text-ink-500 dark:text-ink-400'>{icon}</span>
			<span className='min-w-0 flex-1 truncate'>{label}</span>
			{count !== undefined ? <span className='text-xs tabular-nums text-ink-400'>{count}</span> : null}
			<ChevronRight className='h-4 w-4 shrink-0 text-ink-400 rtl:rotate-180' aria-hidden='true' />
		</button>
	)
}

function ActionRow({
	icon,
	label,
	onClick,
	disabled,
	danger,
	title
}: {
	icon: React.ReactNode
	label: string
	onClick: () => void
	disabled?: boolean
	danger?: boolean
	title?: string
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={cn(
				"flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
				danger
					? "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
					: "text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700/50"
			)}>
			<span className='flex h-5 w-5 shrink-0 items-center justify-center'>{icon}</span>
			<span className='min-w-0 flex-1 truncate'>{label}</span>
		</button>
	)
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
	return (
		<button type='button' onClick={onClick} className='group flex w-20 flex-col items-center gap-1.5'>
			<span className='flex h-11 w-11 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition group-hover:border-brand-300 group-hover:bg-brand-50 group-hover:text-brand-700 dark:border-ink-600 dark:text-ink-300 dark:group-hover:border-brand-700 dark:group-hover:bg-brand-900/30'>
				{icon}
			</span>
			<span className='w-full truncate text-center text-xs text-ink-500 dark:text-ink-400'>{label}</span>
		</button>
	)
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

interface Props {
	conversation: Conversation
	messages: Message[]
	phoneCountry: { code: string; name: string } | null
	blocked: boolean
	canManageUsers: boolean
	canManageBlockedNumbers: boolean
	canUnblock: boolean
	hideBusy: boolean
	unblocking: boolean
	onClose: () => void
	onSearch: () => void
	onAddLead: () => void
	onOpenLeads: () => void
	onRename: () => void
	onBlock: () => void
	onUnblock: () => void
	onToggleHide: () => void
	onClear: () => void
	onConversationChange: (conversation: Conversation) => void
}

export function ContactInfoSidebar({
	conversation,
	messages,
	phoneCountry,
	blocked,
	canManageUsers,
	canManageBlockedNumbers,
	canUnblock,
	hideBusy,
	unblocking,
	onClose,
	onSearch,
	onAddLead,
	onOpenLeads,
	onRename,
	onBlock,
	onUnblock,
	onToggleHide,
	onClear,
	onConversationChange
}: Props) {
	const { t, dir } = useI18n()

	// Falls back to English when a translation key hasn't been added yet.
	const tr = (key: string, fallback: string) => {
		const value = t(key)

		return value === key ? fallback : value
	}

	const [view, setView] = useState<View>("main")

	const [selected, setSelected] = useState<Message | null>(null)

	const { visual, files, voices, links } = useMemo(() => {
		const newestFirst = messages.slice().reverse()

		const found: { url: string; at: string }[] = []

		for (const message of newestFirst) {
			if (!message.text) continue

			for (const match of message.text.matchAll(URL_REGEX)) {
				const trailing = match[0].match(TRAILING_PUNCTUATION)?.[0] ?? ""

				const url = match[0].slice(0, match[0].length - trailing.length)

				if (url) found.push({ url, at: message.createdAt })
			}
		}

		return {
			visual: newestFirst.filter((message) => VISUAL_TYPES.has(message.type) && message.mediaId),
			files: newestFirst.filter((message) => message.type === "document" && message.mediaId),
			voices: newestFirst.filter((message) => message.type === "audio" && message.mediaId),
			links: found
		}
	}, [messages])

	const displayName = contactNameWithCountry(conversation)

	const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft

	const canBlockOrUnblock = canManageBlockedNumbers || canManageUsers

	const titles: Record<View, string> = {
		main: tr("chat.info.title", "Contact info"),
		media: tr("chat.mediaImages", "Media"),
		files: tr("chat.mediaDocuments", "Documents"),
		voices: tr("chat.info.voices", "Voice messages"),
		links: tr("chat.info.links", "Links"),
		activity: t("chat.tabActivity")
	}

	const sectionTitle = (icon: React.ReactNode, label: string, count: number) => (
		<h3 className='mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400'>
			{icon}
			{label}
			<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>{count}</span>
		</h3>
	)

	const emptyView = (icon: React.ReactNode, title: string) => (
		<div className='flex flex-1 items-center justify-center p-6'>
			<EmptyState icon={icon} title={title} />
		</div>
	)

	return (
		<aside className='flex h-full min-h-0 w-full flex-col bg-white dark:bg-ink-800'>
			{/* Header */}
			<header className='flex h-14 flex-shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-700'>
				{view !== "main" ? (
					<button
						type='button'
						onClick={() => setView("main")}
						className='btn-ghost h-8 w-8 flex-shrink-0 p-0'
						aria-label={t("chat.back")}
						title={t("chat.back")}>
						<BackIcon className='h-4 w-4' aria-hidden='true' />
					</button>
				) : null}

				<h2 className='min-w-0 flex-1 truncate text-sm font-semibold text-ink-900 dark:text-ink-50'>{titles[view]}</h2>

				<button
					type='button'
					onClick={onClose}
					className='btn-ghost h-8 w-8 flex-shrink-0 p-0'
					aria-label={t("common.close")}
					title={t("common.close")}>
					<X className='h-4 w-4' aria-hidden='true' />
				</button>
			</header>

			{/* Main */}
			{view === "main" ? (
				<div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
					<div className='flex flex-col items-center px-4 pb-4 pt-6 text-center'>
						<div className='relative'>
							<span
								style={{ backgroundColor: colorFromString(conversation.id) }}
								className='flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold text-white'>
								{initialsOf(contactName(conversation))}
							</span>
							<ChannelIcon
								channel={conversation.channel}
								size='lg'
								className='absolute bottom-0 start-0 ring-2 ring-white dark:ring-ink-800'
							/>
						</div>

						<div className='mt-3 flex max-w-full items-center justify-center gap-1.5'>
							<p
								dir={textDirOf(displayName)}
								className='truncate text-base font-semibold text-ink-900 dark:text-ink-50'>
								{displayName}
							</p>
							{conversation.contact?.trusted ? <TrustedStar /> : null}
						</div>

						<p
							dir='ltr'
							className='mt-0.5 flex max-w-full items-center justify-center gap-1.5 text-xs text-ink-500 dark:text-ink-400'>
							{phoneCountry ? (
								<span className='shrink-0' title={phoneCountry.name}>
									<CountryFlag code={phoneCountry.code} />
								</span>
							) : null}
							<bdi className='truncate'>{contactIdentifier(conversation)}</bdi>
						</p>

						<div className='mt-2'>
							<ModeBadge mode={conversation.mode} />
						</div>

						<div className='mt-5 flex items-start justify-center gap-2'>
							<QuickAction
								icon={<Search className='h-4 w-4' aria-hidden='true' />}
								label={t("chat.search")}
								onClick={onSearch}
							/>
							<QuickAction
								icon={<UserRoundPlus className='h-4 w-4' aria-hidden='true' />}
								label={t("chat.addLead")}
								onClick={onAddLead}
							/>
							<QuickAction
								icon={<Pencil className='h-4 w-4' aria-hidden='true' />}
								label={t("chat.renameContact")}
								onClick={onRename}
							/>
						</div>
					</div>

					{/* Save to contacts / link to contact */}
					<div className='border-t border-ink-100 dark:border-ink-700'>
						<ChatContactBar conversation={conversation} onConversationChange={onConversationChange} />
					</div>

					{/* Media preview */}
					<div className='border-t border-ink-100 py-2 dark:border-ink-700'>
						<InfoRow
							icon={<ImageIcon className='h-[18px] w-[18px]' aria-hidden='true' />}
							label={tr("chat.info.mediaFilesLinks", "Media, files and links")}
							count={visual.length + files.length + links.length}
							onClick={() => setView("media")}
						/>

						{visual.length > 0 ? (
							<div className='grid grid-cols-4 gap-1.5 px-4 pb-2 pt-1'>
								{visual.slice(0, 4).map((message) => (
									<MediaThumb key={message.id} message={message} onOpen={() => setSelected(message)} />
								))}
							</div>
						) : null}
					</div>

					<div className='border-t border-ink-100 py-2 dark:border-ink-700'>
						<InfoRow
							icon={<ImageIcon className='h-[18px] w-[18px]' aria-hidden='true' />}
							label={t("chat.mediaImages")}
							count={visual.length}
							onClick={() => setView("media")}
						/>
						<InfoRow
							icon={<FileText className='h-[18px] w-[18px]' aria-hidden='true' />}
							label={t("chat.mediaDocuments")}
							count={files.length}
							onClick={() => setView("files")}
						/>
						<InfoRow
							icon={<Mic className='h-[18px] w-[18px]' aria-hidden='true' />}
							label={tr("chat.info.voices", "Voice messages")}
							count={voices.length}
							onClick={() => setView("voices")}
						/>
						<InfoRow
							icon={<Link2 className='h-[18px] w-[18px]' aria-hidden='true' />}
							label={tr("chat.info.links", "Links")}
							count={links.length}
							onClick={() => setView("links")}
						/>
						{canManageUsers ? (
							<InfoRow
								icon={<History className='h-[18px] w-[18px]' aria-hidden='true' />}
								label={t("chat.tabActivity")}
								onClick={() => setView("activity")}
							/>
						) : null}
					</div>

					<div className='border-t border-ink-100 py-2 dark:border-ink-700'>
						<ActionRow
							icon={<ListChecks className='h-[18px] w-[18px]' aria-hidden='true' />}
							label={t("leads.title")}
							onClick={onOpenLeads}
						/>
						{canManageUsers ? (
							<ActionRow
								icon={
									hideBusy ? (
										<Spinner />
									) : conversation.hidden ? (
										<Eye className='h-[18px] w-[18px]' aria-hidden='true' />
									) : (
										<EyeOff className='h-[18px] w-[18px]' aria-hidden='true' />
									)
								}
								label={t(conversation.hidden ? "chat.unhideConversation" : "chat.hideConversation")}
								onClick={onToggleHide}
								disabled={hideBusy}
							/>
						) : null}
					</div>

					<div className='border-t border-ink-100 py-2 dark:border-ink-700'>
						{canBlockOrUnblock ? (
							blocked ? (
								<ActionRow
									icon={unblocking ? <Spinner /> : <Undo2 className='h-[18px] w-[18px]' aria-hidden='true' />}
									label={
										unblocking
											? t("chat.unblocking")
											: t(conversation.identityBlocked ? "identity.removeLocalBlock" : "chat.unblockContact")
									}
									onClick={onUnblock}
									disabled={unblocking || !canUnblock}
									danger
								/>
							) : (
								<ActionRow
									icon={<Ban className='h-[18px] w-[18px]' aria-hidden='true' />}
									label={t("chat.blockContact")}
									onClick={onBlock}
									disabled={!conversation.phone && !canManageUsers}
									title={!conversation.phone && !canManageUsers ? t("identity.adminOnly") : undefined}
									danger
								/>
							)
						) : null}

						{canManageUsers ? (
							<ActionRow
								icon={<Eraser className='h-[18px] w-[18px]' aria-hidden='true' />}
								label={t("chat.clearMessages")}
								onClick={onClear}
								danger
							/>
						) : null}
					</div>
				</div>
			) : null}

			{/* Media */}
			{view === "media" ? (
				visual.length === 0 ? (
					emptyView(<ImageIcon className='h-5 w-5' aria-hidden='true' />, t("chat.mediaEmpty"))
				) : (
					<div className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-4'>
						{sectionTitle(
							<ImageIcon className='h-3.5 w-3.5' aria-hidden='true' />,
							t("chat.mediaImages"),
							visual.length
						)}

						<div className='grid grid-cols-3 gap-1.5'>
							{visual.map((message) => (
								<MediaThumb key={message.id} message={message} onOpen={() => setSelected(message)} />
							))}
						</div>
					</div>
				)
			) : null}

			{/* Files */}
			{view === "files" ? (
				files.length === 0 ? (
					emptyView(<FileText className='h-5 w-5' aria-hidden='true' />, t("chat.mediaEmpty"))
				) : (
					<div className='min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4'>
						{files.map((message) => (
							<MediaListItem key={message.id} message={message} />
						))}
					</div>
				)
			) : null}

			{/* Voices */}
			{view === "voices" ? (
				voices.length === 0 ? (
					emptyView(<Mic className='h-5 w-5' aria-hidden='true' />, t("chat.mediaEmpty"))
				) : (
					<div className='min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4'>
						{voices.map((message) => (
							<MediaListItem key={message.id} message={message} />
						))}
					</div>
				)
			) : null}

			{/* Links */}
			{view === "links" ? (
				links.length === 0 ? (
					emptyView(<Link2 className='h-5 w-5' aria-hidden='true' />, tr("chat.info.noLinks", "No links shared yet"))
				) : (
					<ul className='min-h-0 flex-1 divide-y divide-ink-100 overflow-y-auto overscroll-contain dark:divide-ink-700/70'>
						{links.map((link, index) => (
							<li key={`${link.url}-${index}`}>
								<a
									href={/^https?:\/\//i.test(link.url) ? link.url : `https://${link.url}`}
									target='_blank'
									rel='noopener noreferrer'
									className='flex items-center gap-3 px-4 py-3 transition hover:bg-ink-50 dark:hover:bg-ink-700/50'>
									<span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-900 dark:text-ink-300'>
										<Link2 className='h-4 w-4' aria-hidden='true' />
									</span>
									<span className='min-w-0 flex-1'>
										<span dir='ltr' className='block truncate text-sm font-medium text-brand-600 dark:text-brand-300'>
											{link.url}
										</span>
										<span dir='ltr' className='block text-xs text-ink-400'>
											{formatDateTime(link.at)}
										</span>
									</span>
									<ExternalLink className='h-4 w-4 shrink-0 text-ink-400' aria-hidden='true' />
								</a>
							</li>
						))}
					</ul>
				)
			) : null}

			{/* Activity */}
			{view === "activity" ? (
				<div className='flex min-h-0 flex-1 flex-col'>
					<ActivityPanel conversationId={conversation.id} active />
				</div>
			) : null}

			{selected ? <MediaLightbox message={selected} onClose={() => setSelected(null)} /> : null}
		</aside>
	)
}
