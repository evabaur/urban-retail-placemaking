import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Urban Retail Placemaking",
  description: "Your course workspace. Reviews, teams and participation.",
  icons: {
    icon: "/trek/logo.png",
    shortcut: "/trek/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
