import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible Next for every UI word (distinct l/I/1 and O/0 in a chart full of doses),
// Bricolage Grotesque for the few display moments, Geist Mono for turn stamps, timers and ids.
const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin"], display: "swap" });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], display: "swap", axes: ["opsz"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Rounds — virtual patient telehealth simulation",
  description: "Telehealth simulations with virtual patients for every health profession.",
};

export const viewport: Viewport = {
  themeColor: "#f6fafa",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${atkinson.variable} ${bricolage.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
