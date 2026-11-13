import type { Metadata } from "next";
import { Montserrat, Russo_One } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const russoOne = Russo_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-russo",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Caisse | Trott Pulsion",
    template: "%s | Caisse Trott Pulsion",
  },
  description: "Caisse de la boutique Trott Pulsion.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={cn("font-sans", montserrat.variable, russoOne.variable)}>
      <body>{children}</body>
    </html>
  );
}
