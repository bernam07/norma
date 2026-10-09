"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Lock,
  Archive,
  Send,
  Pencil,
  Trash2,
  Check,
  Download,
  Copy,
  WifiOff,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Note } from "@/types/note";
import {
  savePendingNote,
  getPendingNotes,
  syncPendingNotes,
} from "@/lib/offline-db";
import {
  formatNotesToMarkdown,
  downloadMarkdownFile,
  copyMarkdownToClipboard,
} from "@/lib/export-markdown";

export default function HomePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Offline states
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Dispatch state
  const [isDispatching, setIsDispatching] = useState(false);
  const [showDispatchConfirm, setShowDispatchConfirm] = useState(false);

  // Copy state
  const [isCopied, setIsCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await fetch("/api/notes", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error("Failed to load notes");
      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      if (navigator.onLine) {
        setError(err instanceof Error ? err.message : "Error loading notes");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Sync pending offline notes
  const runOfflineSync = async () => {
    const { syncedCount } = await syncPendingNotes((tempId, serverNote) => {
      setNotes((prev) => [serverNote, ...prev.filter((n) => n.id !== tempId)]);
    });

    const pending = await getPendingNotes();
    setPendingCount(pending.length);

    if (syncedCount > 0) {
      setFeedback(`Synced ${syncedCount} note(s) saved while offline!`);
      setTimeout(() => setFeedback(null), 3000);
      fetchNotes();
    }
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      runOfflineSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    fetchNotes();
    getPendingNotes().then((p) => setPendingCount(p.length));
    runOfflineSync();

    textareaRef.current?.focus();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    const tempId = crypto.randomUUID();
    const optimisticNote: Note = {
      id: tempId,
      content: trimmed,
      created_at: new Date().toISOString(),
      processed: false,
    };

    // If offline: save directly to IndexedDB
    if (!navigator.onLine) {
      try {
        await savePendingNote({
          id: tempId,
          content: trimmed,
          created_at: optimisticNote.created_at,
        });
        setNotes((prev) => [optimisticNote, ...prev]);
        setContent("");
        setPendingCount((prev) => prev + 1);
        setFeedback("Saved locally (offline mode).");
        setTimeout(() => setFeedback(null), 2500);
      } catch {
        setError("Error saving note offline.");
      } finally {
        setIsSubmitting(false);
        textareaRef.current?.focus();
      }
      return;
    }

    // If online: submit to API
    setNotes((prev) => [optimisticNote, ...prev]);
    setContent("");

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to record note");
      }

      const data = await response.json();
      setNotes((prev) =>
        prev.map((n) => (n.id === tempId ? data.note : n))
      );
    } catch {
      // Fallback: save to IndexedDB if network error
      await savePendingNote({
        id: tempId,
        content: trimmed,
        created_at: optimisticNote.created_at,
      });
      setPendingCount((prev) => prev + 1);
      setFeedback("Connection failed: note saved locally.");
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setIsSubmitting(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Delete note
  const handleDeleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (res.status === 401) {
        window.location.href = "/login";
      }
    } catch {
      // ignore
    }
  };

  // Start inline editing
  const handleStartEdit = (note: Note) => {
    setEditingId(note.id);
    setEditingContent(note.content);
  };

  // Save inline edit
  const handleSaveEdit = async (id: string) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;

    setIsSavingEdit(true);
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, content: trimmed } : n))
    );
    setEditingId(null);

    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
      }
    } catch {
      // ignore
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Manual Digest Dispatch
  const handleTriggerDispatch = async () => {
    if (notes.length === 0 || isDispatching) return;
    setIsDispatching(true);
    setShowDispatchConfirm(false);
    setError(null);

    try {
      const res = await fetch("/api/digest/send", { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch digest");
      }

      setFeedback(data.message || "Daily digest dispatched successfully!");
      setTimeout(() => setFeedback(null), 4000);
      setNotes([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error sending briefing");
    } finally {
      setIsDispatching(false);
    }
  };

  // Export to Markdown
  const handleCopyMarkdown = async () => {
    const md = formatNotesToMarkdown(notes, "Norma — Daily Capture Queue");
    const success = await copyMarkdownToClipboard(md);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = formatNotesToMarkdown(notes, "Norma — Daily Capture Queue");
    downloadMarkdownFile(md, `norma-queue-${new Date().toISOString().split("T")[0]}.md`);
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "";
    }
  };

  const todayDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <main className="h-dvh flex flex-col bg-zinc-950 text-zinc-100 safe-top safe-bottom safe-left safe-right overflow-hidden select-none">
      {/* Header */}
      <header className="px-5 pt-4 pb-3 border-b border-zinc-900/80 flex items-center justify-between shrink-0 bg-zinc-950/90 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white">Norma</h1>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
          </div>
          <p className="text-xs text-zinc-500 font-medium">{todayDate}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-800/50 text-[10px] text-amber-300 font-medium">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </div>
          )}

          {/* Queue Count */}
          <div className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-medium text-zinc-400">
            {notes.length} queued
          </div>

          {/* Link to Archive */}
          <Link
            href="/archive"
            title="View archive and history"
            className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition active:scale-95"
          >
            <Archive className="w-3.5 h-3.5" />
          </Link>

          {/* Lock session */}
          <button
            onClick={handleLogout}
            title="Lock session"
            className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Offline Pending Banner */}
      {pendingCount > 0 && isOnline && (
        <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-800/40 text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {pendingCount} note(s) syncing...
          </span>
          <button
            onClick={runOfflineSync}
            className="text-[11px] underline font-medium hover:text-emerald-100"
          >
            Sync now
          </button>
        </div>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-emerald-400 text-xs text-center font-medium animate-fadeIn">
          {feedback}
        </div>
      )}

      {/* Note input section */}
      <section className="p-4 shrink-0 bg-zinc-950">
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-700 transition">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Capture thought, task, or observation..."
            rows={3}
            className="w-full bg-transparent text-base text-zinc-100 placeholder:text-zinc-500 resize-none outline-none leading-relaxed select-text"
          />

          <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 hidden sm:inline font-mono">
              Enter to send &bull; Shift + Enter for newline
            </span>
            <span className="text-[11px] text-zinc-500 sm:hidden">
              Digest dispatched at 07:00 UTC
            </span>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
              className="h-9 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 hover:bg-white active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition shadow-sm touch-manipulation cursor-pointer disabled:cursor-not-allowed"
            >
              <span>{isSubmitting ? "Saving..." : "Capture"}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800/50 text-red-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-200 ml-2"
            >
              &times;
            </button>
          </div>
        )}
      </section>

      {/* Action Bar & Queue Header */}
      <section className="flex-1 flex flex-col min-h-0 px-4 pb-2">
        <div className="flex items-center justify-between pb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Today&apos;s Queue
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">
              (resets at 07:00 UTC)
            </span>
          </div>

          {/* Action buttons (Manual Digest & Export) */}
          {notes.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyMarkdown}
                title="Copy as Markdown for Obsidian / Notion"
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition text-[11px]"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                onClick={handleDownloadMarkdown}
                title="Download notes as .md"
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition text-[11px]"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {/* Manual Dispatch Button */}
              <button
                onClick={() => setShowDispatchConfirm(true)}
                disabled={isDispatching}
                title="Send Daily Digest Now via Email"
                className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[11px] font-medium flex items-center gap-1.5 transition active:scale-95"
              >
                <Send className="w-3 h-3 text-emerald-400" />
                <span>{isDispatching ? "Sending..." : "Send Digest Now"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Confirmation Modal for Manual Dispatch */}
        {showDispatchConfirm && (
          <div className="mb-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl flex items-center justify-between animate-fadeIn">
            <div>
              <p className="text-xs font-semibold text-white">
                Send daily digest now via email?
              </p>
              <p className="text-[11px] text-zinc-400">
                This will email {notes.length} note(s) and clear your current queue.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDispatchConfirm(false)}
                className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerDispatch}
                disabled={isDispatching}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition"
              >
                {isDispatching ? "Sending..." : "Confirm Send"}
              </button>
            </div>
          </div>
        )}

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 select-text">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-xs">
              Loading notes...
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center rounded-2xl border border-dashed border-zinc-900 p-6">
              <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 mb-2">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium text-zinc-400">Queue is empty</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                Notes captured today will be included in tomorrow morning&apos;s digest at 07:00 UTC.
              </p>
            </div>
          ) : (
            notes.map((note, index) => {
              const isEditing = editingId === note.id;

              return (
                <div
                  key={note.id}
                  className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 transition hover:border-zinc-700/80 group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-zinc-500 font-mono">
                      #{notes.length - index}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {formatTime(note.created_at)}
                      </span>

                      {/* Quick Edit & Delete Actions */}
                      <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition">
                        {!isEditing && (
                          <button
                            onClick={() => handleStartEdit(note)}
                            title="Edit note"
                            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          title="Delete note"
                          className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 mt-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={2}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 outline-none leading-relaxed"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 rounded bg-zinc-800 text-[11px] text-zinc-300 hover:bg-zinc-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(note.id)}
                          disabled={isSavingEdit || !editingContent.trim()}
                          className="px-2.5 py-1 rounded bg-zinc-100 text-zinc-950 font-semibold text-[11px] hover:bg-white"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed select-text font-normal">
                      {note.content}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
