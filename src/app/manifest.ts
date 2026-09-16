import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ninety",
    short_name: "ninety",
    description: "The full 90, all in one place: live scores, tables, fixtures and squads.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f0e",
    theme_color: "#0f0f0e",
    // A browser only offers to install when it finds a 192 and a 512; the
    // maskable one is what stops Android cropping the mark into a circle.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    orientation: "portrait",
    categories: ["sports", "news"],
    lang: "en",
  };
}
