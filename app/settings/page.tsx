"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Key,
  Check,
  Copy,
  ExternalLink,
  Send,
  Shield,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface UserSettings {
  id: string;
  username: string;
  email: string | null;
  from_email: string | null;
  api_key: string;
  has_resend_configured: boolean;
  masked_resend_key: string | null;
  onboarding_completed: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [email, setEmail] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  // Feedback states
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Test email state
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Token copy state
  const [copiedToken, setCopiedToken] = useState(false);

  // PIN change states
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinStatus, setPinStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  // Show guide toggle
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      const s = data.settings as UserSettings;
      setSettings(s);
      setEmail(s.email || "");
      setFromEmail(s.from_email || "Norma Digest <onboarding@resend.dev>");
      if (!s.has_resend_configured) {
        setShowGuide(true);
      }
    } catch {
      setSaveStatus({
        type: "error",
        message: "Unable to load settings. Please refresh.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    setTestResult(null);
    setIsSaving(true);

    try {
      const payload: {
        email: string;
        from_email: string;
        resend_api_key?: string;
        onboarding_completed?: boolean;
      } = {
        email: email.trim(),
        from_email: fromEmail.trim(),
      };

      if (resendApiKey.trim()) {
        payload.resend_api_key = resendApiKey.trim();
        payload.onboarding_completed = true;
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      setSettings(data.settings);
      setResendApiKey("");
      setSaveStatus({
        type: "success",
        message: "Settings updated successfully!",
      });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      setSaveStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Error saving settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestResult(null);
    setIsTestingEmail(true);

    try {
      const res = await fetch("/api/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          resend_api_key: resendApiKey.trim() || undefined,
          from_email: fromEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send test email");

      setTestResult({
        type: "success",
        message: data.message || "Test email sent! Check your inbox.",
      });
    } catch (err) {
      setTestResult({
        type: "error",
        message: err instanceof Error ? err.message : "Test email failed",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleCopyApiKey = async () => {
    if (!settings?.api_key) return;
    try {
      await navigator.clipboard.writeText(settings.api_key);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinStatus(null);

    const cPin = currentPin.trim();
    const nPin = newPin.trim();
    const cNPin = confirmNewPin.trim();

    if (!/^[0-9]{6,10}$/.test(nPin)) {
      setPinStatus({
        type: "error",
        message: "New PIN must be strictly 6 to 10 numeric digits.",
      });
      return;
    }

    if (nPin !== cNPin) {
      setPinStatus({
        type: "error",
        message: "New PIN confirmation does not match.",
      });
      return;
    }

    setIsUpdatingPin(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_pin: cPin,
          new_pin: nPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update PIN");

      setPinStatus({
        type: "success",
        message: "PIN updated successfully!",
      });
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
      setTimeout(() => setPinStatus(null), 4000);
    } catch (err) {
      setPinStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Error updating PIN",
      });
    } finally {
      setIsUpdatingPin(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex items-center gap-2 text-sm font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
          <span>Loading settings...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100 safe-top safe-bottom select-none">
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between pb-4 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition active:scale-95"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Settings</h1>
              <p className="text-xs text-zinc-500 font-medium">
                Logged in as <span className="text-zinc-300 font-mono">@{settings?.username}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                settings?.has_resend_configured
                  ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-400"
                  : "bg-amber-950/40 border-amber-800/40 text-amber-400"
              }`}
            >
              {settings?.has_resend_configured ? "Email Delivery Ready" : "Setup Required"}
            </span>
          </div>
        </header>

        {/* Section 1: Email & Resend Setup */}
        <section className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 md:p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Morning Digest Delivery</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Configure your Resend API key and recipient email to receive daily briefs.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/60 transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
              <span>{showGuide ? "Hide Setup Guide" : "Resend Setup Guide"}</span>
            </button>
          </div>

          {/* Onboarding / Setup Guide Box */}
          {showGuide && (
            <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 text-xs space-y-2.5 text-zinc-300 leading-relaxed animate-fadeIn">
              <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>How to connect your free Resend account in 2 minutes:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 pl-1">
                <li>
                  Go to{" "}
                  <a
                    href="https://resend.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    resend.com <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  and create a free account (includes 3,000 free emails/month).
                </li>
                <li>
                  In your Resend dashboard, click on <strong>API Keys</strong> in the sidebar.
                </li>
                <li>
                  Click <strong>Create API Key</strong>, give it any name (e.g. &ldquo;Norma&rdquo;), and copy the key (starts with <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">re_</code>).
                </li>
                <li>
                  Paste the key into the <strong>Resend API Key</strong> field below, and set your delivery email.
                </li>
              </ol>
              <div className="pt-2 border-t border-zinc-900 text-[11px] text-zinc-500">
                <strong className="text-zinc-400">Important tip:</strong> When using Resend&apos;s free sandbox (<code className="text-zinc-300">onboarding@resend.dev</code>), Resend only sends emails to the address you used to register at Resend.
              </div>
            </div>
          )}

          {/* Settings Form */}
          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Recipient Email */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Delivery Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition tracking-wide"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Where your morning digests will be delivered every day.
              </p>
            </div>

            {/* Resend API Key */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-400">
                  Resend API Key
                </label>
                {settings?.has_resend_configured && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Configured ({settings.masked_resend_key})
                  </span>
                )}
              </div>
              <input
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder={
                  settings?.has_resend_configured
                    ? "Leave blank to keep current key, or enter new key..."
                    : "re_1234567890abcdef..."
                }
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition font-mono"
              />
            </div>

            {/* From Address (Optional) */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                From Address (Optional)
              </label>
              <input
                type="text"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="Norma Digest <onboarding@resend.dev>"
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition font-mono text-xs"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Defaults to Resend sandbox. Use your verified custom domain if available.
              </p>
            </div>

            {/* Save Status */}
            {saveStatus && (
              <div
                className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  saveStatus.type === "success"
                    ? "bg-emerald-950/40 border border-emerald-800/50 text-emerald-300"
                    : "bg-rose-950/40 border border-rose-800/50 text-rose-300"
                }`}
              >
                {saveStatus.type === "success" ? (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{saveStatus.message}</span>
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <div
                className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  testResult.type === "success"
                    ? "bg-emerald-950/40 border border-emerald-800/50 text-emerald-300"
                    : "bg-rose-950/40 border border-rose-800/50 text-rose-300"
                }`}
              >
                {testResult.type === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-5 h-9 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-98 disabled:opacity-40 transition shadow-sm cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </button>

              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isTestingEmail || (!email && !settings?.email)}
                className="w-full sm:w-auto px-4 h-9 rounded-xl bg-zinc-800 border border-zinc-700/80 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-zinc-700 active:scale-98 disabled:opacity-40 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-zinc-400" />
                <span>{isTestingEmail ? "Sending Test..." : "Send Test Email"}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Section 2: Personal API Token for Extension & Quick Capture */}
        <section className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Personal API Token & Quick Capture</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Use your personal API token to capture notes directly from the Chrome extension or iOS Shortcuts.
              </p>
            </div>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-zinc-300 break-all select-all">
              {settings?.api_key}
            </span>
            <button
              type="button"
              onClick={handleCopyApiKey}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-200 font-medium flex items-center gap-1.5 shrink-0 transition active:scale-95 cursor-pointer"
            >
              {copiedToken ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            In the Norma Chrome Extension, open Settings, paste this token, and set the endpoint to this site URL.
          </p>
        </section>

        {/* Section 3: Security & PIN Management */}
        <section className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 md:p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span>Security & Change PIN</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Update your numeric PIN (strictly 6 to 10 digits).
            </p>
          </div>

          <form onSubmit={handleUpdatePin} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Current PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Current PIN"
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-zinc-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  New PIN (6-10 digits)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="New PIN"
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-zinc-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Repeat New PIN"
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-zinc-600 transition"
                />
              </div>
            </div>

            {pinStatus && (
              <div
                className={`p-2 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  pinStatus.type === "success"
                    ? "bg-emerald-950/40 border border-emerald-800/50 text-emerald-300"
                    : "bg-rose-950/40 border border-rose-800/50 text-rose-300"
                }`}
              >
                <span>{pinStatus.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isUpdatingPin || !currentPin || newPin.length < 6 || newPin !== confirmNewPin}
              className="px-4 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 font-semibold text-xs transition active:scale-98 disabled:opacity-40 cursor-pointer"
            >
              {isUpdatingPin ? "Updating PIN..." : "Update PIN"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
