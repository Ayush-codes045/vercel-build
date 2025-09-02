"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";

export default function Navigation() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, [pathname]);

  // Don't show navigation on login/register pages
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <nav className="bg-white shadow flex items-center justify-between px-8 py-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-xl font-bold text-blue-700">Vercel Clone</Link>
      </div>
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <Link href="/projects" className="text-gray-700 hover:text-blue-700">Projects</Link>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="text-gray-700 hover:text-blue-700">Login</Link>
            <Link href="/register" className="text-gray-700 hover:text-blue-700">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
} 