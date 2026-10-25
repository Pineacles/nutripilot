import type { Metadata, Viewport } from "next";
import { Geist_Mono, Host_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// One neo-grotesk for everything (docs/design-vision.md), served from the app itself.
const hostGrotesk = Host_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NutriPilot",
  description: "Agent-first nutrition and weight tracking",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "NutriPilot",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0f0e",
  width: "device-width",
  initialScale: 1,
  // Lets the bottom tab bar pad itself for the iPhone home indicator (env(safe-area-inset-bottom)).
  viewportFit: "cover",
  // The keyboard shrinks the page instead of covering it, so a sheet's bottom search bar and Log
  // button stay above it (Android Chrome; iOS ignores it and already scrolls the field into view).
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hostGrotesk.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
