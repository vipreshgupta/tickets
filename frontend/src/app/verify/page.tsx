"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { TicketVerification } from "@/types";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const sig = searchParams.get("sig");

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<TicketVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !sig) {
      setLoading(false);
      return;
    }

    api.verifyTicket(id, sig)
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id, sig]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-4xl mb-4 hover:scale-110 transition-transform">🎰</Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ticket Verification</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400 font-medium">Verifying cryptographic signature...</p>
            </div>
          )}

          {!loading && (!id || !sig) && (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Scan a Ticket</h2>
              <p className="text-gray-400 text-sm">
                Please scan the QR code on a Tambola ticket to verify its authenticity.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/20 mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h2 className="text-xl font-semibold text-red-400 mb-2">System Error</h2>
              <p className="text-gray-400 text-sm bg-gray-950 p-3 rounded-lg border border-gray-800">
                {error}
              </p>
            </div>
          )}

          {!loading && result && (
            <div className="text-center">
              {result.verified ? (
                <>
                  {/* Decorative background glow for success */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none"></div>
                  
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border-4 border-emerald-500 mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  
                  <h2 className="text-2xl font-bold text-emerald-400 mb-2 tracking-tight">Authentic Ticket</h2>
                  <p className="text-gray-300 text-sm font-medium mb-6">{result.message}</p>
                  
                  {result.ticket && (
                    <div className="bg-gray-950 rounded-xl border border-gray-800 p-5 text-left space-y-3 shadow-inner">
                      <div className="flex justify-between items-center pb-3 border-b border-gray-800/60">
                        <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Ticket ID</span>
                        <span className="text-gray-200 font-mono text-sm">{result.ticket.id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-gray-800/60">
                        <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Batch No.</span>
                        <span className="text-gray-200 font-mono text-sm">{result.ticket.batch_id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-gray-800/60">
                        <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Sequence</span>
                        <span className="text-gray-200 font-mono text-sm font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                          #{result.ticket.ticket_index} of {result.ticket.batch_size}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Generated</span>
                        <span className="text-gray-200 text-sm">
                          {new Date(result.ticket.batch_created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Decorative background glow for failure */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-500/20 blur-3xl rounded-full pointer-events-none"></div>
                  
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border-4 border-red-500 mb-6 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                    <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  
                  <h2 className="text-2xl font-bold text-red-400 mb-2 tracking-tight">Counterfeit Alert</h2>
                  <p className="text-gray-300 text-sm font-medium mb-6">{result.message}</p>
                  
                  <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-5 text-sm text-red-400/80 text-left">
                    This ticket failed cryptographic verification or does not exist in our database. Do not accept it as valid for gameplay.
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
