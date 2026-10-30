import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NUMORA",
  description: "NUMORA - Numbering, Simplified",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
