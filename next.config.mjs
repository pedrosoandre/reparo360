/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    // GLB/HDRI de carros e cenários: 1 h sem revalidar, depois um 304 barato
    // pelo ETag. Não usar `immutable`/1 ano: a Vercel aplica este header também
    // ao 404, e em 15/10/2026 um deploy sem os .glb deixou o 404 preso no
    // Chrome de quem abriu o site naquela janela.
    return [
      {
        source: "/:folder(cars|scenery|hdri)/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
