import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "一向聴 基礎講義フラッシュカード";
const description =
  "麻雀の基礎講義を、4択30問の基本序列クイズと3授業・全130問のフラッシュカードで復習できる無料ドリル。";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? "https://ensuku-basic-flashcards.kobotenmitsu.chatgpt.site/";
const siteOrigin = new URL(siteUrl).origin;

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title,
  description,
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: `${basePath}/icons/ensuku-192.png`,
    shortcut: `${basePath}/icons/ensuku-192.png`,
    apple: `${basePath}/icons/ensuku-180.png`,
  },
  openGraph: {
    title,
    description,
    type: "website",
    locale: "ja_JP",
    images: [
      {
        url: `${basePath}/og-card.png`,
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${basePath}/og-card.png`],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#48d6b0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
