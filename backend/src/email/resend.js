// Transactional email via Resend. Contains the five templates defined in the
// build spec. If RESEND_API_KEY is not set (local dev), emails are logged
// instead of sent so the flow still works end to end.
import { Resend } from 'resend';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;

async function send({ to, subject, html }) {
  if (!resend) {
    logger.warn({ to, subject }, 'RESEND_API_KEY not set — email not sent (dev mode)');
    return { id: 'dev-no-send' };
  }
  const { data, error } = await resend.emails.send({
    from: config.resend.fromEmail,
    to,
    subject,
    html,
  });
  if (error) {
    logger.error({ error, to, subject }, 'Resend send failed');
    throw new Error(`Email send failed: ${error.message}`);
  }
  return data;
}

// ---- Shared chrome ---------------------------------------------------------
function layout(title, bodyHtml) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
    <div style="background:#0B1220;padding:20px 24px;border-radius:8px 8px 0 0">
      <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.5px">SuperLoopz</span>
    </div>
    <div style="border:1px solid #E5E7EB;border-top:none;padding:28px 24px;border-radius:0 0 8px 8px">
      <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
      ${bodyHtml}
      <p style="color:#6B7280;font-size:12px;margin-top:32px">
        SuperLoopz — Universal AI-native commerce operating system.
      </p>
    </div>
  </div>`;
}

const button = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${label}</a>`;

// ---- 1. Vendor invite ------------------------------------------------------
export function sendVendorInvite({ to, tempPassword }) {
  const loginUrl = `${config.appBaseUrl}/login`;
  return send({
    to,
    subject: 'You have been invited to SuperLoopz',
    html: layout(
      'You have been invited to SuperLoopz',
      `<p>An administrator has invited you to onboard as a vendor on SuperLoopz.</p>
       <p>Use the temporary credentials below to sign in. You will be asked to set a new password on first login.</p>
       <table style="margin:16px 0;font-size:14px">
         <tr><td style="padding:4px 12px 4px 0;color:#6B7280">Email</td><td><strong>${to}</strong></td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#6B7280">Temporary password</td><td><strong>${tempPassword}</strong></td></tr>
       </table>
       <p>${button(loginUrl, 'Log in to SuperLoopz')}</p>
       <p style="color:#6B7280;font-size:12px">This invitation link points to ${loginUrl}</p>`,
    ),
  });
}

// ---- 2. Password reset confirmation ---------------------------------------
export function sendPasswordResetConfirmation({ to }) {
  return send({
    to,
    subject: 'Your SuperLoopz password has been updated',
    html: layout(
      'Your password has been updated',
      `<p>This is a confirmation that the password for your SuperLoopz account (<strong>${to}</strong>) was just changed.</p>
       <p>If you did not make this change, contact support immediately.</p>`,
    ),
  });
}

// ---- 3. Onboarding complete -----------------------------------------------
export function sendOnboardingComplete({ to }) {
  const dashboardUrl = `${config.appBaseUrl}/dashboard`;
  return send({
    to,
    subject: 'Welcome to SuperLoopz — you are all set',
    html: layout(
      'Welcome to SuperLoopz',
      `<p>Your onboarding is complete and your vendor account is ready.</p>
       <p>${button(dashboardUrl, 'Go to your dashboard')}</p>`,
    ),
  });
}

// ---- 4. Document verification approved ------------------------------------
export function sendDocumentApproved({ to, docType }) {
  return send({
    to,
    subject: 'Your documents have been verified',
    html: layout(
      'Documents verified',
      `<p>Good news — your <strong>${docType}</strong> document has been reviewed and verified by our team.</p>`,
    ),
  });
}

// ---- 5. Document verification rejected ------------------------------------
export function sendDocumentRejected({ to, docType, reason }) {
  const legalUrl = `${config.appBaseUrl}/onboarding/legal`;
  return send({
    to,
    subject: 'Action required — document resubmission needed',
    html: layout(
      'Document resubmission needed',
      `<p>Your <strong>${docType}</strong> document could not be verified and needs to be resubmitted.</p>
       ${reason ? `<p style="background:#FEF2F2;border:1px solid #FECACA;padding:12px;border-radius:8px"><strong>Reason:</strong> ${reason}</p>` : ''}
       <p>${button(legalUrl, 'Resubmit document')}</p>`,
    ),
  });
}
