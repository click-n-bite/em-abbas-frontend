"use client"

import { useEffect, useState } from "react"

import { api } from "@/lib/api"

const MEDIA_BLOB_CACHE_MAX = 200

const mediaBlobCache = new Map<string, string>()

function getCachedMediaBlobUrl(mediaId: string): string | undefined {
	const cached = mediaBlobCache.get(mediaId)

	if (cached !== undefined) {
		mediaBlobCache.delete(mediaId)
		mediaBlobCache.set(mediaId, cached)
	}

	return cached
}

function setCachedMediaBlobUrl(mediaId: string, url: string): void {
	const existing = mediaBlobCache.get(mediaId)

	if (existing !== undefined) {
		if (existing !== url) URL.revokeObjectURL(existing)

		mediaBlobCache.delete(mediaId)
	}

	mediaBlobCache.set(mediaId, url)

	if (mediaBlobCache.size > MEDIA_BLOB_CACHE_MAX) {
		const oldestKey = mediaBlobCache.keys().next().value

		if (oldestKey !== undefined) {
			const oldestUrl = mediaBlobCache.get(oldestKey)

			mediaBlobCache.delete(oldestKey)

			if (oldestUrl) URL.revokeObjectURL(oldestUrl)
		}
	}
}

export function useMediaBlobUrl(mediaId: string | null | undefined) {
	const [url, setUrl] = useState<string | null>(() => (mediaId ? (getCachedMediaBlobUrl(mediaId) ?? null) : null))

	const [loading, setLoading] = useState(false)

	const [error, setError] = useState(false)

	useEffect(() => {
		if (!mediaId) {
			setUrl(null)
			setError(false)

			return
		}

		const cached = getCachedMediaBlobUrl(mediaId)

		if (cached) {
			setUrl(cached)
			setError(false)
			setLoading(false)

			return
		}

		let cancelled = false

		const controller = new AbortController()

		setLoading(true)
		setError(false)

		api
			.mediaBlobUrl(mediaId, controller.signal)
			.then((blobUrl) => {
				setCachedMediaBlobUrl(mediaId, blobUrl)

				if (cancelled) return

				setUrl(blobUrl)
			})
			.catch((err) => {
				if ((err as Error)?.name === "AbortError") return

				if (!cancelled) setError(true)
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})

		return () => {
			cancelled = true
			controller.abort()
		}
	}, [mediaId])

	return { url, loading, error }
}
