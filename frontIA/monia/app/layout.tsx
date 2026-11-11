import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fabio IA | Assistant intelligent",
  description: "Votre assistant conversationnel intelligent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}