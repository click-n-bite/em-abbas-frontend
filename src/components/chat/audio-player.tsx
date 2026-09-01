"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { formatTime } from "@/lib/format-time"

interface WhatsAppAudioPlayerProps {
	src: string
	sentTime?: string
}

export function WhatsAppAudioPlayer({ src, sentTime }: WhatsAppAudioPlayerProps) {
	const audioRef = useRef<HTMLAudioElement | null>(null)

	const [isPlaying, setIsPlaying] = useState(false)

	const [currentTime, setCurrentTime] = useState(0)

	const [duration, setDuration] = useState(0)

	useEffect(() => {
		const audio = audioRef.current

		if (!audio) return

		const handleLoadedMetadata = () => {
			setDuration(audio.duration)
		}

		const handleTimeUpdate = () => {
			setCurrentTime(audio.currentTime)
		}

		const handleEnded = () => {
			setIsPlaying(false)
			setCurrentTime(0)
		}

		audio.addEventListener("loadedmetadata", handleLoadedMetadata)
		audio.addEventListener("timeupdate", handleTimeUpdate)
		audio.addEventListener("ended", handleEnded)

		return () => {
			audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
			audio.removeEventListener("timeupdate", handleTimeUpdate)
			audio.removeEventListener("ended", handleEnded)
		}
	}, [])

	const togglePlay = async () => {
		const audio = audioRef.current

		if (!audio) return

		if (isPlaying) {
			audio.pause()
			setIsPlaying(false)

			return
		}

		try {
			await audio.play()
			setIsPlaying(true)
		} catch (error) {
			console.error("Failed to play audio:", error)
		}
	}

	const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
		const audio = audioRef.current

		if (!audio || !duration) return

		const rect = event.currentTarget.getBoundingClientRect()

		const clickPosition = event.clientX - rect.left

		const percentage = clickPosition / rect.width

		audio.currentTime = percentage * duration
	}

	const progress = duration > 0 ? (currentTime / duration) * 100 : 0

	const waveform = [
		8, 14, 20, 11, 17, 24, 15, 9, 19, 25, 13, 18, 10, 22, 16, 8, 14, 21, 12, 18, 26, 15, 10, 17, 23, 13, 19, 9, 16, 24,
		14, 20, 11, 17, 22
	]

	return (
		<div className='flex min-w-[230px] max-w-[280px] items-center gap-2 py-1'>
			<audio ref={audioRef} src={src} preload='metadata' />

			{/* Play / Pause */}
			<button
				type='button'
				onClick={togglePlay}
				className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-200 text-ink-600 transition hover:bg-ink-300 dark:bg-ink-700 dark:text-ink-200 dark:hover:bg-ink-600'
				aria-label={isPlaying ? "Pause audio" : "Play audio"}>
				{isPlaying ? (
					<Pause className='h-3.5 w-3.5 fill-current' />
				) : (
					<Play className='ml-0.5 h-3.5 w-3.5 fill-current' />
				)}
			</button>

			<div className='min-w-0 flex-1'>
				{/* Waveform */}
				<div onClick={handleProgressClick} className='flex h-7 cursor-pointer items-center gap-[2px]'>
					{waveform.map((height, index) => {
						const percentage = ((index + 1) / waveform.length) * 100

						const active = percentage <= progress

						return (
							<span
								key={index}
								className={`w-[2px] shrink-0 rounded-full transition-colors ${
									active ? "bg-ink-500 dark:bg-ink-300" : "bg-ink-200 dark:bg-ink-600"
								}`}
								style={{
									height: `${height * 0.65}px`
								}}
							/>
						)
					})}
				</div>

				<div className='mt-0.5 flex items-center justify-between text-[10px] leading-none text-gray-300 dark:text-gray-300'>
					<span dir='ltr'>{formatTime(duration)}</span>

					{sentTime ? <span dir='ltr'>{sentTime}</span> : null}
				</div>
			</div>
		</div>
	)
}
