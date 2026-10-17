import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Header } from "@/components/header";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Velio",
  description: "Group bookings with live availability and invites",
};

export const viewport: Viewport = { themeColor: "#fbf8f4" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
