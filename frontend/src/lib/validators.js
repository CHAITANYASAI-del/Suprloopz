// Shared, India-aware form validators. Each `*Error` returns an error string, or
// '' when valid. Patterns follow the official government formats.

const trim = (v) => String(v ?? '').trim();
export const upper = (v) => String(v ?? '').toUpperCase().replace(/\s+/g, '');
export const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '');

// Official formats
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/; //                     ABCDE1234F
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/; // 22ABCDE1234F1Z5
export const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/; //     U72200KA2020PTC123456
export const PIN_RE = /^[1-9][0-9]{5}$/; //                            6 digits, no leading 0
export const PHONE_IN_RE = /^[6-9][0-9]{9}$/; //                       10 digits, starts 6–9
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,59}$/; //                     letters + spaces/.'-
const PLACE_RE = /^[A-Za-z][A-Za-z .'-]{1,59}$/;

// Max input lengths (used to cap typing)
export const MAXLEN = { GST: 15, PAN: 10, CIN: 21, phoneIN: 10, pinIN: 6 };

export function nameError(v, label = 'Name') {
  const val = trim(v);
  if (!val) return `${label} is required`;
  if (!NAME_RE.test(val)) return `${label} can only contain letters`;
  return '';
}

export function requiredText(v, label, min = 2) {
  const val = trim(v);
  if (!val) return `${label} is required`;
  if (val.length < min) return `${label} is too short`;
  return '';
}

// Company / trade names: letters, digits, spaces and common business punctuation.
// Must start with a letter or digit and contain at least one letter.
const COMPANY_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 &.,'()/-]{1,99}$/;
export function companyNameError(v, label = 'Name', { required = true } = {}) {
  const val = trim(v);
  if (!val) return required ? `${label} is required` : '';
  if (val.length < 2) return `${label} is too short`;
  if (!/[A-Za-z]/.test(val)) return `${label} must contain letters`;
  if (!COMPANY_NAME_RE.test(val)) return `${label} contains invalid characters`;
  return '';
}

// Registration number: alphanumeric with - / and spaces only.
export function regNumberError(v, { required = false } = {}) {
  const val = trim(v);
  if (!val) return required ? 'Registration number is required' : '';
  if (!/^[A-Za-z0-9 /-]{3,30}$/.test(val)) return 'Use letters, digits, spaces, - or / only';
  return '';
}

export function placeError(v, label) {
  const val = trim(v);
  if (!val) return `${label} is required`;
  if (!PLACE_RE.test(val)) return `Enter a valid ${label.toLowerCase()}`;
  return '';
}

export function emailError(v, required = false) {
  const val = trim(v);
  if (!val) return required ? 'Email is required' : '';
  return EMAIL_RE.test(val) ? '' : 'Enter a valid email address';
}

export function urlError(v) {
  const val = trim(v);
  if (!val) return ''; // optional
  return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(val) ? '' : 'Enter a valid URL (https://example.com)';
}

export function phoneError(countryCode, v) {
  const d = digitsOnly(v);
  if (!d) return 'Mobile number is required';
  if (countryCode === '+91') return PHONE_IN_RE.test(d) ? '' : 'Enter a valid 10-digit mobile number (starts 6–9)';
  return d.length >= 6 && d.length <= 15 ? '' : 'Enter a valid phone number';
}

export function pinError(country, v) {
  const val = trim(v);
  if (!val) return 'Postal code is required';
  if (country === 'India') return PIN_RE.test(val) ? '' : 'Enter a valid 6-digit PIN code';
  return /^[A-Za-z0-9 -]{3,10}$/.test(val) ? '' : 'Enter a valid postal code';
}

// Statutory document number, validated against its type.
export function docNumberError(type, v) {
  const val = upper(v);
  if (!val) return `${type} number is required`;
  if (type === 'GST') return GSTIN_RE.test(val) ? '' : 'Enter a valid 15-character GSTIN (e.g. 22ABCDE1234F1Z5)';
  if (type === 'PAN') return PAN_RE.test(val) ? '' : 'Enter a valid PAN (e.g. ABCDE1234F)';
  if (type === 'CIN') return CIN_RE.test(val) ? '' : 'Enter a valid 21-character CIN';
  return val ? '' : 'Required';
}

// Date of incorporation: required-optional, but must be a real past date.
export function pastDateError(v, { required = false } = {}) {
  const val = trim(v);
  if (!val) return required ? 'Date is required' : '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return 'Enter a valid date';
  if (d > new Date()) return 'Date cannot be in the future';
  return '';
}
