import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FamilyDisplay",
  description: "Family organization dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
