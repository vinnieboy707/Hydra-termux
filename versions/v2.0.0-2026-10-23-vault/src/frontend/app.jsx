import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

function Dashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:9091/api/checkin");
      const data = await res.json();
      setStatus(data);
      setLoading(false);
    } catch (err) {
      console.error("Gateway offline:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerSweep = async () => {
    await fetch("http://localhost:9091/api/swarm/trigger", { method: "POST" });
    fetchStatus();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-emerald-400">CHRONOS OS // v10.0</h1>
          <p className="text-xs text-slate-400">Sovereign Arbitrage & Treasury Command Matrix</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-emerald-400">CLUSTER ONLINE</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <h3 className="text-xs text-slate-400 uppercase">System Uptime</h3>
          <p className="text-xl font-bold text-slate-100 mt-1">{status ? `${Math.round(status.uptime)}s` : "Loading..."}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <h3 className="text-xs text-slate-400 uppercase">Ledger Records</h3>
          <p className="text-xl font-bold text-emerald-400 mt-1">{status ? status.ledgerRecords : "0"}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <h3 className="text-xs text-slate-400 uppercase">Gateway Port</h3>
          <p className="text-xl font-bold text-cyan-400 mt-1">9091</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg space-y-4">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Manual Swarm Execution</h2>
        <button 
          onClick={triggerSweep}
          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded text-xs transition uppercase tracking-wider cursor-pointer"
        >
          Trigger Arbitrage Sweep
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-2">Supervisor Status Report</h2>
        <pre className="text-xs bg-slate-950 p-4 rounded text-emerald-300 overflow-x-auto border border-slate-900">
          {status ? JSON.stringify(status.supervisorReport, null, 2) : "Awaiting telemetry feed..."}
        </pre>
      </div>
    </div>
  );
}

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<Dashboard />);
