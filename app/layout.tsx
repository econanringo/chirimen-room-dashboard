import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";

import { cn } from "@/lib/utils";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "部屋ダッシュボード",
  description: "CHIRIMEN SHT30 と FNK0066 センサーの部屋環境ダッシュボード",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={cn("h-full antialiased font-sans", outfit.variable, geistMono.variable)}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
