"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
	ArrowRight,
	Ban,
	Bell,
	Bot,
	Clock,
	Headphones,
	MessageSquare,
	RefreshCw,
	Users as UsersIcon
} from "lucide-react"
import { adminApi, api } from "@/lib/api"
import { errorKey } from "@/lib/errors"
import { usePoll } from "@/hooks/use-poll"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useNotifications } from "@/providers/notifications-provider"
import { AppShell } from "@/components/layout/app-shell"
import { Avatar } from "@/components/ui/avatar"
import { ModeBadge } from "@/components/ui/badges"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"
import type { Conversation } from "@/lib/types"

interface Metric {
	key: string
	label: string
	value: number | null
	icon: typeof Clock
	tone: string
	href: string
}

export default function OverviewPage() {
	const { t, formatRelative } = useI18n()

	const { agent, canManageUsers } = useAuth()

	const { unread } = useNotifications()

	const [conversations, setConversations] = useState<Conversation[]>([])

	const [blockedCount, setBlockedCount] = useState<number | null>(null)

	const [userCount, setUserCount] = useState<number | null>(null)

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const load = useCallback(async () => {
		const tasks: Array<Promise<unknown>> = [
			api
				.conversations("all")
				.then((list) => {
					setConversations(list)
					setFailure(null)
				})
				.catch((error) => setFailure(errorKey(error))),
			adminApi
				.listBlockedCountries()
				.then((list) => setBlockedCount(list.length))
				.catch(() => setBlockedCount(null))
		]

		if (canManageUsers) {
			tasks.push(
				adminApi
					.listUsers()
					.then((list) => setUserCount(list.length))
					.catch(() => setUserCount(null))
			)
		}

		await Promise.allSettled(tasks)
		setLoading(false)
	}, [canManageUsers])

	useEffect(() => {
		void load()
	}, [load])

	usePoll(() => void load(), 30_000, true)

	const counts = useMemo(() => {
		let waiting = 0

		let bot = 0

		let mine = 0

		for (const conversation of conversations) {
			if (conversation.mode === "waiting") waiting += 1

			if (conversation.mode === "bot") bot += 1

			if (agent && conversation.assigneeId === agent.id) mine += 1
		}

		return { waiting, bot, mine, total: conversations.length }
	}, [conversations, agent])

	const metrics: Metric[] = [
		{
			key: "waiting",
			label: t("overview.waiting"),
			value: counts.waiting,
			icon: Clock,
			tone: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-200",
			href: "/conversations?filter=waiting"
		},
		{
			key: "bot",
			label: t("overview.bot"),
			value: counts.bot,
			icon: Bot,
			tone: "bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200",
			href: "/conversations?filter=bot"
		},
		{
			key: "mine",
			label: t("overview.mine"),
			value: counts.mine,
			icon: Headphones,
			tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-200",
			href: "/conversations?filter=mine"
		},
		{
			key: "total",
			label: t("overview.total"),
			value: counts.total,
			icon: MessageSquare,
			tone: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200",
			href: "/conversations"
		},
		{
			key: "unread",
			label: t("overview.unread"),
			value: unread,
			icon: Bell,
			tone: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-200",
			href: "/notifications"
		}
	]

	if (canManageUsers) {
		metrics.push({
			key: "users",
			label: t("overview.users"),
			value: userCount,
			icon: UsersIcon,
			tone: "bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-200",
			href: "/users"
		})
	}

	const recent = conversations.slice(0, 8)

	return (
		<AppShell
			title={t("overview.title")}
			subtitle={failure ? t(failure) : t("overview.subtitle")}
			actions={
				<button
					type='button'
					onClick={() => void load()}
					className='btn-secondary px-3 py-2'
					aria-label={t("common.refresh")}
					title={t("common.refresh")}>
					<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden='true' />
				</button>
			}>
			<section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
				{metrics.map((metric) => {
					const Icon = metric.icon

					return (
						<Link
							key={metric.key}
							href={metric.href}
							className='card flex animate-fade-in items-center gap-4 p-4 transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700'>
							<span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${metric.tone}`}>
								<Icon className='h-5 w-5' aria-hidden='true' />
							</span>
							<span className='min-w-0'>
								<span className='block text-2xl font-semibold text-ink-900 dark:text-ink-50'>
									{loading && metric.value === null ? (
										<span className='skeleton inline-block h-6 w-10 align-middle' />
									) : (
										(metric.value ?? "—")
									)}
								</span>
								<span className='block truncate text-xs text-ink-500 dark:text-ink-400'>{metric.label}</span>
							</span>
						</Link>
					)
				})}
			</section>

			<section className='card overflow-hidden'>
				<header className='flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700'>
					<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("overview.recent")}</h2>
					<Link
						href='/conversations'
						className='inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300'>
						{t("overview.openInbox")}
						<ArrowRight className='h-4 w-4 rtl:rotate-180' aria-hidden='true' />
					</Link>
				</header>

				{loading && recent.length === 0 ? (
					<ul className='space-y-3 p-5'>
						{[0, 1, 2, 3].map((index) => (
							<li key={index} className='flex items-center gap-3'>
								<span className='skeleton h-10 w-10 rounded-full' />
								<span className='flex-1 space-y-2'>
									<span className='skeleton block h-3 w-1/3' />
									<span className='skeleton block h-3 w-2/3' />
								</span>
							</li>
						))}
					</ul>
				) : recent.length === 0 ? (
					<EmptyState icon={<MessageSquare className='h-5 w-5' aria-hidden='true' />} title={t("inbox.empty")} />
				) : (
					<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
						{recent.map((conversation) => (
							<li key={conversation.id}>
								<Link
									href={`/conversations?id=${conversation.id}`}
									className='flex items-center gap-3 px-5 py-3 transition hover:bg-ink-50 dark:hover:bg-ink-700/50'>
									<Avatar name={conversation.customerName} seed={conversation.phone} />
									<span className='min-w-0 flex-1'>
										<span className='block truncate text-sm font-medium text-ink-900 dark:text-ink-50'>
											{conversation.customerName?.trim() || conversation.phone}
										</span>
										<span className='block truncate text-xs text-ink-500 dark:text-ink-400'>
											{conversation.preview ?? conversation.phone}
										</span>
									</span>
									<span className='flex shrink-0 flex-col items-end gap-1'>
										<ModeBadge mode={conversation.mode} />
										{conversation.lastMessageAt ? (
											<span className='text-[11px] text-ink-400'>{formatRelative(conversation.lastMessageAt)}</span>
										) : null}
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>
		</AppShell>
	)
}
