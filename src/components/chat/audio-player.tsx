"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"

interface WhatsAppAudioPlayerProps {
	src: string
}

export function WhatsAppAudioPlayer({ src }: WhatsAppAudioPlayerProps) {
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

	const formatTime = (seconds: number) => {
		if (!Number.isFinite(seconds)) {
			return "0:00"
		}

		const minutes = Math.floor(seconds / 60)

		const remainingSeconds = Math.floor(seconds % 60)

		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
	}

	const progress = duration > 0 ? (currentTime / duration) * 100 : 0

	const waveform = [
		8, 14, 20, 11, 17, 24, 15, 9, 19, 25, 13, 18, 10, 22, 16, 8, 14, 21, 12, 18, 26, 15, 10, 17, 23, 13, 19, 9, 16, 24,
		14, 20, 11, 17, 22
	]

	return (
		<div className='mb-1 flex w-[280px] max-w-full items-center gap-3 rounded-2xl bg-gray-100 px-3 py-2 dark:bg-gray-800'>
			<audio ref={audioRef} src={src} preload='metadata' />

			<button
				type='button'
				onClick={togglePlay}
				className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-600 text-white transition hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-400'
				aria-label={isPlaying ? "Pause audio" : "Play audio"}>
				{isPlaying ? <Pause className='h-5 w-5 fill-current' /> : <Play className='ml-0.5 h-5 w-5 fill-current' />}
			</button>

			<div className='min-w-0 flex-1'>
				<div onClick={handleProgressClick} className='flex h-8 cursor-pointer items-center gap-[2px]'>
					{waveform.map((height, index) => {
						const percentage = ((index + 1) / waveform.length) * 100

						const active = percentage <= progress

						return (
							<span
								key={index}
								className={`w-[2px] shrink-0 rounded-full transition-colors ${
									active ? "bg-gray-700 dark:bg-gray-200" : "bg-gray-300 dark:bg-gray-600"
								}`}
								style={{
									height: `${height}px`
								}}
							/>
						)
					})}
				</div>

				<div className='mt-0.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400'>
					<span>{formatTime(currentTime)}</span>

					<span>{formatTime(duration)}</span>
				</div>
			</div>
		</div>
	)
}
