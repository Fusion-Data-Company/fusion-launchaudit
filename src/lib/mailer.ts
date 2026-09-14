/**
 * Minimal, dependency-free mailer. It sends ONLY when SMTP is configured through
 * the operator's own server (MONITOR_SMTP_URL = smtps://user:pass@host:465) and
 * is a documented no-op otherwise. No Resend/Postmark/SendGrid/Twilio, no new
 * paid vendor. Used for the weekly monitoring diff and for delivering paid
 * audit reports (PDF attached).
 *
 * Uses implicit TLS (port 465) with AUTH LOGIN. If anything fails it returns
 * { ok:false, error } and the caller carries on; email is never allowed to
 * break a scan or an order.
 *
 * Outbound capture: when MAIL_CAPTURE_DIR is set, every message is ALSO written
 * to that directory as an .eml file (the exact RFC 5322 bytes that would go
 * down the wire, attachments included). That is how a rehearsal proves the
 * send path without mail credentials: the message exists, on disk, complete.
 */
import fs from "node:fs/promises";
import path from "node:path";
import tls from "node:tls";
import { randomBytes } from "node:crypto";

export type MailAttachment = { filename: string; contentType: string; content: Buffer };
export type MailInput = { to: string; subject: string; text: string; html?: string; attachments?: MailAttachment[] };
export type MailResult =
  | { ok: true; id?: string; captured?: string }
  | { ok: false; error: string; captured?: string }
  | { skipped: string; captured?: string };

export function mailerConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.MONITOR_SMTP_URL && env.MONITOR_MAIL_FROM);
}

function b64(s: string): string { return Buffer.from(s, "utf8").toString("base64"); }

/** Base64 with 76-character lines, as MIME requires. */
function b64Lines(buf: Buffer): string {
  return buf.toString("base64").replace(/(.{76})/g, "$1\r\n");
}

function safeHeader(s: string): string { return s.replace(/[\r\n]+/g, " ").trim(); }

/**
 * Build the RFC 5322 message (headers + body, CRLF line endings). Exported so a
 * test and the capture path can see exactly what would be sent. NOT dot-stuffed;
 * the SMTP DATA step does that on the wire.
 */
export function buildMessage(from: string, input: MailInput, opts: { date?: Date; messageId?: string } = {}): string {
  const date = (opts.date ?? new Date()).toUTCString();
  const domain = from.includes("@") ? from.split("@")[1] : "80-20.dev";
  const messageId = opts.messageId ?? `<${Date.now().toString(36)}.${randomBytes(6).toString("hex")}@${domain}>`;
  const head = [
    `From: ${safeHeader(from)}`,
    `To: ${safeHeader(input.to)}`,
    `Subject: ${safeHeader(input.subject)}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
  ];
  const text = input.text.replace(/\r?\n/g, "\r\n");
  const html = input.html ? input.html.replace(/\r?\n/g, "\r\n") : null;
  const attachments = input.attachments ?? [];

  if (!html && attachments.length === 0) {
    return [...head, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", text].join("\r\n");
  }

  const bodyPart = (): string => {
    if (!html) return ["Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", text].join("\r\n");
    const alt = `alt_${randomBytes(8).toString("hex")}`;
    return [
      `Content-Type: multipart/alternative; boundary="${alt}"`, "",
      `--${alt}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", text, "",
      `--${alt}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", html, "",
      `--${alt}--`,
    ].join("\r\n");
  };

  if (attachments.length === 0) {
    // html only: the alternative part IS the body
    return [...head, bodyPart()].join("\r\n");
  }

  const mixed = `mixed_${randomBytes(8).toString("hex")}`;
  const parts: string[] = [...head, `Content-Type: multipart/mixed; boundary="${mixed}"`, "", `--${mixed}`, bodyPart(), ""];
  for (const a of attachments) {
    const name = safeHeader(a.filename).replace(/"/g, "");
    parts.push(
      `--${mixed}`,
      `Content-Type: ${safeHeader(a.contentType)}; name="${name}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${name}"`,
      "",
      b64Lines(a.content),
      "",
    );
  }
  parts.push(`--${mixed}--`);
  return parts.join("\r\n");
}

/** Write the exact outbound message to MAIL_CAPTURE_DIR. Returns the path, or null when capture is off or fails. */
async function captureMessage(message: string, env: Record<string, string | undefined>): Promise<string | null> {
  const dir = env.MAIL_CAPTURE_DIR;
  if (!dir) return null;
  try {
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}.eml`);
    await fs.writeFile(file, message, "utf8");
    return file;
  } catch {
    return null;
  }
}

export async function sendMail(input: MailInput, env: Record<string, string | undefined> = process.env): Promise<MailResult> {
  const from = env.MONITOR_MAIL_FROM || "no-reply@80-20.dev";
  const message = buildMessage(from, input);
  const captured = (await captureMessage(message, env)) ?? undefined;

  if (!mailerConfigured(env)) return { skipped: "SMTP not configured (MONITOR_SMTP_URL / MONITOR_MAIL_FROM unset)", captured };
  let url: URL;
  try { url = new URL(env.MONITOR_SMTP_URL!); } catch { return { ok: false, error: "MONITOR_SMTP_URL is not a valid URL", captured }; }
  if (url.protocol !== "smtps:") return { ok: false, error: "Only smtps:// (implicit TLS, port 465) is supported", captured };
  const host = url.hostname;
  const port = Number(url.port || 465);
  const user = decodeURIComponent(url.username);
  const pass = decodeURIComponent(url.password);

  // Dot-stuff any line starting with '.' per RFC 5321, on the wire only.
  const wire = message.replace(/^\./gm, "..");

  return new Promise<MailResult>((resolve) => {
    let settled = false;
    const done = (r: MailResult) => { if (!settled) { settled = true; try { socket.end(); } catch { /* ignore */ } resolve({ ...r, captured }); } };
    const socket = tls.connect({ host, port, servername: host, timeout: 12000 }, () => { /* wait for greeting */ });
    let buf = "";
    const queue: Array<{ cmd: string | null; expect: number }> = [
      { cmd: null, expect: 220 },
      { cmd: `EHLO ${host}`, expect: 250 },
      { cmd: "AUTH LOGIN", expect: 334 },
      { cmd: b64(user), expect: 334 },
      { cmd: b64(pass), expect: 235 },
      { cmd: `MAIL FROM:<${from}>`, expect: 250 },
      { cmd: `RCPT TO:<${input.to}>`, expect: 250 },
      { cmd: "DATA", expect: 354 },
      { cmd: wire + "\r\n.", expect: 250 },
      { cmd: "QUIT", expect: 221 },
    ];
    let step = 0;
    const pump = () => {
      const line = buf.trim().split("\n").pop() || "";
      const code = Number(line.slice(0, 3));
      const expected = queue[step].expect;
      if (code !== expected) { done({ ok: false, error: `SMTP step ${step} expected ${expected}, got: ${line.slice(0, 120)}` }); return; }
      step++;
      buf = "";
      if (step >= queue.length) { done({ ok: true }); return; }
      const next = queue[step];
      if (next.cmd !== null) socket.write(next.cmd + "\r\n");
      if (queue[step - 1].cmd === "QUIT") done({ ok: true });
    };
    socket.on("data", (d) => { buf += d.toString("utf8"); if (/\r?\n$/.test(buf)) pump(); });
    socket.on("error", (e) => done({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    socket.on("timeout", () => done({ ok: false, error: "SMTP timeout" }));
  });
}
