import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NutriPilot",
    short_name: "NutriPilot",
    description: "Track your nutrition, hit your goals",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0f0e",
    theme_color: "#0e0f0e",
    categories: ["health", "fitness", "food"],
    // Long press the app icon for these.
    shortcuts: [
      { name: "Today", url: "/today", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96" }] },
      { name: "Scan a barcode", short_name: "Scan", url: "/scanner", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96" }] },
      { name: "Foods", url: "/foods", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96" }] },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
