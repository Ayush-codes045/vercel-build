import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import LogoutButton from "../components/LogoutButton";
import Navigation from "../components/Navigation";

// Load both fonts
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code" });

export const metadata = {
  title: "Vercel Clone",
  description: "A Vercel-like deployment platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${firaCode.variable}`}>
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  );
}
