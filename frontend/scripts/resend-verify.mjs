// Verifies a Resend key + verified domain, then optionally sends a real test email.
//   node scripts/resend-verify.mjs <key> [test-recipient]
const key = process.argv[2];
const to = process.argv[3];
const FROM = 'Suprloopz <support@suprloopz.com>';
const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

// 1) Which domains does this key's account have, and are they verified?
const dRes = await fetch('https://api.resend.com/domains', { headers: H });
const domains = await dRes.json();
console.log('domains status:', dRes.status);
console.log(JSON.stringify(domains, null, 2));

// 2) Optional real send from support@suprloopz.com to confirm delivery + from-address.
if (to) {
  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: 'SuperLoopz domain test',
      html: '<p>This confirms SuperLoopz can send from <strong>support@suprloopz.com</strong>.</p>',
    }),
  });
  console.log('\nsend status:', send.status);
  console.log('send response:', await send.text());
}
