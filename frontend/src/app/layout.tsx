import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tambola Ticket Generator — Design & Generate Custom Housie Tickets",
  description:
    "Create custom Tambola (Housie / 90-ball Bingo) ticket designs, generate thousands of mathematically valid unique tickets, and download as PDF or PNG.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-gray-950 text-gray-100 font-sans">
        {children}
      </body>
    </html>
  );
}
