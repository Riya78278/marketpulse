import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MarketPulse — Change Intelligence Platform",
  description:
    "Track what changed in the market since you last checked. Not just prices — meaningful changes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} bg-zinc-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
