"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ProjectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;
  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Access control: redirect if not authenticated
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    const fetchProject = async () => {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setDeployments(data.deployments || []);
      } else {
        setError("Failed to fetch project details");
      }
      setLoading(false);
    };
    if (projectId) fetchProject();
  }, [projectId, router]);

  const handleDeploy = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId }),
    });
    if (res.ok) {
      const data = await res.json();
      setDeployments((prev) => [...prev, { id: data.data.deploymentId, status: "QUEUED" }]);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to trigger deployment");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-blue-200 p-8">
      <div className="max-w-3xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <span className="loading loading-spinner loading-lg text-indigo-600"></span>
          </div>
        ) : error ? (
          <div className="text-red-500 mb-4 text-lg font-medium">{error}</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-indigo-100">
              <h1 className="text-3xl font-extrabold mb-2 text-indigo-900 tracking-tight">{project?.name}</h1>
              <div className="mb-2 text-gray-600 text-lg">Git URL: <span className="font-mono">{project?.gitURL}</span></div>
              <div className="mb-2 text-indigo-500 text-base">Subdomain: <span className="font-mono">{project?.subDomain}</span></div>
              <button className="btn bg-indigo-600 text-white mt-4 px-6 py-3 rounded-lg hover:bg-indigo-700 text-lg font-semibold shadow-md transition-all" onClick={handleDeploy}>Trigger Deployment</button>
            </div>
            <h2 className="text-2xl font-bold mb-4 text-indigo-900">Deployments</h2>
            {deployments.length === 0 ? (
              <div className="text-gray-700 text-lg">No deployments yet.</div>
            ) : (
              deployments.map((dep) => (
                <div key={dep.id} className="bg-white rounded-2xl shadow-lg p-6 flex flex-col md:flex-row md:items-center justify-between border border-indigo-100 mb-4 hover:shadow-2xl transition-shadow">
                  <div>
                    <div className="font-semibold text-lg text-indigo-900">Deployment ID: <span className="font-mono">{dep.id}</span></div>
                    <div className={`text-sm font-semibold mt-1 ${dep.status === "READY" ? "text-green-600" : dep.status === "FAILED" ? "text-red-600" : dep.status === "BUILDING" ? "text-yellow-600" : "text-blue-600"}`}>Status: {dep.status}</div>
                    {dep.status === "READY" && (
                      <a
                        href={`http://${dep.subDomain || project.subDomain}.localhost:8000`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 underline text-base font-semibold mt-2 inline-block hover:text-indigo-800"
                      >
                        Open Deployed Site
                      </a>
                    )}
                  </div>
                  <button className="btn bg-indigo-500 text-white mt-4 md:mt-0 px-5 py-2 rounded-lg hover:bg-indigo-700 text-base font-semibold shadow-md transition-all" onClick={() => router.push(`/deployments/${dep.id}`)}>
                    View Logs
                  </button>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
} 