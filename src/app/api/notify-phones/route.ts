import { NextResponse } from "next/server"
import { requireCaller, toErrorResponse } from "@/server/guard"
import { store } from "@/server/store"

export const dynamic = "force-dynamic"

/** List the WhatsApp numbers that receive portal notifications. */
export async function GET(request: Request) {
	try {
		requireCaller(request, ["superadmin", "admin"])

		return NextResponse.json(await store.listNotifyPhones())
	} catch (error) {
		return toErrorResponse(error)
	}
}

/** Register a new notification number. */
export async function POST(request: Request) {
	try {
		const caller = requireCaller(request, ["superadmin", "admin"])

		const body = (await request.json()) as Record<string, unknown>

		const entry = await store.addNotifyPhone({
			phone: String(body.phone ?? ""),
			country: body.country === null ? null : String(body.country ?? "") || null,
			label: body.label === null ? null : String(body.label ?? "") || null,
			createdBy: String(body.createdBy ?? caller.email) || null
		})

		return NextResponse.json(entry, { status: 201 })
	} catch (error) {
		return toErrorResponse(error)
	}
}
