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
  icons: {
    icon: [
      { url: withBasePath("/logo_light.png"), media: "(prefers-color-scheme: light)", type: "image/png" },
      { url: withBasePath("/logo_dark.png"), media: "(prefers-color-scheme: dark)", type: "image/png" },
    ],
    shortcut: [
      { url: withBasePath("/logo_light.png"), media: "(prefers-color-scheme: light)", type: "image/png" },
      { url: withBasePath("/logo_dark.png"), media: "(prefers-color-scheme: dark)", type: "image/png" },
    ],
    apple: withBasePath("/logo_light.png"),
  },
};

const LIGHT_FAVICON_URL = withBasePath("/logo_light.png");
const DARK_FAVICON_URL = withBasePath("/logo_dark.png");

const themeScript = `
(() => {
  const storageKey = "accordis-theme-preference";
  const stored = window.localStorage.getItem(storageKey);
  const supportsMatchMedia = typeof window.matchMedia === "function";
  const systemPrefersDark = supportsMatchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = stored === "dark" || (stored !== "light" && systemPrefersDark);
  const faviconHref = isDark ? "${DARK_FAVICON_URL}" : "${LIGHT_FAVICON_URL}";

  const iconLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="alternate icon"]');
  iconLinks.forEach((link) => {
    link.href = faviconHref;
    link.media = "";
  });

  let runtimeIconLink = document.querySelector('link[data-accordis-theme-favicon="true"]');
  if (!runtimeIconLink) {
    runtimeIconLink = document.createElement("link");
    runtimeIconLink.rel = "icon";
    runtimeIconLink.type = "image/png";
    runtimeIconLink.setAttribute("data-accordis-theme-favicon", "true");
    document.head.appendChild(runtimeIconLink);
  }

  runtimeIconLink.href = faviconHref;

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
