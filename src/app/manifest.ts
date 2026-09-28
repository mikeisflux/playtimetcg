import type { MetadataRoute } from "next";

/* Web app manifest: dark ground, icons generated from the wordmark
   (public/icon-*.png). Static, so it never touches the database. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Play Time — The Card Game for Couples",
    short_name: "Play Time",
    description: "72 cards, one 12-sided die. An adult card game for couples, written by a practicing sex therapist.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0b10",
    theme_color: "#0d0b10",
    lang: "en",
    categories: ["games", "lifestyle", "shopping"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
