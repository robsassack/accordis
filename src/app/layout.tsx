import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { withBasePath } from "@/lib/base-path";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Accordis",
  description: "A chord builder and visualizer for musicians.",
};

const LIGHT_FAVICON_URL = withBasePath("/logo_light.png?v=light-only");

const themeScript = `
(() => {
  const faviconHref = "${LIGHT_FAVICON_URL}";
  const iconLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="alternate icon"]');

  if (iconLinks.length === 0) {
    const iconLink = document.createElement("link");
    iconLink.rel = "icon";
    iconLink.type = "image/png";
    iconLink.href = faviconHref;
    document.head.appendChild(iconLink);
  } else {
    iconLinks.forEach((link) => {
      link.href = faviconHref;
      link.media = "";
    });
  }

  const storageKey = "accordis-theme-preference";
  const stored = window.localStorage.getItem(storageKey);
  const supportsMatchMedia = typeof window.matchMedia === "function";
  const systemPrefersDark = supportsMatchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = stored === "dark" || (stored !== "light" && systemPrefersDark);

  if (isDark) {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  } else {
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={LIGHT_FAVICON_URL} type="image/png" />
        <link rel="shortcut icon" href={LIGHT_FAVICON_URL} type="image/png" />
        <link rel="apple-touch-icon" href={LIGHT_FAVICON_URL} />
        <script id="accordis-theme-init" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
