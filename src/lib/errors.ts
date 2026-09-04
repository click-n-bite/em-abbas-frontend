import { ApiError } from "./api"

export function errorKey(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.code === "NETWORK_ERROR") return "errors.network"

		if (error.status === 401) return "errors.unauthorized"

		const known = [
			"MODE_NOT_AGENT",
			"NOT_ASSIGNEE",
			"ALREADY_CLAIMED",
			"MODE_NOT_BOT",
			"INVALID_CREDENTIALS",
			"NUMBER_BLOCKED"
		]

		if (known.includes(error.code)) return `errors.${error.code}`

		if (error.message?.startsWith("errors.")) return error.message
	}

	return "errors.generic"
}

export function errorDetail(error: unknown): string | null {
	if (error instanceof ApiError && error.message && !error.message.startsWith("errors.")) {
		return error.message
	}

	return null
}
