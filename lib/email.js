'use strict';
// Resend wrapper with a dry mode. Copied in spirit from outsmart-app lib/email.js.
// DIGEST_DRY=1 (or missing RESEND_API_KEY) prints instead of sending, so local dev
// and preview mode never email a real person by accident.
const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.FROM_EMAIL || 'Jay <jay@outsmartthesystem.org>';
const resend = apiKey ? new Resend(apiKey) : null;

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Minimal, brand-plain HTML shell. No hype, operator voice (plan 5.5).
function emailTemplate({ heading, bodyHtml, footer }) {
  const foot = footer || 'Entrepreneurship coaching and education, not financial, tax, legal, or investment advice.';
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Segoe UI,Arial,sans-serif;color:#1c2330">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="background:#fff;border:1px solid #d9dee8;border-radius:8px;padding:24px">
    <h1 style="font-size:18px;color:#1f4e6b;margin:0 0 12px">${escapeHtml(heading)}</h1>
    ${bodyHtml}
  </div>
  <p style="font-size:11px;color:#55607a;margin:16px 4px">${escapeHtml(foot)}</p>
</div></body></html>`;
}

function isDry() {
  return process.env.DIGEST_DRY === '1' || !resend;
}

// Send an email. Returns { sent: bool, dry: bool }. Best-effort by design:
// a mail failure must never crash the request that triggered it.
async function sendEmail({ to, subject, html, text }) {
  if (isDry()) {
    console.log(`\n[email:DRY] to=${to}\n  subject=${subject}\n  ${text || '(html body)'}\n`);
    return { sent: false, dry: true };
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html, text });
    return { sent: true, dry: false };
  } catch (err) {
    console.error('[email] send failed', err.message);
    return { sent: false, dry: false, error: err.message };
  }
}

module.exports = { sendEmail, emailTemplate, escapeHtml, isDry };
