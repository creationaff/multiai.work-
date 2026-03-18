import type { Metadata, Viewport } from "next";
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

const siteUrl = "https://multiai.work";
const title = "Compare AI Models Side by Side | ChatGPT, Claude, Gemini & Grok | MultiAI";
const description =
  "Compare ChatGPT, Claude, Gemini, and Grok side by side in one AI workspace. Test prompts across brands, compare answers instantly, generate images, upload files, and start free.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "MultiAI",
  title: {
    default: title,
    template: "%s | MultiAI",
  },
  description,
  keywords: [
    "ChatGPT",
    "Grok",
    "Claude",
    "Gemini",
    "compare ChatGPT Claude Gemini Grok",
    "AI comparison",
    "multi AI chat",
    "AI workbench",
    "side by side AI",
    "GPT vs Claude",
    "compare AI models",
    "AI model comparison tool",
    "compare LLMs",
    "multi model chat",
    "AI prompt comparison",
    "AI chat tool",
    "multiai",
  ],
  authors: [{ name: "MultiAI", url: siteUrl }],
  creator: "MultiAI",
  publisher: "MultiAI",
  category: "Technology",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "MultiAI",
    locale: "en_US",
    title,
    description,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "MultiAI — Chat with ChatGPT, Grok, Claude and Gemini side by side",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@multiai",
    title,
    description: "Compare ChatGPT, Claude, Gemini, and Grok side by side in one AI workspace.",
    images: [{ url: "/og-image.jpg", alt: "MultiAI split-screen AI workbench" }],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  other: {
    "theme-color": "#09090b",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MultiAI",
    url: siteUrl,
    description,
    inLanguage: "en-US",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MultiAI",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description,
    image: `${siteUrl}/og-image.jpg`,
    screenshot: `${siteUrl}/og-image.jpg`,
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
        description: "60 free AI credits per day on fast models",
      },
      {
        "@type": "Offer",
        name: "Starter",
        price: "5",
        priceCurrency: "USD",
        description: "500 AI credits per month",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "30",
        priceCurrency: "USD",
        description: "5,000 AI credits per month",
      },
      {
        "@type": "Offer",
        name: "Unlimited",
        price: "100",
        priceCurrency: "USD",
        description: "50,000 AI credits per month",
      },
    ],
    featureList: [
      "Compare ChatGPT, Claude, Gemini, and Grok side by side",
      "Broadcast the same prompt to all AI models",
      "Resizable four-panel AI workspace",
      "Image generation",
      "File and image uploads",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is MultiAI?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "MultiAI is a web app that lets you compare ChatGPT, Claude, Gemini, and Grok side by side in one workspace.",
        },
      },
      {
        "@type": "Question",
        name: "How does MultiAI compare AI models?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can send the same prompt to multiple AI brands at once, compare their answers in parallel, and resize the four-panel layout to focus on the responses you care about most.",
        },
      },
      {
        "@type": "Question",
        name: "Can I use MultiAI for free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. MultiAI includes a free tier with daily AI credits on fast low-cost models, and paid plans unlock stronger models and higher usage limits.",
        },
      },
    ],
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
