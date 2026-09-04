"use client"

import { useState } from "react"
import { Eye, EyeOff, Inbox, Search } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { useAuth } from "@/providers/auth-provider"
import { Avatar } from "@/components/ui/avatar"
import { ModeBadge } from "@/components/ui/badges"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { cn, textDirOf } from "@/lib/utils"
import type { Conversation } from "@/lib/types"

export type InboxFilter = "all" | "bot" | "mine" | "hidden"

const filters: InboxFilter[] = ["all", "bot", "mine", "hidden"]

interface Props {
	conversations: Conversation[]
	activeId: string | null
	filter: InboxFilter
	search: string
	loading: boolean
	onSelect: (id: string) => void
	onFilterChange: (filter: InboxFilter) => void
	onSearchChange: (value: string) => void
	onToggleHide?: (id: string, hide: boolean) => void | Promise<void>
	onClearHidden?: () => void | Promise<void>
	clearingHidden?: boolean
}

export function ConversationList({
	conversations,
	activeId,
	filter,
	search,
	loading,
	onSelect,
	onFilterChange,
	onSearchChange,
	onToggleHide
}: Props) {
	const { t, formatRelative } = useI18n()

	const { agent, canManageUsers } = useAuth()

	const [busyId, setBusyId] = useState<string | null>(null)

	const toggleHide = async (id: string, hide: boolean) => {
		if (!onToggleHide) return

		setBusyId(id)

		try {
			await onToggleHide(id, hide)
		} finally {
			setBusyId((current) => (current === id ? null : current))
		}
	}

	return (
		<div className='flex h-full min-h-0 flex-col'>
			<div className='space-y-3 border-b border-ink-200 p-3 dark:border-ink-700'>
				<div className='relative'>
					<Search
						className='pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-400'
						aria-hidden='true'
					/>
					<input
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder={t("inbox.searchPlaceholder")}
						aria-label={t("common.search")}
						className='input ps-9'
					/>
				</div>

				<div role='tablist' className='flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-900'>
					{filters
						.filter((value) => (value === "hidden" ? canManageUsers : value === "mine" ? !canManageUsers : true))
						.map((value) => (
							<button
								key={value}
								type='button'
								role='tab'
								aria-selected={filter === value}
								onClick={() => onFilterChange(value)}
								className={cn(
									"flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition",
									filter === value
										? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50"
										: "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
								)}>
								{t(`inbox.filters.${value}`)}
							</button>
						))}
				</div>
			</div>

			<div className='min-h-0 flex-1 overflow-y-auto'>
				{loading && conversations.length === 0 ? (
					<ul className='space-y-2 p-3'>
						{[0, 1, 2, 3, 4].map((index) => (
							<li key={index} className='flex gap-3'>
								<span className='skeleton h-10 w-10 rounded-full' />
								<span className='flex-1 space-y-2 py-1'>
									<span className='skeleton block h-3 w-1/2' />
									<span className='skeleton block h-3 w-3/4' />
								</span>
							</li>
						))}
					</ul>
				) : conversations.length === 0 ? (
					<EmptyState
						icon={<Inbox className='h-5 w-5' aria-hidden='true' />}
						title={t(filter === "hidden" ? "inbox.hiddenEmpty" : "inbox.empty")}
					/>
				) : (
					<ul className='h-[100px] divide-y divide-ink-100 dark:divide-ink-700/70 md:h-full'>
						{conversations.map((conversation) => {
							const active = conversation.id === activeId

							const name = conversation.customerName?.trim() || conversation.phone

							const mine = conversation.assigneeId && conversation.assigneeId === agent?.id

							const unread = conversation.unreadCount ?? 0

							return (
								<li key={conversation.id} className='group relative'>
									<button
										type='button'
										onClick={() => onSelect(conversation.id)}
										aria-current={active ? "true" : undefined}
										className={cn(
											"flex w-full items-start gap-3 p-3 text-start transition",
											onToggleHide && "pe-11",
											active ? "bg-brand-50 dark:bg-brand-900/30" : "hover:bg-ink-50 dark:hover:bg-ink-700/50"
										)}>
										<Avatar name={conversation.customerName} seed={conversation.phone} />
										<span className='min-w-0 flex-1'>
											<span className='flex items-baseline justify-between gap-2'>
												<span
													dir={textDirOf(name)}
													className={cn(
														"truncate text-sm text-ink-900 dark:text-ink-50",
														unread > 0 ? "font-semibold" : "font-medium"
													)}>
													{name}
												</span>
												{conversation.lastMessageAt ? (
													<span className='shrink-0 text-[11px] text-ink-400'>
														{formatRelative(conversation.lastMessageAt)}
													</span>
												) : null}
											</span>
											<span className='mt-0.5 flex items-center justify-between gap-2'>
												<span
													dir={textDirOf(conversation.preview)}
													className={cn(
														"min-w-0 flex-1 truncate text-xs",
														unread > 0 ? "font-medium text-ink-800 dark:text-ink-100" : "text-ink-500 dark:text-ink-400"
													)}>
													{conversation.preview ?? conversation.phone}
												</span>
												{unread > 0 ? (
													<span
														className='flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold tabular-nums text-white'
														aria-label={t("inbox.unreadCount", { n: unread })}>
														{unread > 99 ? "99+" : unread}
													</span>
												) : null}
											</span>
											<span className='mt-1.5 flex items-center gap-2'>
												<ModeBadge mode={conversation.mode} />
												<span className='truncate text-[11px] text-ink-400'>
													{conversation.assigneeId
														? t("inbox.assignedTo", {
																name: mine ? t("inbox.you") : (conversation.assignee?.name ?? t("common.unknown"))
															})
														: t("inbox.unassigned")}
												</span>
											</span>
										</span>
									</button>

									{onToggleHide ? (
										<button
											type='button'
											onClick={(event) => {
												event.stopPropagation()
												void toggleHide(conversation.id, filter !== "hidden")
											}}
											disabled={busyId === conversation.id}
											title={t(filter === "hidden" ? "inbox.unhideConversation" : "inbox.hideConversation")}
											aria-label={t(filter === "hidden" ? "inbox.unhideConversation" : "inbox.hideConversation")}
											className={cn(
												"absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100",
												filter === "hidden"
													? "opacity-100"
													: "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
											)}>
											{busyId === conversation.id ? (
												<Spinner />
											) : filter === "hidden" ? (
												<Eye className='h-4 w-4' aria-hidden='true' />
											) : (
												<EyeOff className='h-4 w-4' aria-hidden='true' />
											)}
										</button>
									) : null}
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</div>
	)
}
