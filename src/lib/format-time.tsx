export const formatTime = (seconds: number) => {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return "0:00"
	}

	const minutes = Math.floor(seconds / 60)

	const remainingSeconds = Math.floor(seconds % 60)

	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}
