"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  
  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
    router.refresh(); // Force refresh to update navigation
  };

  return (
    <button 
      onClick={handleLogout} 
      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
    >
      Logout
    </button>
  );
} 