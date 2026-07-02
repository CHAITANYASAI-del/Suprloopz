'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Lock, X, RefreshCw, Clock } from 'lucide-react';
import { db } from '@/lib/db';
import { verifyDocument } from '@/lib/verifyApi';
import { extractDocNumber } from '@/lib/ocr';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileDropzone } from '@/components/FileDropzone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { docNumberError, upper, MAXLEN } from '@/lib/validators';

const DOC_TYPES = [
  { type: 'GST', title: 'GST', placeholder: '22ABCDE1234F1Z5' },
  { type: 'PAN', title: 'PAN', placeholder: 'ABCDE1234F' },
  { type: 'CIN', title: 'CIN', placeholder: 'U72200KA2020PTC123456' },
];

const blank = () => ({
  docName: '', docNumber: '', fileKey: '', uploading: false, error: '',
  verified: false, verifying: false, verifiedName: '', verifyMsg: '', pending: false,
  ocr: '', manual: false,
});

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || '—'}</span>
    </div>
  );
}

export default function LegalPage() {
  const router = useRouter();
  const [docs, setDocs] = useState({ GST: blank(), PAN: blank(), CIN: blank() });
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(null); // null=loading, false=editable, array=submitted docs

  const update = (type, patch) => setDocs((d) => ({ ...d, [type]: { ...d[type], ...patch } }));
  const resetDoc = (type) => setDocs((d) => ({ ...d, [type]: blank() }));

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

  // Verify a number against the registry. Sets the card into verified / pending / failed.
  const verify = async (type, number) => {
    const fmt = docNumberError(type, number);
    if (fmt) return update(type, { verifying: false, verifyMsg: fmt });
    update(type, { verifying: true, verifyMsg: '', verified: false });
    try {
      const r = await verifyDocument(type, number, '');
      if (r.valid) {
        update(type, {
          verifying: false, verified: true, pending: !!r.dev,
          verifiedName: r.dev ? '' : r.name || '',
          docName: r.dev ? type : r.name || type,
          docNumber: number, manual: false,
        });
      } else {
        update(type, { verifying: false, verifyMsg: r.message || `This ${type} could not be verified` });
      }
    } catch (e) {
      update(type, { verifying: false, verifyMsg: e.message || 'Verification failed. Please try again.' });
    }
  };

  // Upload → OCR read the number → auto-verify. All from a single drop.
  const handleFile = async (type, file) => {
    if (!file) return resetDoc(type);
    update(type, { uploading: true, error: '', verifyMsg: '' });
    let path;
    try {
      path = await db.uploadLegal(type, file);
    } catch (err) {
      return update(type, { uploading: false, fileKey: '', error: err.message || 'Upload failed' });
    }
    update(type, { fileKey: path, uploading: false, ocr: 'reading' });
    try {
      const num = await extractDocNumber(type, file);
      if (num) {
        update(type, { docNumber: num, ocr: 'done' });
        await verify(type, num);
      } else {
        update(type, { ocr: 'failed', verifyMsg: "We couldn't read the number from this document." });
      }
    } catch {
      update(type, { ocr: 'failed', verifyMsg: "We couldn't read the number from this document." });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!DOC_TYPES.every(({ type }) => docs[type].verified)) return;
    setLoading(true);
    try {
      await db.saveLegal(
        DOC_TYPES.map(({ type }) => ({
          docType: type,
          docName: (docs[type].docName || type).trim(),
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
                <p className="font-medium">{d.doc_type} · {d.doc_name}</p>
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
            <Button type="button" variant="outline" onClick={() => router.push('/vendor/onboarding/company')}>Back</Button>
            <Button type="button" onClick={() => router.push('/vendor/onboarding/address')}>Continue</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Legal documents</CardTitle>
        <CardDescription>
          Just upload each certificate — we <strong>read the number automatically</strong> and verify it
          against the official registry where available. The rest are saved for our team to review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {DOC_TYPES.map(({ type, title, placeholder }) => {
            const d = docs[type];
            const busy = d.uploading || d.ocr === 'reading' || d.verifying;
            return (
              <div key={type} className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">{title} certificate</h3>

                {/* 1) Nothing yet → upload zone */}
                {!d.fileKey && !busy && (
                  <FileDropzone onFile={(file) => handleFile(type, file)} uploading={false} uploaded={false} error={d.error} />
                )}

                {/* 2) Working → processing card */}
                {busy && (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                    <span className="text-muted-foreground">
                      {d.uploading ? 'Uploading…' : d.ocr === 'reading' ? 'Reading document…' : 'Verifying with the registry…'}
                    </span>
                  </div>
                )}

                {/* 3) Verified → result card */}
                {!busy && d.verified && (
                  <div
                    className={
                      d.pending
                        ? 'rounded-lg border border-amber-200 bg-amber-50 p-4'
                        : 'rounded-lg border border-green-200 bg-green-50 p-4'
                    }
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`flex items-center gap-1.5 text-sm font-semibold ${d.pending ? 'text-amber-800' : 'text-green-800'}`}
                      >
                        {d.pending ? <Clock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        {d.pending ? `${title} uploaded` : `${title} verified`}
                      </span>
                      <button
                        type="button"
                        onClick={() => resetDoc(type)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Remove & upload a different file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {d.verifiedName && <Row label={`Name on ${title}`} value={d.verifiedName} />}
                    <Row label={`${title} number`} value={d.docNumber} />
                    <Row
                      label="Status"
                      value={
                        d.pending
                          ? <Badge variant="warning">Pending verification</Badge>
                          : <Badge variant="success">Verified</Badge>
                      }
                    />
                    {d.pending && (
                      <p className="mt-2 text-xs text-amber-700">
                        Saved. Our team will verify this against the official registry — you can continue.
                      </p>
                    )}
                  </div>
                )}

                {/* 4) Couldn't read/verify → retry / re-upload / manual */}
                {!busy && d.fileKey && !d.verified && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                    <p className="font-medium text-amber-800">Couldn&apos;t verify this {title}</p>
                    <p className="mt-1 text-amber-700">
                      {d.verifyMsg ||
                        "We couldn't read the number from this document. Upload a clearer copy, or enter it manually."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {d.docNumber && (
                        <Button type="button" size="sm" onClick={() => verify(type, d.docNumber)}>
                          <RefreshCw className="h-4 w-4" /> Try again
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={() => resetDoc(type)}>
                        Upload a different file
                      </Button>
                      {!d.manual && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => update(type, { manual: true })}>
                          Enter number manually
                        </Button>
                      )}
                    </div>
                    {d.manual && (
                      <div className="mt-3">
                        <Field label={`${title} number`} hint={`Format: ${placeholder}`}>
                          <div className="flex gap-2">
                            <Input
                              value={d.docNumber}
                              placeholder={placeholder}
                              maxLength={MAXLEN[type]}
                              className="uppercase"
                              onChange={(e) => update(type, { docNumber: upper(e.target.value).slice(0, MAXLEN[type]) })}
                            />
                            <Button type="button" className="shrink-0" disabled={!d.docNumber} onClick={() => verify(type, d.docNumber)}>
                              Verify
                            </Button>
                          </div>
                        </Field>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => router.push('/vendor/onboarding/company')}>Back</Button>
            <Button type="submit" disabled={loading || !allVerified}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Saving…' : 'Continue'}
            </Button>
          </div>
          {!allVerified && (
            <p className="text-right text-xs text-muted-foreground">Upload & verify all three documents to continue.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
