"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", gitURL: "" });
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Access control: redirect if not authenticated
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    const fetchProjects = async () => {
      setLoading(true);
      setError("");
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      } else {
        setError("Failed to fetch projects");
      }
      setLoading(false);
    };
    fetchProjects();
  }, [router]);

  const handleChange = (e:any) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleCreate = async (e:any) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    const token = localStorage.getItem("token");
    const res = await fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      setProjects((prev) => [...prev, data.data.project]);
      setForm({ name: "", gitURL: "" });
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create project");
    }
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-blue-200 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 text-indigo-900 tracking-tight">Your Projects</h1>
        <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-4 mb-10 bg-white p-6 rounded-2xl shadow-lg border border-indigo-100">
          <input name="name" placeholder="Project Name" className="input input-bordered flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-lg" value={form.name} onChange={handleChange} required />
          <input name="gitURL" placeholder="Git Repository URL" className="input input-bordered flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-lg" value={form.gitURL} onChange={handleChange} required />
          <button type="submit" className="btn bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 text-lg font-semibold shadow-md disabled:opacity-50 transition-all" disabled={creating}>{creating ? "Creating..." : "Create Project"}</button>
        </form>
        {error && <div className="text-red-500 mb-4 text-lg font-medium">{error}</div>}
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <span className="loading loading-spinner loading-lg text-indigo-600"></span>
          </div>
        ) : (
          <div className="grid gap-6">
            {projects.length === 0 ? (
              <div className="text-gray-700 text-lg">No projects found. Create your first project!</div>
            ) : (
              projects.map((project: any) => (
                <div key={project.id} className="bg-white rounded-2xl shadow-lg p-6 flex flex-col md:flex-row md:items-center justify-between border border-indigo-100 hover:shadow-2xl transition-shadow">
                  <div>
                    <div className="font-bold text-xl text-indigo-900 mb-1">{project.name}</div>
                    <div className="text-base text-gray-600 mb-1">{project.gitURL}</div>
                    <div className="text-xs text-indigo-500">Subdomain: {project.subDomain}</div>
                  </div>
                  <button className="btn bg-indigo-500 text-white mt-4 md:mt-0 px-5 py-2 rounded-lg hover:bg-indigo-700 text-base font-semibold shadow-md transition-all" onClick={() => router.push(`/projects/${project.id}`)}>View Details</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
} 