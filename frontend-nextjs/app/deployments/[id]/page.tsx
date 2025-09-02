"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function DeploymentDetailsPage() {
  const params = useParams();
  const deploymentId = params?.id as string;
  const [status, setStatus] = useState<string>("");
  const [logs, setLogs] = useState<any[]>([]);
  const [subDomain, setSubDomain] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Access control: redirect if not authenticated
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    let interval: NodeJS.Timeout;
    let statusInterval: NodeJS.Timeout;

    const fetchDeploymentStatus = async () => {
      try {
        const res = await fetch(`/api/deployments/${deploymentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          setSubDomain(data.subDomain);
        } else {
          setError("Failed to fetch deployment details");
        }
      } catch (err) {
        setError("Network error");
      }
    };

    const pollLogs = async () => {
      try {
        console.log('Frontend: Polling logs for deployment:', deploymentId);
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/logs/${deploymentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log('Frontend: Received logs data:', data);
          console.log('Frontend: Logs count:', data.logs?.length || 0);
          setLogs(data.logs || []);
        } else {
          console.error('Frontend: Logs API error:', res.status, res.statusText);
          const errorData = await res.json().catch(() => ({}));
          console.error('Frontend: Logs API error details:', errorData);
          setError(`Failed to fetch logs: ${res.status} ${res.statusText}`);
        }
      } catch (err: any) {
        console.error("Error fetching logs:", err);
        setError(`Network error fetching logs: ${err.message}`);
      }
    };

    // Initial fetch
    fetchDeploymentStatus();
    pollLogs();
    setLoading(false);

    // Poll for status updates every 3 seconds
    statusInterval = setInterval(() => {
      fetchDeploymentStatus();
    }, 3000);

    // Poll for logs every 2 seconds
    interval = setInterval(() => {
      pollLogs();
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(statusInterval);
    };
  }, [deploymentId]);

  // Get status color based on deployment status
  const getStatusColor = (status: string) => {
    switch (status) {
      case "READY":
        return "text-green-600";
      case "BUILDING":
        return "text-yellow-600";
      case "FAILED":
        return "text-red-600";
      case "QUEUED":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-blue-200 p-8">
      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="text-center">
              <div className="loading loading-spinner loading-lg text-indigo-600 mb-4"></div>
              <p className="text-gray-600 text-lg">Loading deployment details...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800 text-lg font-medium">{error}</div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-indigo-100">
              <h1 className="text-3xl font-extrabold mb-6 text-indigo-900">Deployment Details</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Deployment ID</label>
                  <div className="text-indigo-900 font-mono text-lg">{deploymentId}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className={`font-semibold text-lg ${getStatusColor(status)}`}>{status || "Unknown"}</div>
                </div>
              </div>
              {status === "READY" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-green-800 font-medium text-lg">Deployment Successful!</h3>
                    <p className="text-green-700 text-base mt-1">Your site is now live</p>
                  </div>
                  <a
                    href={`http://${subDomain}.localhost:8000`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 text-lg font-semibold shadow-md transition-all"
                  >
                    Open Site
                  </a>
                </div>
              )}
              {status === "FAILED" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="text-red-800 font-medium text-lg">Deployment Failed</h3>
                  <p className="text-red-700 text-base mt-1">Check the logs below for more details</p>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-indigo-900">Build Logs</h2>
            </div>
            <div className="bg-gray-900 text-green-400 rounded-2xl p-6 h-96 overflow-y-auto text-lg font-mono shadow-lg border border-gray-800">
              {logs.length === 0 ? (
                <div className="text-gray-400 text-base">
                  No logs available yet... 
                  <br />
                  <span className="text-xs">Deployment ID: {deploymentId}</span>
                  <br />
                  <span className="text-xs">Status: {status}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, idx) => (
                    <div key={idx} className="whitespace-pre-wrap">
                      {log.log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 