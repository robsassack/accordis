import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

const themeScript = `
(() => {
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
