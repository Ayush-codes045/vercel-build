"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = () => {
      const token = localStorage.getItem("token");
      if (token) {
        router.push("/projects");
      } else {
        router.push("/login");
      }
      setIsLoading(false);
    };

    // Small delay to ensure proper initialization
    setTimeout(checkAuthAndRedirect, 100);
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}
