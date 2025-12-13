/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "export",
    pageExtensions: ["ts", "tsx"],
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        unoptimized: true,
    },
};

export default nextConfig;
