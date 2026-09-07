import { request, unwrapItem, unwrapList } from "@/lib/http"
import type { CreateLeadPayload, Lead, LeadService, LeadsListParams, LeadsPage, UpdateLeadPayload } from "./types"

function buildQuery(params: LeadsListParams): string {
	const search = new URLSearchParams()

	if (params.status) search.set("status", params.status)

	if (params.source) search.set("source", params.source)

	if (params.serviceId !== undefined) search.set("serviceId", String(params.serviceId))

	if (params.createdBy !== undefined) search.set("createdBy", String(params.createdBy))

	if (params.mine) search.set("mine", "true")

	if (params.search) search.set("search", params.search)

	if (params.from) search.set("from", params.from)

	if (params.to) search.set("to", params.to)

	search.set("page", String(params.page ?? 0))
	search.set("size", String(params.size ?? 20))

	return search.toString()
}

export const leadsApi = {
	async list(params: LeadsListParams = {}, signal?: AbortSignal): Promise<LeadsPage> {
		const payload = await request<unknown>(`/api/leads?${buildQuery(params)}`, { signal })

		return unwrapItem<LeadsPage>(payload, "data")
	},

	async services(signal?: AbortSignal): Promise<LeadService[]> {
		const payload = await request<unknown>("/api/leads/services", { signal })

		return unwrapList<LeadService>(payload, "services")
	},

	async create(payload: CreateLeadPayload): Promise<Lead> {
		const result = await request<unknown>("/api/leads", { method: "POST", body: payload })

		return unwrapItem<Lead>(result, "lead")
	},

	async update(id: number, payload: UpdateLeadPayload): Promise<Lead> {
		const result = await request<unknown>(`/api/leads/${id}`, { method: "PATCH", body: payload })

		return unwrapItem<Lead>(result, "lead")
	}
}
