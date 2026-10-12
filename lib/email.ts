import { Resend } from "resend";
import { Note } from "@/types/note";

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateDigestHtml(notes: Note[], dateString: string): string {
  const notesRows = notes
    .map((note, index) => {
      const timeString = new Date(note.created_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const formattedContent = escapeHtml(note.content).replace(/\n/g, "<br />");

      return `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #27272a;">
            <div style="font-size: 11px; font-weight: 600; color: #a1a1aa; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px;">
              #${index + 1} &bull; ${timeString}
            </div>
            <div style="font-size: 15px; line-height: 1.6; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${formattedContent}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f4f4f5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px; text-align: left;">
          <tr>
            <td>
              <div style="margin-bottom: 24px; border-bottom: 1px solid #27272a; padding-bottom: 16px;">
                <h1 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0; letter-spacing: -0.02em;">Daily Capture Digest</h1>
                <div style="font-size: 13px; color: #a1a1aa;">${dateString}</div>
              </div>
              <div style="margin-bottom: 20px;">
                <span style="display: inline-block; background-color: #27272a; color: #e4e4e7; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">
                  ${notes.length} ${notes.length === 1 ? "note captured" : "notes captured"}
                </span>
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                ${notesRows}
              </table>
              <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #27272a; font-size: 12px; color: #71717a; text-align: center;">
                Sent automatically by Norma
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendDailyBriefing(notes: Note[]): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not defined");
  }

  const recipient = process.env.USER_EMAIL;
  if (!recipient) {
    throw new Error("USER_EMAIL environment variable is not defined");
  }

  const dateString = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const fromAddress = process.env.FROM_EMAIL || "Norma Digest <onboarding@resend.dev>";
  const html = generateDigestHtml(notes, dateString);

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: recipient,
    subject: `Daily Briefing — ${dateString} (${notes.length} ${notes.length === 1 ? "note" : "notes"})`,
    html,
  });

  if (error) {
    console.error("[Email] Resend API error:", error);
    throw new Error(error.message);
  }

  return { id: data?.id || "" };
}
