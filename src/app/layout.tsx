import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
	title: "EMA Portal",
	description: "Agent console for the EMA WhatsApp support API"
}

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: "#1f63eb"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en' dir='ltr' suppressHydrationWarning>
			<head>
				<link rel='preconnect' href='https://fonts.googleapis.com' />
				<link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='anonymous' />
				<link
					rel='stylesheet'
					href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap'
				/>
			</head>
			<body suppressHydrationWarning>
				<Providers>{children}</Providers>
			</body>
		</html>
	)
}
