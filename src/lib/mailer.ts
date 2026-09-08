/**
 * Minimal, dependency-free mailer. It sends ONLY when SMTP is configured through
 * the operator's own server (MONITOR_SMTP_URL = smtps://user:pass@host:465) and
 * is a documented no-op otherwise — per the standing rule, no Resend/Postmark/
 * SendGrid/Twilio, no new paid vendor. Used to email a monitoring diff.
 *
 * Uses implicit TLS (port 465) with AUTH LOGIN — the simplest correct path. If
 * anything fails it returns { ok:false, error } and the caller carries on; email
 * is never allowed to break a scan.
 */
import tls from "node:tls";

export type MailInput = { to: string; subject: string; text: string };
export type MailResult = { ok: true; id?: string } | { ok: false; error: string } | { skipped: string };

export function mailerConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.MONITOR_SMTP_URL && env.MONITOR_MAIL_FROM);
}

function b64(s: string): string { return Buffer.from(s, "utf8").toString("base64"); }

export async function sendMail(input: MailInput, env: Record<string, string | undefined> = process.env): Promise<MailResult> {
  if (!mailerConfigured(env)) return { skipped: "SMTP not configured (MONITOR_SMTP_URL / MONITOR_MAIL_FROM unset)" };
  let url: URL;
  try { url = new URL(env.MONITOR_SMTP_URL!); } catch { return { ok: false, error: "MONITOR_SMTP_URL is not a valid URL" }; }
  if (url.protocol !== "smtps:") return { ok: false, error: "Only smtps:// (implicit TLS, port 465) is supported" };
  const host = url.hostname;
  const port = Number(url.port || 465);
  const user = decodeURIComponent(url.username);
  const pass = decodeURIComponent(url.password);
  const from = env.MONITOR_MAIL_FROM!;

  return new Promise<MailResult>((resolve) => {
    let settled = false;
    const done = (r: MailResult) => { if (!settled) { settled = true; try { socket.end(); } catch { /* ignore */ } resolve(r); } };
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
      { cmd: buildMessage(from, input) + "\r\n.", expect: 250 },
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

function buildMessage(from: string, input: MailInput): string {
  const headers = [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject.replace(/[\r\n]/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
  ];
  // Dot-stuff any line starting with '.' per RFC 5321.
  const body = input.text.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
  return headers.join("\r\n") + body;
}
