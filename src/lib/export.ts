import type { Conversation } from "@/lib/types"

function escapeCsvValue(value: unknown): string {
	const str = value === null || value === undefined ? "" : String(value)

	return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
	const lines = [headers.map(escapeCsvValue).join(",")]

	rows.forEach((row) => lines.push(row.map(escapeCsvValue).join(",")))

	return "\uFEFF" + lines.join("\r\n")
}

function downloadCsv(filename: string, csv: string): void {
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })

	const url = URL.createObjectURL(blob)

	const link = document.createElement("a")

	link.href = url
	link.setAttribute("download", filename)
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}

export function exportContactsToCsv(conversations: Conversation[], filename = "contacts.csv"): void {
	const headers = ["Name", "Phone"]

	const rows = conversations.map((c) => [c.customerName ?? "", c.phone ?? ""])

	downloadCsv(filename, rowsToCsv(headers, rows))
}

export interface ExportableMessage {
	sender?: string | null
	direction?: string | null
	body?: string | null
	text?: string | null
	createdAt?: string | null
	timestamp?: string | null
}

export function exportConversationToCsv(
	conversation: Conversation,
	messages: ExportableMessage[],
	filename?: string
): void {
	const headers = ["Time", "Sender", "Message"]

	const rows = messages.map((m) => [
		m.createdAt ?? m.timestamp ?? "",
		m.sender ?? m.direction ?? "",
		m.body ?? m.text ?? ""
	])

	const safeName = (conversation.customerName || conversation.phone || conversation.id).replace(/[^a-z0-9]+/gi, "_")

	downloadCsv(filename ?? `conversation_${safeName}.csv`, rowsToCsv(headers, rows))
}
