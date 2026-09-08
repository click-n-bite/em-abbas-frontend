"use client"

import { useEffect, useState, useRef } from "react"
import { Modal } from "@/components/ui/modal"
import { Spinner } from "@/components/ui/spinner"
import { useI18n } from "@/providers/i18n-provider"
import { leadsApi } from "@/lib/api"
import type { LeadService } from "@/lib/types"
import { MAX_NOTE_LENGTH } from "@/lib/config"
import { Search, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConversationOption {
	id: string
	label: string
}

interface Props {
	open: boolean
	onClose: () => void
	onSubmit: (payload: { conversationId: string; serviceId: number; note?: string }) => Promise<void>
	/** When set, the conversation is fixed (e.g. opened from inside a chat) and the picker is hidden. */
	fixedConversation?: ConversationOption
	/** Otherwise, pass the list of conversations the user may attach a lead to (e.g. from the leads page). */
	conversationOptions?: ConversationOption[]
}

interface SearchableSelectProps {
	value: string
	onChange: (value: string) => void
	options: { id: string; label: string }[]
	placeholder: string
	label: string
	emptyMessage?: string
	disabled?: boolean
}

function SearchableSelect({
	value,
	onChange,
	options,
	placeholder,
	label,
	emptyMessage,
	disabled
}: SearchableSelectProps) {
	const [isOpen, setIsOpen] = useState(false)

	const [search, setSearch] = useState("")

	const dropdownRef = useRef<HTMLDivElement>(null)

	const inputRef = useRef<HTMLInputElement>(null)

	const selectedOption = options.find((opt) => opt.id === value)

	const filteredOptions = options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()))

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)

		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	useEffect(() => {
		if (isOpen) {
			setSearch("")
			setTimeout(() => inputRef.current?.focus(), 50)
		}
	}, [isOpen])

	const handleSelect = (id: string) => {
		onChange(id)
		setIsOpen(false)
		setSearch("")
	}

	return (
		<div className='relative' ref={dropdownRef}>
			<label className='mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200'>{label}</label>
			<button
				type='button'
				className={cn(
					"flex w-full items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm transition-colors dark:border-ink-700 dark:bg-ink-800",
					"hover:border-ink-300 dark:hover:border-ink-600",
					"focus:outline-none focus:ring-2 focus:ring-brand-500",
					disabled && "cursor-not-allowed opacity-50",
					isOpen && "border-brand-500 ring-2 ring-brand-500"
				)}
				onClick={() => !disabled && setIsOpen(!isOpen)}
				disabled={disabled}>
				<span className={cn("truncate", !selectedOption && "text-ink-400")}>
					{selectedOption?.label || placeholder}
				</span>
				<ChevronDown className={cn("h-4 w-4 text-ink-400 transition-transform duration-200", isOpen && "rotate-180")} />
			</button>

			{isOpen && (
				<div className='absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg dark:border-ink-700 dark:bg-ink-800'>
					<div className='relative border-b border-ink-100 p-2 dark:border-ink-700'>
						<Search className='absolute inset-y-0 start-5 my-auto h-4 w-4 text-ink-400' />
						<input
							ref={inputRef}
							type='text'
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={placeholder}
							className='w-full rounded-lg border border-ink-200 bg-ink-50 py-1.5 pe-3 ps-9 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50 dark:placeholder:text-ink-500'
							onClick={(e) => e.stopPropagation()}
						/>
					</div>
					<div className='max-h-40 overflow-y-auto'>
						{filteredOptions.length === 0 ? (
							<p className='px-3 py-2 text-sm text-ink-400'>{emptyMessage || "No options found"}</p>
						) : (
							filteredOptions.map((option) => (
								<button
									key={option.id}
									type='button'
									className={cn(
										"w-full px-3 py-2 text-start text-sm transition-colors hover:bg-ink-50 dark:hover:bg-ink-700",
										value === option.id && "bg-brand-50 dark:bg-brand-900/20"
									)}
									onClick={() => handleSelect(option.id)}>
									{option.label}
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	)
}

export function LeadFormModal({ open, onClose, onSubmit, fixedConversation, conversationOptions }: Props) {
	const { t } = useI18n()

	const [services, setServices] = useState<LeadService[]>([])

	const [conversationId, setConversationId] = useState("")

	const [serviceId, setServiceId] = useState("")

	const [note, setNote] = useState("")

	const [submitting, setSubmitting] = useState(false)

	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open) return

		setConversationId(fixedConversation?.id ?? "")
		setServiceId("")
		setNote("")
		setError(null)

		leadsApi
			.services()
			.then(setServices)
			.catch(() => setServices([]))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	const submit = async () => {
		if (!conversationId || !serviceId || submitting) return

		setSubmitting(true)
		setError(null)

		try {
			await onSubmit({ conversationId, serviceId: Number(serviceId), note: note.trim() || undefined })
		} catch (err) {
			setError((err as Error)?.message ?? null)
		} finally {
			setSubmitting(false)
		}
	}

	const conversationList = conversationOptions ?? []

	const serviceList = services.map((s) => ({ id: String(s.id), label: s.name }))

	return (
		<Modal
			open={open}
			title={t("leads.addTitle")}
			description={t("leads.addSubtitle")}
			onClose={submitting ? () => undefined : onClose}
			footer={
				<>
					<button type='button' className='btn-secondary' onClick={onClose} disabled={submitting}>
						{t("common.cancel")}
					</button>
					<button
						type='button'
						className='btn-primary'
						onClick={() => void submit()}
						disabled={submitting || !conversationId || !serviceId}>
						{submitting ? <Spinner /> : null}
						{submitting ? t("leads.adding") : t("leads.add")}
					</button>
				</>
			}>
			<div className='space-y-4'>
				{!fixedConversation ? (
					<SearchableSelect
						value={conversationId}
						onChange={setConversationId}
						options={conversationList}
						placeholder={t("leads.conversationPlaceholder")}
						label={t("leads.conversation")}
						emptyMessage={t("leads.noConversationsHint")}
						disabled={conversationList.length === 0}
					/>
				) : null}

				<SearchableSelect
					value={serviceId}
					onChange={setServiceId}
					options={serviceList}
					placeholder={t("leads.servicePlaceholder")}
					label={t("leads.service")}
					emptyMessage='No services available'
					disabled={serviceList.length === 0}
				/>

				<label className='block'>
					<span className='mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200'>{t("leads.note")}</span>
					<textarea
						value={note}
						onChange={(event) => setNote(event.target.value)}
						placeholder={t("leads.notePlaceholder")}
						rows={3}
						maxLength={MAX_NOTE_LENGTH}
						className='input resize-y'
					/>
				</label>

				{error ? <p className='text-sm text-rose-600 dark:text-rose-400'>{error}</p> : null}
			</div>
		</Modal>
	)
}
