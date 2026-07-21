import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "E-commerce Lakehouse | Data Engineering Portfolio",
    description:
      "Explore an interactive recruiter demo of a real-time Kafka, Databricks, Delta Lake, Airflow, dbt, PostgreSQL, and Metabase analytics platform.",
    openGraph: {
      title: "E-commerce Lakehouse",
      description: "From clickstream to decision, in seconds.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1740, height: 908, alt: "E-commerce Lakehouse data engineering portfolio" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "E-commerce Lakehouse",
      description: "A production-shaped streaming analytics portfolio project.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
