"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  db: string;
  redis: string;
  version: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Auth modal
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    setIsLoggedIn(api.isLoggedIn());

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${API_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => { setHealth(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "register") {
        await api.register(email, password, name);
      } else {
        await api.login(email, password);
      }
      setIsLoggedIn(true);
      setShowAuth(false);
      setEmail(""); setPassword(""); setName("");
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setIsLoggedIn(false);
  };

  return (
    <>
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎰</span>
            <span className="font-bold text-sm tracking-wide">TAMBOLA GENERATOR</span>
          </div>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <Link href="/design" className="px-4 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">
                  Design Studio
                </Link>
                <button onClick={handleLogout} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/design" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                  Try as Guest
                </Link>
                <button onClick={() => { setShowAuth(true); setAuthMode("login"); }} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Production Ready
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent mb-4">
            Tambola Ticket<br />Generator
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-8">
            Design custom Housie / 90-ball Bingo tickets, generate thousands of
            mathematically valid unique tickets, and download as PDF or PNG.
          </p>
          <Link
            href="/design"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-105"
          >
            🎨 Open Design Studio
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full mb-12">
          <FeatureCard icon="🎨" title="Design Studio" description="Upload backgrounds & place 15 number zones with grid-lock or free placement" />
          <FeatureCard icon="🔢" title="Book-of-6 Engine" description="Mathematically correct generation using all 90 numbers per book" />
          <FeatureCard icon="📄" title="PDF + ZIP Export" description="Print-quality 300 DPI output, 4 tickets per A4 page" />
          <FeatureCard icon="⚡" title="Real-time Progress" description="Live SSE updates as your batch generates in the background" />
          <FeatureCard icon="🔐" title="QR Verification" description="HMAC-signed QR codes on every ticket for authenticity" />
          <FeatureCard icon="💾" title="Saved Templates" description="Reuse your designs across multiple batch generations" />
        </div>

        {/* Health */}
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-gray-900/80 border border-gray-800 shadow-2xl shadow-indigo-500/5 backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">System Status</h2>
              {health && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${health.status === "ok" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${health.status === "ok" ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                  {health.status === "ok" ? "All Systems Go" : "Degraded"}
                </span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {loading && <div className="flex items-center justify-center py-6"><div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}
              {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3"><p className="text-red-400 text-sm">Backend not reachable</p></div>}
              {health && (
                <>
                  <StatusRow label="API" value={`v${health.version}`} ok={true} />
                  <StatusRow label="PostgreSQL" value={health.db} ok={health.db === "connected"} />
                  <StatusRow label="Redis" value={health.redis} ok={health.redis === "connected"} />
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAuth(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{authMode === "login" ? "Sign In" : "Create Account"}</h2>
            <form onSubmit={handleAuth} className="space-y-3">
              {authMode === "register" && (
                <input type="text" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:border-indigo-500" />
              )}
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:border-indigo-500" />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:border-indigo-500" />
              {authError && <p className="text-red-400 text-xs">{authError}</p>}
              <button type="submit" disabled={authLoading} className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium disabled:opacity-50">
                {authLoading ? "..." : authMode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>
            <p className="text-center text-xs text-gray-500 mt-3">
              {authMode === "login" ? "No account? " : "Already have one? "}
              <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }} className="text-indigo-400 hover:text-indigo-300">
                {authMode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400 shadow shadow-emerald-400/30" : "bg-red-400 shadow shadow-red-400/30"}`}></div>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <span className={`text-xs font-mono ${ok ? "text-emerald-400" : "text-red-400"}`}>{value}</span>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="group rounded-xl bg-gray-900/50 border border-gray-800 p-5 hover:border-indigo-500/30 hover:bg-gray-900/80 cursor-default transition-all">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-200 mb-1">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
