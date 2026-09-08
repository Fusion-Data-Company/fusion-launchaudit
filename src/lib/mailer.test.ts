import { test } from "node:test";
import assert from "node:assert/strict";
import { mailerConfigured, sendMail } from "./mailer.ts";

test("mailerConfigured is false without both env vars", () => {
  assert.equal(mailerConfigured({}), false);
  assert.equal(mailerConfigured({ MONITOR_SMTP_URL: "smtps://u:p@h:465" }), false);
  assert.equal(mailerConfigured({ MONITOR_SMTP_URL: "smtps://u:p@h:465", MONITOR_MAIL_FROM: "a@b.c" }), true);
});

test("sendMail is a documented no-op when not configured", async () => {
  const r = await sendMail({ to: "a@b.c", subject: "s", text: "t" }, {});
  assert.ok("skipped" in r);
});

test("sendMail rejects a non-smtps URL without opening a socket", async () => {
  const r = await sendMail({ to: "a@b.c", subject: "s", text: "t" }, { MONITOR_SMTP_URL: "smtp://u:p@h:587", MONITOR_MAIL_FROM: "a@b.c" });
  assert.ok("ok" in r && r.ok === false);
});
