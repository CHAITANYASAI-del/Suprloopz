// Server-only email sender (Resend). Used to deliver the vendor invitation that
// carries a temporary password + an activation link. NEVER import from a client
// component — it reads RESEND_API_KEY.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Generates a temp password that satisfies the vendor password rules
// (>=12 chars, a digit, a special char). It is single-use — the vendor is forced
// to replace it immediately after first sign-in.
export function generateTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  // Guarantee one of each required class, then fill to 14 chars.
  let pw = pick(upper) + pick(lower) + pick(digits) + pick(special);
  for (let i = pw.length; i < 14; i++) pw += pick(all);
  // Shuffle so the required chars aren't always in the same positions.
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

export async function sendVendorInviteEmail({ to, tempPassword, activateUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'SuperLoopz <onboarding@resend.dev>';
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
    <h2 style="margin:0 0 8px">You're invited to SuperLoopz</h2>
    <p style="margin:0 0 16px;color:#475569">
      A SuperLoopz team member has created your vendor account. Use the temporary
      credentials below to sign in — you'll be asked to set your own password right away.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
      <tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0;font-weight:600">${to}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Temporary password</td><td style="padding:6px 0;font-weight:600;font-family:ui-monospace,monospace">${tempPassword}</td></tr>
    </table>
    <a href="${activateUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
      Sign in &amp; get started
    </a>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">
      The button signs you in with the temporary password automatically. If it doesn't,
      go to the sign-in page and enter the email and temporary password above.
      This temporary password stops working once you set your own.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px" />
    <p style="margin:0;font-size:12px;color:#94a3b8">
      SuperLoopz · Vendor Onboarding<br />
      You're receiving this because a SuperLoopz team member invited you as a vendor.
      Questions? Reply to this email and our team will help.
    </p>
  </div>`;

  // Plain-text alternative — emails with only HTML score worse with spam filters.
  const text = [
    "You're invited to SuperLoopz",
    '',
    'A SuperLoopz team member has created your vendor account. Use the temporary',
    "credentials below to sign in — you'll set your own password right away.",
    '',
    `Email: ${to}`,
    `Temporary password: ${tempPassword}`,
    '',
    `Sign in & get started: ${activateUrl}`,
    '',
    'This temporary password stops working once you set your own.',
    '',
    'SuperLoopz · Vendor Onboarding',
    "You're receiving this because a SuperLoopz team member invited you as a vendor.",
  ].join('\n');

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: 'support@suprloopz.com',
      subject: 'Your SuperLoopz vendor invitation',
      html,
      text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Email send failed (${res.status}): ${detail}`);
  }
  return res.json();
}
