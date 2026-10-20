import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/header";
import { Providers } from "./providers";
import "./globals.css";

const satoshi = localFont({ src: "./fonts/Satoshi-Variable.woff2", weight: "300 900", variable: "--font-satoshi" });
const nohemi = localFont({
  src: "./fonts/Nohemi-Medium.ttf",
  weight: "500",
  variable: "--font-nohemi",
  adjustFontFallback: false,
  fallback: ["Nohemi Fallback"],
});

export const metadata: Metadata = {
  title: "Velio",
  description: "Group bookings with live availability and invites",
};

export const viewport: Viewport = { themeColor: "#f5f3ec" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${satoshi.variable} ${nohemi.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `if (localStorage.getItem("velio.user")) document.documentElement.dataset.named = ""` }} />
      </head>
      <body className="min-h-full font-sans">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-3xl px-6 pb-16 pt-28 md:pt-32">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
