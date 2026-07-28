import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "E-commerce Lakehouse | Data Engineering Portfolio",
    description:
      "Follow one verified order through Kafka, Spark, Delta Lake, dbt, Airflow, PostgreSQL, and Metabase implementation evidence.",
    openGraph: {
      title: "E-commerce Lakehouse | Follow One Order",
      description: "From event to decision—with inspectable data engineering evidence.",
      type: "website",
      images: [{ url: `${origin}/og-v2.png`, width: 1693, height: 929, alt: "Follow one order from event to decision through the E-commerce Lakehouse" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "E-commerce Lakehouse | Follow One Order",
      description: "From event to decision—with inspectable data engineering evidence.",
      images: [`${origin}/og-v2.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
