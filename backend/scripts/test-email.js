// One-off Resend smoke test — verifies RESEND_API_KEY + sender work without
// needing the rest of the stack (Keycloak/Postgres).
//
//   node scripts/test-email.js [recipient@example.com]
//
// While using the onboarding@resend.dev sandbox sender, the recipient MUST be
// the email your Resend account is registered with.
import { sendVendorInvite } from '../src/email/resend.js';
import { config } from '../src/config/env.js';

const to = process.argv[2] || 'chaitanyasai1978@gmail.com';

console.log(`Sending test invite email…`);
console.log(`  from: ${config.resend.fromEmail}`);
console.log(`  to:   ${to}`);
console.log(`  key:  ${config.resend.apiKey ? config.resend.apiKey.slice(0, 6) + '…' : '(not set)'}`);

try {
  const res = await sendVendorInvite({ to, tempPassword: 'Temp-Password#2026' });
  console.log('\n✅ Resend accepted the email. Response:', res);
  console.log('Check the inbox (and spam) for "You have been invited to SuperLoopz".');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Send failed:', err.message);
  process.exit(1);
}
