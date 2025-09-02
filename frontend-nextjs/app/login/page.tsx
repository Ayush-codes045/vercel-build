"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem("token", data.token);
        router.push("/projects");
        router.refresh();
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-blue-200">
      <form onSubmit={handleSubmit} className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md space-y-6 border border-indigo-100">
        <h2 className="text-3xl font-extrabold mb-6 text-center text-indigo-900 tracking-tight">Login</h2>
        <div>
          <input 
            name="email" 
            type="email" 
            placeholder="Email" 
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-lg" 
            value={form.email} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div>
          <input 
            name="password" 
            type="password" 
            placeholder="Password" 
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-lg" 
            value={form.password} 
            onChange={handleChange} 
            required 
          />
        </div>
        {error && <div className="text-red-500 text-base text-center font-medium">{error}</div>}
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-lg font-semibold shadow-md disabled:opacity-50 transition-all"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        <div className="text-center text-base mt-4 text-gray-700">
          Don't have an account?{" "}
          <a href="/register" className="text-indigo-600 hover:text-indigo-800 underline font-semibold">
            Register
          </a>
        </div>
      </form>
    </div>
  );
} 