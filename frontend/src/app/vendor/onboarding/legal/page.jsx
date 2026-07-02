'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Check, Lock } from 'lucide-react';
import { db } from '@/lib/db';
import { verifyDocument } from '@/lib/verifyApi';
import { extractDocNumber } from '@/lib/ocr';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileDropzone } from '@/components/FileDropzone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { docNumberError, requiredText, upper, MAXLEN } from '@/lib/validators';

const DOC_TYPES = [
  { type: 'GST', title: 'GST', nameLabel: 'Name on GST', numberLabel: 'GST number', placeholder: '22ABCDE1234F1Z5' },
  { type: 'PAN', title: 'PAN', nameLabel: 'Name on PAN', numberLabel: 'PAN number', placeholder: 'ABCDE1234F' },
  { type: 'CIN', title: 'CIN', nameLabel: 'Name on CIN', numberLabel: 'CIN number', placeholder: 'U72200KA2020PTC123456' },
];

const blank = () => ({
  docName: '', docNumber: '', fileKey: '', uploading: false, error: '',
  verified: false, verifying: false, verifiedName: '', verifyMsg: '',
  ocr: '', // '' | reading | done | failed
});

export default function LegalPage() {
  const router = useRouter();
  const [docs, setDocs] = useState({ GST: blank(), PAN: blank(), CIN: blank() });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(null); // null=loading, false=editable, array=submitted docs

  const update = (type, patch) => setDocs((d) => ({ ...d, [type]: { ...d[type], ...patch } }));

  // Once submitted, legal documents are locked (KYC). Otherwise prefill any partial data.
  useEffect(() => {
    Promise.all([db.onboarding(), db.getDocuments()])
      .then(([{ onboarding: o }, rows]) => {
        if (o?.legal_docs_completed && rows.length) {
          setLocked(rows);
          return;
        }
        setLocked(false);
        if (rows.length) {
          setDocs((prev) => {
            const next = { ...prev };
            for (const r of rows) {
              if (!next[r.doc_type]) continue;
              next[r.doc_type] = {
                ...next[r.doc_type],
                docName: r.doc_name || '', docNumber: r.doc_number || '', fileKey: r.file_path || '',
                verified: !!r.verified, verifiedName: r.verified ? r.doc_name || '' : '',
              };
            }
            return next;
          });
        }
      })
      .catch(() => setLocked(false));
  }, []);

  const handleFile = async (type, file) => {
    if (!file) return update(type, { fileKey: '', error: '', ocr: '' });
    update(type, { uploading: true, error: '' });
    try {
      const path = await db.uploadLegal(type, file);
      update(type, { fileKey: path, uploading: false, ocr: 'reading' });
      // Free in-browser OCR → auto-fill the number → auto-verify (best-effort).
      try {
        const num = await extractDocNumber(type, file);
        if (num) {
          update(type, { docNumber: num, ocr: 'done', verified: false, verifiedName: '', verifyMsg: '' });
          setErrors((er) => ({ ...er, [`${type}.docNumber`]: undefined }));
          await verify(type, num);
        } else {
          update(type, { ocr: 'failed' });
        }
      } catch {
        update(type, { ocr: 'failed' });
      }
    } catch (err) {
      update(type, { uploading: false, fileKey: '', error: err.message || 'Upload failed', ocr: '' });
    }
  };

  // Verify a number against the official registry (Surepass). `numberOverride` lets
  // the OCR auto-flow verify the extracted number without waiting on state.
  const verify = async (type, numberOverride) => {
    const d = docs[type];
    const number = numberOverride ?? d.docNumber;
    const fmt = docNumberError(type, number);
    if (fmt) {
      setErrors((er) => ({ ...er, [`${type}.docNumber`]: fmt }));
      return;
    }
    setErrors((er) => ({ ...er, [`${type}.docNumber`]: undefined }));
    update(type, { verifying: true, verifyMsg: '', verified: false, verifiedName: '' });
    try {
      const r = await verifyDocument(type, number, d.docName);
      if (r.valid) update(type, { verifying: false, verified: true, verifiedName: r.name || '' });
      else update(type, { verifying: false, verifyMsg: r.message || `This ${type} could not be verified` });
    } catch (e) {
      update(type, { verifying: false, verifyMsg: e.message || 'Verification failed. Please try again.' });
    }
  };

  const validate = () => {
    const e = {};
    for (const { type } of DOC_TYPES) {
      const d = docs[type];
      const nm = requiredText(d.docName, 'Name', 2);
      if (nm) e[`${type}.docName`] = nm;
      const num = docNumberError(type, d.docNumber);
      if (num) e[`${type}.docNumber`] = num;
      else if (!d.verified) e[`${type}.docNumber`] = `Click Verify to confirm this ${type}`;
      if (!d.fileKey) e[`${type}.file`] = 'Upload a document';
    }
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;

    setLoading(true);
    try {
      await db.saveLegal(
        DOC_TYPES.map(({ type }) => ({
          docType: type,
          docName: docs[type].docName.trim(),
          docNumber: docs[type].docNumber.trim(),
          filePath: docs[type].fileKey,
        })),
      );
      router.push('/vendor/onboarding/address');
    } catch (err) {
      setFormError(err.message || 'Could not save your documents.');
    } finally {
      setLoading(false);
    }
  };

  const allVerified = DOC_TYPES.every(({ type }) => docs[type].verified);

  if (locked === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Submitted → read-only. Changing a verified statutory document is admin-mediated.
  if (locked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" /> Legal documents
          </CardTitle>
          <CardDescription>
            Your statutory documents are submitted and locked. To change a verified document,
            contact the Suprloopz team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {locked.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">
                  {d.doc_type} · {d.doc_name}
                </p>
                <p className="text-xs text-muted-foreground">{d.doc_number}</p>
              </div>
              {d.verified ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                  <ShieldCheck className="h-4 w-4" /> Verified
                </span>
              ) : (
                <span className="text-xs font-medium text-amber-600">Under review</span>
              )}
            </div>
          ))}
          <div className="flex justify-between pt-2">
            <Button type="button" variant="outline" onClick={() => router.push('/vendor/onboarding/company')}>
              Back
            </Button>
            <Button type="button" onClick={() => router.push('/vendor/onboarding/address')}>
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Legal information</CardTitle>
        <CardDescription>
          Upload each certificate — we <strong>read the number automatically</strong> and verify it
          against the official registry. You can also type any number in manually.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {DOC_TYPES.map(({ type, title, nameLabel, numberLabel, placeholder }) => {
            const d = docs[type];
            return (
              <div key={type} className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">{title} details</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={nameLabel} error={errors[`${type}.docName`]} required>
                    <Input
                      value={d.docName}
                      onChange={(e) => update(type, { docName: e.target.value })}
                      aria-invalid={!!errors[`${type}.docName`]}
                    />
                  </Field>
                  <Field
                    label={numberLabel}
                    error={errors[`${type}.docNumber`]}
                    required
                    hint={!d.verified ? `Format: ${placeholder}` : undefined}
                  >
                    <div className="flex gap-2">
                      <Input
                        value={d.docNumber}
                        placeholder={placeholder}
                        maxLength={MAXLEN[type]}
                        className="uppercase"
                        onChange={(e) =>
                          update(type, {
                            docNumber: upper(e.target.value).slice(0, MAXLEN[type]),
                            verified: false, verifiedName: '', verifyMsg: '',
                          })
                        }
                        aria-invalid={!!errors[`${type}.docNumber`]}
                      />
                      <Button
                        type="button"
                        variant={d.verified ? 'outline' : 'default'}
                        className="shrink-0"
                        disabled={d.verifying || d.verified || !d.docNumber}
                        onClick={() => verify(type)}
                      >
                        {d.verifying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : d.verified ? (
                          <>
                            <Check className="h-4 w-4" /> Verified
                          </>
                        ) : (
                          'Verify'
                        )}
                      </Button>
                    </div>
                    {d.verified && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-green-700">
                        <ShieldCheck className="h-3.5 w-3.5" /> {d.verifiedName || 'Verified'}
                      </p>
                    )}
                    {!d.verified && d.verifyMsg && (
                      <p className="mt-1 text-xs font-medium text-destructive">{d.verifyMsg}</p>
                    )}
                  </Field>
                </div>
                <div className="mt-4">
                  <Field
                    label={`${title} certificate`}
                    required
                    hint="Upload the certificate — we'll read the number off it automatically."
                  >
                    <FileDropzone
                      onFile={(file) => handleFile(type, file)}
                      uploading={d.uploading}
                      uploaded={!!d.fileKey}
                      error={d.error || errors[`${type}.file`]}
                    />
                  </Field>
                  {d.ocr === 'reading' && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading document & verifying…
                    </p>
                  )}
                  {d.ocr === 'failed' && (
                    <p className="mt-1 text-xs text-amber-600">
                      Couldn&apos;t read the number automatically — please type it above.
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => router.push('/vendor/onboarding/company')}>
              Back
            </Button>
            <Button type="submit" disabled={loading || !allVerified}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Saving…' : 'Continue'}
            </Button>
          </div>
          {!allVerified && (
            <p className="text-right text-xs text-muted-foreground">Verify all three numbers to continue.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
