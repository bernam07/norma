"use client";

import { useState, useRef, useEffect } from "react";
import { Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passcode.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Access denied");
      }

      // Success: redirect to main page
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect passcode");
      setPasscode("");
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center bg-zinc-950 text-zinc-100 p-4 select-none">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 mb-4 shadow-sm">
            <Lock className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Norma</h1>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs text-zinc-500 mt-1 font-medium">Daily Capture & Digest</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm"
        >
          <label className="block text-xs font-medium text-zinc-400 mb-2">
            Passcode
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode or secret..."
              disabled={isLoading}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition tracking-wide disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 mt-2.5 font-medium flex items-center gap-1.5 animate-fadeIn">
              <span className="w-1 h-1 rounded-full bg-rose-500" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !passcode.trim()}
            className="w-full mt-4 h-10 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-98 disabled:opacity-40 disabled:active:scale-100 transition shadow-sm touch-manipulation cursor-pointer disabled:cursor-not-allowed"
          >
            <span>{isLoading ? "Verifying..." : "Unlock"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <p className="text-center text-[11px] text-zinc-600 mt-6">
          Restricted access to the application owner
        </p>
      </div>
    </main>
  );
}
