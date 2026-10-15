/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    // GLB/HDRI de carros e cenários são content-addressed pelo nome do arquivo
    // (nunca sobrescrevemos um `.glb` existente). Servir com `immutable` faz o
    // browser pular revalidação (evita o round-trip de 304 a cada navegação
    // pra reparo360.vercel.app).
    return [
      {
        source: "/:folder(cars|scenery|hdri)/:file*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
