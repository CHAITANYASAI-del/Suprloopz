// Sanity-check the validators against known-good / known-bad values.
import { docNumberError, phoneError, pinError, emailError, urlError, pastDateError, companyNameError, regNumberError } from '../src/lib/validators.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; } else { fail++; console.log('  ✗', label); } };
const valid = (fn, label) => ok(fn === '', `${label} → should be VALID but got: "${fn}"`);
const invalid = (fn, label) => ok(fn !== '', `${label} → should be INVALID but passed`);

// PAN
valid(docNumberError('PAN', 'ABCDE1234F'), 'PAN ABCDE1234F');
invalid(docNumberError('PAN', 'ABCD1234F'), 'PAN too short');
invalid(docNumberError('PAN', '12345ABCDF'), 'PAN wrong shape');
// GSTIN
valid(docNumberError('GST', '22ABCDE1234F1Z5'), 'GSTIN 22ABCDE1234F1Z5');
valid(docNumberError('GST', '29AAGCB1286Q1ZL'), 'GSTIN real-ish');
invalid(docNumberError('GST', 'ABCDE1234F'), 'GSTIN given a PAN');
invalid(docNumberError('GST', '22ABCDE1234F1A5'), 'GSTIN missing Z');
// CIN
valid(docNumberError('CIN', 'U72200KA2020PTC123456'), 'CIN U72200KA2020PTC123456');
invalid(docNumberError('CIN', 'X72200KA2020PTC123456'), 'CIN bad prefix');
invalid(docNumberError('CIN', 'U72200KA2020PTC12345'), 'CIN short');
// Phone (India)
valid(phoneError('+91', '9876543210'), 'phone 9876543210');
invalid(phoneError('+91', '1234567890'), 'phone starts 1');
invalid(phoneError('+91', '98765'), 'phone short');
invalid(phoneError('+91', '98765432101'), 'phone long');
// PIN
valid(pinError('India', '560001'), 'PIN 560001');
invalid(pinError('India', '060001'), 'PIN leading 0');
invalid(pinError('India', '12345'), 'PIN short');
// Email / URL / date
valid(emailError('a@b.com'), 'email a@b.com');
invalid(emailError('not-an-email'), 'email bad');
valid(urlError('https://suprloopz.com'), 'url https');
invalid(urlError('suprloopz'), 'url bare');
valid(urlError(''), 'url empty (optional)');
invalid(pastDateError('2999-01-01'), 'date future');
valid(pastDateError('2020-01-01'), 'date past');
// Company name / registration number
valid(companyNameError('Acme Pvt Ltd', 'Legal entity name'), 'company Acme Pvt Ltd');
valid(companyNameError("O'Brien & Co.", 'Legal entity name'), 'company O\'Brien & Co.');
invalid(companyNameError('@@@', 'Legal entity name'), 'company symbols only');
invalid(companyNameError('A', 'Legal entity name'), 'company too short');
valid(companyNameError('', 'Trade name', { required: false }), 'trade name optional empty');
valid(regNumberError('U72200KA2020'), 'reg alnum');
invalid(regNumberError('sfmfnb;bzfgjnkff'), 'reg with semicolon');
valid(regNumberError('', { required: false }), 'reg optional empty');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
