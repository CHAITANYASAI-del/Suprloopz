// Server-only verification provider selector. Pick the active KYB provider via
// VERIFY_PROVIDER (surepass | cashfree). Each provider module exposes a VERIFIERS
// map { GST, PAN, CIN } returning the common shape { valid, name, status, message }.
import * as surepass from './surepass';
import * as cashfree from './cashfree';

const PROVIDERS = { surepass, cashfree };

export function getVerifiers() {
  const name = (process.env.VERIFY_PROVIDER || 'surepass').toLowerCase();
  return (PROVIDERS[name] || surepass).VERIFIERS;
}
