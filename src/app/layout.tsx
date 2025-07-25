import type { Metadata } from "next"
import { Inter, Manrope } from "next/font/google"
import "@/styles/globals.css"
import { Toaster } from "@/components/ui/toaster"
import AppShell from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" })

export const metadata: Metadata = {
  title: "Orvia Scheduler",
  description: "Web based shift scheduling application",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full bg-white">
      <head />
      <body className={`${inter.variable} ${manrope.variable} font-sans h-full`}>
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  )
} 