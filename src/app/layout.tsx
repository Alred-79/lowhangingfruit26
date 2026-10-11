import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Gabarito, Geist_Mono } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible Next for every UI word (distinct l/I/1 and O/0 in a chart full of doses),
// Gabarito (heavy, geometric, game-title energy) for display type and hero numbers,
// Geist Mono for HUD counters, turn stamps, timers and ids.
const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin"], display: "swap" });
const gabarito = Gabarito({ variable: "--font-gabarito", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Poscere — virtual patient telehealth simulation",
  description: "Telehealth simulations with virtual patients for every health profession.",
};

export const viewport: Viewport = {
  themeColor: "#f3f4fd",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${atkinson.variable} ${gabarito.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
