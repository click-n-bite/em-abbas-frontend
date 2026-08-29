import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import type { NotifyPhone } from "@/lib/types"

/**
 * Users and blocked countries are now served by the real EMA backend
 * (see users/api.ts and blacklist/api.ts). This local store only backs
 * notification numbers, which don't have a backend endpoint yet.
 */
interface StoreShape {
	notifyPhones: NotifyPhone[]
}

const DATA_DIR = path.join(process.cwd(), ".data")

const DATA_FILE = path.join(DATA_DIR, "portal-store.json")

function now(): string {
	return new Date().toISOString()
}

function seed(): StoreShape {
	return { notifyPhones: [] }
}

let memory: StoreShape | null = null

let writable = true

async function load(): Promise<StoreShape> {
	if (memory) return memory

	try {
		const raw = await fs.readFile(DATA_FILE, "utf8")

		const parsed = JSON.parse(raw) as Partial<StoreShape>

		memory = { notifyPhones: parsed.notifyPhones ?? [] }
	} catch {
		memory = seed()
		await persist(memory)
	}

	return memory
}

async function persist(state: StoreShape): Promise<void> {
	memory = state

	if (!writable) return

	try {
		await fs.mkdir(DATA_DIR, { recursive: true })
		await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), "utf8")
	} catch {
		// Read-only filesystem: keep serving from memory for the process lifetime.
		writable = false
	}
}

export class StoreError extends Error {
	status: number
	code: string

	constructor(status: number, code: string, message: string) {
		super(message)
		this.status = status
		this.code = code
	}
}

export interface NotifyPhoneInput {
	phone: string
	country?: string | null
	label?: string | null
	createdBy?: string | null
}

export const store = {
	async listNotifyPhones(): Promise<NotifyPhone[]> {
		const state = await load()

		return [...state.notifyPhones].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
	},

	async addNotifyPhone(input: NotifyPhoneInput): Promise<NotifyPhone> {
		const state = await load()

		const phone = input.phone.replace(/[^\d+]/g, "")

		if (!/^\+\d{6,15}$/.test(phone)) {
			throw new StoreError(400, "INVALID_PHONE", "notifyPhones.invalid")
		}

		if (state.notifyPhones.some((entry) => entry.phone === phone)) {
			throw new StoreError(409, "DUPLICATE_PHONE", "notifyPhones.duplicate")
		}

		const entry: NotifyPhone = {
			id: randomUUID(),
			phone,
			country: input.country?.toUpperCase() || null,
			label: input.label?.trim() || null,
			createdAt: now(),
			createdBy: input.createdBy ?? null
		}

		await persist({ ...state, notifyPhones: [...state.notifyPhones, entry] })

		return entry
	},

	async deleteNotifyPhone(id: string): Promise<void> {
		const state = await load()

		if (!state.notifyPhones.some((entry) => entry.id === id)) {
			throw new StoreError(404, "NOT_FOUND", "Number not found")
		}

		await persist({
			...state,
			notifyPhones: state.notifyPhones.filter((entry) => entry.id !== id)
		})
	}
}
