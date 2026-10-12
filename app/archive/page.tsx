"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Download,
  Copy,
  Check,
  Calendar,
  Clock,
  Settings,
} from "lucide-react";
import { Note } from "@/types/note";
import {
  formatNotesToMarkdown,
  downloadMarkdownFile,
  copyMarkdownToClipboard,
} from "@/lib/export-markdown";

const ARCHIVE_CACHE_KEY = "norma_archive_cache_v1";

export default function ArchivePage() {
  const [notes, setNotes] = useState<Note[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(ARCHIVE_CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [total, setTotal] = useState(() => notes.length);
  const [isLoading, setIsLoading] = useState(() => notes.length === 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedDay, setCopiedDay] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArchive = async () => {
    try {
      const res = await fetch("/api/archive?limit=300", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error("Failed to load archive notes");
      const data = await res.json();
      const freshNotes = data.notes || [];
      setNotes(freshNotes);
      setTotal(data.total || 0);
      try {
        localStorage.setItem(ARCHIVE_CACHE_KEY, JSON.stringify(freshNotes));
      } catch {
        // ignore
      }
    } catch (err) {
      if (notes.length === 0) {
        setError(err instanceof Error ? err.message : "Connection failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  // Filter notes by search
  const filteredNotes = notes.filter((n) =>
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group notes by localized Date
  const groupedByDate = filteredNotes.reduce((acc, note) => {
    const dateObj = new Date(note.created_at);
    const dateKey = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  const dateKeys = Object.keys(groupedByDate);

  const handleCopyAll = async () => {
    const md = formatNotesToMarkdown(notes, "Norma — Complete Archive");
    const success = await copyMarkdownToClipboard(md);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const handleDownloadAll = () => {
    const md = formatNotesToMarkdown(notes, "Norma — Complete Archive");
    downloadMarkdownFile(md, "norma-complete-archive.md");
  };

  const handleExportDay = (dateStr: string, dayNotes: Note[]) => {
    const md = formatNotesToMarkdown(dayNotes, `Norma — ${dateStr}`);
    const safeDate = new Date(dayNotes[0].created_at).toISOString().split("T")[0];
    downloadMarkdownFile(md, `norma-${safeDate}.md`);
  };

  const handleCopyDay = async (dateStr: string, dayNotes: Note[]) => {
    const md = formatNotesToMarkdown(dayNotes, `Norma — ${dateStr}`);
    const success = await copyMarkdownToClipboard(md);
    if (success) {
      setCopiedDay(dateStr);
      setTimeout(() => setCopiedDay(null), 2000);
    }
  };

  return (
    <main className="min-h-dvh flex flex-col bg-zinc-950 text-zinc-100 safe-top safe-left safe-right select-none">
      {/* Header */}
      <header className="px-5 py-4 border-b border-zinc-900/80 flex items-center justify-between shrink-0 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition active:scale-95"
            title="Back to capture"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Archive</h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                {total} processed
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5">
          {notes.length > 0 && (
            <>
              <button
                onClick={handleCopyAll}
                title="Copy all as Markdown (Obsidian / Notion)"
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-1.5 transition active:scale-95"
              >
                {copiedAll ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="hidden sm:inline">Copy MD</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadAll}
                title="Download complete .md file"
                className="px-2.5 py-1.5 rounded-xl bg-zinc-100 text-zinc-950 text-xs font-semibold hover:bg-white flex items-center gap-1.5 transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export .md</span>
              </button>
            </>
          )}

          <Link
            href="/settings"
            title="Settings & Setup"
            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition active:scale-95"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Search & Filter Bar */}
      <div className="px-5 py-3 border-b border-zinc-900 bg-zinc-950/60 sticky top-[57px] z-10 backdrop-blur-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search thoughts in archive..."
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 select-text">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-3">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
            <p className="text-xs">Loading archive...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-400 text-xs text-center">
            {error}
          </div>
        ) : dateKeys.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-600 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-300">
              {searchQuery ? "No results found" : "Archive Empty"}
            </h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? `No notes found matching "${searchQuery}".`
                : "Notes captured and processed by the daily morning digest will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-8 max-w-2xl mx-auto">
            {dateKeys.map((dateKey) => {
              const dayNotes = groupedByDate[dateKey];
              const isCopied = copiedDay === dateKey;

              return (
                <section key={dateKey} className="space-y-3">
                  {/* Date Header with Daily Action */}
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <h2 className="text-xs font-semibold text-zinc-300 tracking-tight">
                        {dateKey}
                      </h2>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        ({dayNotes.length})
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyDay(dateKey, dayNotes)}
                        title="Copy day to Obsidian"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition text-[11px]"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={() => handleExportDay(dateKey, dayNotes)}
                        title="Download day as .md"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition text-[11px]"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Notes List for this Day */}
                  <div className="space-y-2">
                    {dayNotes.map((note) => {
                      const timeString = new Date(note.created_at).toLocaleTimeString(
                        "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }
                      );

                      return (
                        <article
                          key={note.id}
                          className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 hover:border-zinc-700/80 transition"
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 mb-1.5">
                            <Clock className="w-3 h-3" />
                            <span>{timeString}</span>
                          </div>
                          <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap select-text">
                            {note.content}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
