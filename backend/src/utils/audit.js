// Writes an audit_logs row. Must be called with a client that already has the
// RLS context set (i.e. from inside withUserContext / withSystemContext), so
// the INSERT passes the audit_logs_insert policy.
export async function audit(client, { userId, action, metadata = {}, req }) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [
      userId ?? null,
      action,
      JSON.stringify(metadata),
      req?.ip ?? null,
      req?.headers?.['user-agent'] ?? null,
    ],
  );
}
