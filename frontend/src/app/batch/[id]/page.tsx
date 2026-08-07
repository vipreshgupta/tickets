"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { Batch } from "@/types";

export default function BatchProgress() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    // Initial fetch to check if it's already done or get quantity
    api.getBatch(batchId).then((res) => {
      setBatch(res.batch);
      if (res.batch.status !== "complete" && res.batch.status !== "failed" && res.batch.status !== "cancelled") {
        subscribe();
      }
    }).catch((err) => {
      setError(err.message);
    });

    let es: EventSource | null = null;

    function subscribe() {
      es = api.subscribeBatchProgress(
        batchId,
        (data) => {
          setBatch((prev) => prev ? {
            ...prev,
            status: data.status,
            progressPercent: data.progress,
            pdfUrl: data.pdf_url || prev.pdfUrl,
            zipUrl: data.zip_url || prev.zipUrl,
            errorReason: data.error || prev.errorReason,
          } : null);
          
          if (data.status === "complete" || data.status === "failed" || data.status === "cancelled") {
            es?.close();
          }
        },
        (err) => {
          console.error("SSE connection dropped, verifying final status...");
          es?.close();
          // The server closes the connection when done, which can trigger an onerror event.
          // Fetch one last time to ensure we get the final 'complete' status.
          api.getBatch(batchId).then((res) => {
            setBatch((prev) => prev ? {
              ...prev,
              status: res.batch.status,
              progressPercent: res.batch.progressPercent,
              pdfUrl: res.batch.pdfUrl || prev.pdfUrl,
              zipUrl: res.batch.zipUrl || prev.zipUrl,
              errorReason: res.batch.errorReason || prev.errorReason,
            } : null);
          }).catch(console.error);
        }
      );
    }

    return () => {
      if (es) es.close();
    };
  }, [batchId]);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this batch?")) return;
    setCancelling(true);
    try {
      await api.cancelBatch(batchId);
    } catch (err: any) {
      alert(err.message);
      setCancelling(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl max-w-md text-center">
          <span className="text-3xl block mb-2">⚠️</span>
          <h2 className="font-bold text-lg mb-1">Error Loading Batch</h2>
          <p className="text-sm">{error}</p>
          <button onClick={() => router.push("/design")} className="mt-4 text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded text-sm transition-colors">
            Back to Design Studio
          </button>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-400 animate-pulse">Loading batch data...</p>
      </div>
    );
  }

  const isDone = batch.status === "complete";
  const isFailed = batch.status === "failed";
  const isCancelled = batch.status === "cancelled";
  const isProcessing = !isDone && !isFailed && !isCancelled;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center p-4 md:p-12">
      <div className="w-full max-w-2xl">
        <Link href="/design" className="text-sm text-gray-500 hover:text-white transition-colors mb-6 inline-flex items-center gap-2">
          &larr; Back to Design Studio
        </Link>
        
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Batch Generation</h1>
              <p className="text-gray-400 text-sm">ID: <span className="font-mono">{batch.id}</span></p>
            </div>
            <div className="text-right">
              <span className="block text-3xl font-bold text-indigo-400">{batch.quantity}</span>
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Tickets</span>
            </div>
          </div>

          {/* Status Display */}
          <div className="mb-10 text-center">
            {isProcessing && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/10 border-2 border-indigo-500 mb-4 relative">
                  <span className="text-2xl font-bold text-indigo-400">{batch.progressPercent}%</span>
                  <svg className="absolute -inset-2 w-24 h-24 -rotate-90 animate-spin-slow">
                     <circle cx="48" cy="48" r="46" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="289" strokeDashoffset={289 - (289 * batch.progressPercent) / 100} className="text-indigo-500 transition-all duration-500 ease-out" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-200">Processing your batch...</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {batch.status === "queued" && "Waiting in queue..."}
                  {batch.status === "generating_numbers" && "Generating unique numbers..."}
                  {batch.status === "rendering_images" && "Rendering high-res ticket images..."}
                  {batch.status === "building_pdf" && "Assembling PDF for printing..."}
                  {batch.status === "building_zip" && "Compressing images into ZIP archive..."}
                </p>
              </>
            )}

            {isDone && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 mb-4">
                  <span className="text-4xl">🎉</span>
                </div>
                <h2 className="text-2xl font-bold text-emerald-400">Generation Complete!</h2>
                <p className="text-gray-400 mt-1">Your mathematically verified tickets are ready.</p>
              </>
            )}

            {(isFailed || isCancelled) && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500 mb-4">
                  <span className="text-4xl">❌</span>
                </div>
                <h2 className="text-xl font-bold text-red-400">{isCancelled ? "Cancelled" : "Generation Failed"}</h2>
                <p className="text-gray-400 mt-2 max-w-sm mx-auto p-3 bg-gray-950 rounded border border-red-500/20 text-sm break-words">
                  {batch.errorReason || "An unknown error occurred."}
                </p>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            {isProcessing && (
              <button 
                onClick={handleCancel} 
                disabled={cancelling}
                className="w-full py-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 font-medium transition-colors"
              >
                {cancelling ? "Cancelling..." : "Cancel Generation"}
              </button>
            )}
            
            {isDone && (
              <>
                <a 
                  href={api.getDownloadUrl(batch.id, "pdf")} 
                  download 
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-lg shadow-indigo-500/20"
                >
                  <span className="text-xl">📄</span> Download Print PDF
                </a>
                <a 
                  href={api.getDownloadUrl(batch.id, "zip")} 
                  download 
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold border border-gray-700 transition-colors"
                >
                  <span className="text-xl">📦</span> Download Images (ZIP)
                </a>
              </>
            )}

            {(isFailed || isCancelled) && (
              <button 
                onClick={() => router.push("/design")} 
                className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                Start New Batch
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
