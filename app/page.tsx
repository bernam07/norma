"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Note } from "@/types/note";

export default function HomePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      if (!response.ok) throw new Error("Failed to fetch notes");
      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading notes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    textareaRef.current?.focus();
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
        throw new Error("Failed to save note");
      }

      const data = await response.json();
      setNotes((prev) =>
        prev.map((n) => (n.id === tempId ? data.note : n))
      );
    } catch (err) {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      setError(err instanceof Error ? err.message : "Failed to record note");
      setContent(trimmed);
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
      <header className="px-5 pt-4 pb-3 border-b border-zinc-900/80 flex items-center justify-between shrink-0 bg-zinc-950/90 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white">Norma</h1>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs text-zinc-500 font-medium">{todayDate}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-medium text-zinc-400">
            {notes.length} queued
          </div>
          <button
            onClick={handleLogout}
            title="Bloquear sessão"
            className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

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
              Digest dispatched at 07:00
            </span>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
              className="h-9 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 hover:bg-white active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition shadow-sm touch-manipulation"
            >
              <span>Capture</span>
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

      <section className="flex-1 flex flex-col min-h-0 px-4 pb-2">
        <div className="flex items-center justify-between pb-2 px-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Accumulated Notes
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">
            Next cron: 07:00 UTC
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 select-text">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-xs">
              Loading notes...
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center rounded-2xl border border-dashed border-zinc-900 p-6">
              <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-400">Queue is empty</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                Notes captured today will be emailed tomorrow morning.
              </p>
            </div>
          ) : (
            notes.map((note, index) => (
              <div
                key={note.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 transition hover:border-zinc-700/80"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-zinc-400 font-mono">
                    #{notes.length - index}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {formatTime(note.created_at)}
                  </span>
                </div>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed select-text font-normal">
                  {note.content}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
