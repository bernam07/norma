import { Note } from "@/types/note";

/**
 * Formats a list of notes into clean Obsidian / Notion Markdown
 */
export function formatNotesToMarkdown(
  notes: Note[],
  title = "Norma Capture"
): string {
  if (notes.length === 0) {
    return `# ${title}\n\n*No notes recorded.*`;
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const dateHuman = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const frontmatter = [
    "---",
    `date: ${dateStr}`,
    `title: "${title} — ${dateStr}"`,
    "type: daily-capture",
    "tags:",
    "  - norma",
    "  - daily-notes",
    "  - quick-capture",
    `count: ${notes.length}`,
    "---",
    "",
  ].join("\n");

  const header = `# 📓 ${title}\n> *${dateHuman} &bull; ${notes.length} ${notes.length === 1 ? "note" : "notes"}*\n\n---\n\n`;

  const body = notes
    .map((note) => {
      const time = new Date(note.created_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      // Indent subsequent lines if multi-line
      const lines = note.content.split("\n");
      const firstLine = lines[0];
      const rest = lines.slice(1).map((l) => `  ${l}`).join("\n");

      // Detect if note represents a task/todo
      const isTodo = /^(todo|to-do|task|do:|buy|call|send|check)\b/i.test(firstLine);
      const prefix = isTodo ? `- [ ] \`${time}\` ` : `- \`${time}\` `;

      return `${prefix}${firstLine}${rest ? "\n" + rest : ""}`;
    })
    .join("\n\n");

  const footer = `\n\n---\n*Exported from Norma on ${now.toLocaleString("en-US")}*\n`;

  return frontmatter + header + body + footer;
}

/**
 * Downloads notes as a .md file directly in the user's browser
 */
export function downloadMarkdownFile(content: string, filename?: string): void {
  const dateStr = new Date().toISOString().split("T")[0];
  const finalFilename = filename || `norma-${dateStr}.md`;

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies formatted markdown to the system clipboard
 */
export async function copyMarkdownToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}
