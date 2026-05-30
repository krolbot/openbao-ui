import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { themeInitScript } from "@/components/theme";

export const metadata: Metadata = {
  title: "OpenBao UI",
  description: "A modern, simple UI for OpenBao",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
