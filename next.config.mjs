/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	eslint: { ignoreDuringBuilds: true },
	env: {
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://84.247.174.83:4000"
	}
}

export default nextConfig
