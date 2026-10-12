"use client";

import { useState, useRef, useEffect } from "react";
import { Lock, UserPlus, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, [tab]);

  // Handle strictly numeric input for PIN
  const handlePinChange = (val: string, setter: (v: string) => void) => {
    // Keep only numbers and max 10 digits
    const numeric = val.replace(/\D/g, "").slice(0, 10);
    setter(numeric);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!cleanUsername || !cleanPin || isLoading) return;

    if (!/^[0-9]{6,10}$/.test(cleanPin)) {
      setError("PIN must be strictly 6 to 10 numeric digits.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername, pin: cleanPin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Incorrect username or PIN.");
      }

      // Success: redirect to dashboard
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setPin("");
      pinRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPin = pin.trim();
    const cleanConfirmPin = confirmPin.trim();

    if (!cleanUsername || !cleanPin || isLoading) return;

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      setError("Username must be 3-30 characters (letters, numbers, underscores).");
      return;
    }

    if (!/^[0-9]{6,10}$/.test(cleanPin)) {
      setError("PIN must be strictly 6 to 10 numeric digits.");
      return;
    }

    if (cleanPin !== cleanConfirmPin) {
      setError("PIN confirmation does not match.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername, pin: cleanPin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account.");
      }

      // Success: automatically logged in and redirect to dashboard
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center bg-zinc-950 text-zinc-100 p-4 select-none">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 mb-3 shadow-sm">
            <Lock className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Norma</h1>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            Minimalist Daily Capture & Morning Briefing
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition touch-manipulation cursor-pointer ${
              tab === "login"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition touch-manipulation cursor-pointer ${
              tab === "register"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form container */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
          <form onSubmit={tab === "login" ? handleLogin : handleRegister} className="space-y-3.5">
            {/* Username */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Username
              </label>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="your_username"
                disabled={isLoading}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition tracking-wide disabled:opacity-50"
              />
            </div>

            {/* PIN (Strictly 6-10 digits) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-400">
                  PIN Code
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {pin.length}/10 digits
                </span>
              </div>
              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value, setPin)}
                placeholder="6 to 10 digits (numbers only)"
                disabled={isLoading}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition tracking-widest font-mono disabled:opacity-50"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Numbers only (strictly 6 to 10 digits).
              </p>
            </div>

            {/* Confirm PIN (Register only) */}
            {tab === "register" && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={confirmPin}
                  onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
                  placeholder="Repeat your numeric PIN"
                  disabled={isLoading}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition tracking-widest font-mono disabled:opacity-50"
                />
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={
                isLoading ||
                !username.trim() ||
                pin.length < 6 ||
                (tab === "register" && pin !== confirmPin)
              }
              className="w-full mt-2 h-10 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-98 disabled:opacity-40 disabled:active:scale-100 transition shadow-sm touch-manipulation cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span>{tab === "login" ? "Verifying..." : "Creating account..."}</span>
              ) : tab === "login" ? (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Feature note */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
            <span>End-to-end multi-tenant isolation</span>
          </p>
          <p className="text-[11px] text-zinc-600">
            Log in with your chosen username and 6–10 digit PIN.
          </p>
        </div>
      </div>
    </main>
  );
}
