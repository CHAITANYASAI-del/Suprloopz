'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileDropzone } from '@/components/FileDropzone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DOC_TYPES = [
  { type: 'GST', title: 'GST', nameLabel: 'Name on GST', numberLabel: 'GST number' },
  { type: 'PAN', title: 'PAN', nameLabel: 'Name on PAN', numberLabel: 'PAN number' },
  { type: 'CIN', title: 'CIN', nameLabel: 'Name on CIN', numberLabel: 'CIN number' },
];

const blank = () => ({ docName: '', docNumber: '', fileKey: '', uploading: false, error: '' });

export default function LegalPage() {
  const router = useRouter();
  const [docs, setDocs] = useState({ GST: blank(), PAN: blank(), CIN: blank() });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (type, patch) => setDocs((d) => ({ ...d, [type]: { ...d[type], ...patch } }));

  const handleFile = async (type, file) => {
    if (!file) return update(type, { fileKey: '', error: '' });
    update(type, { uploading: true, error: '' });
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', type);
      const res = await api.uploadLegal(fd);
      update(type, { fileKey: res.fileKey, uploading: false });
    } catch (err) {
      update(type, { uploading: false, fileKey: '', error: err.message || 'Upload failed' });
    }
  };

  const validate = () => {
    const e = {};
    for (const { type } of DOC_TYPES) {
      const d = docs[type];
      if (!d.docName.trim()) e[`${type}.docName`] = 'Required';
      if (!d.docNumber.trim()) e[`${type}.docNumber`] = 'Required';
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
      await api.saveLegal({
        documents: DOC_TYPES.map(({ type }) => ({
          docType: type,
          docName: docs[type].docName.trim(),
          docNumber: docs[type].docNumber.trim(),
          fileKey: docs[type].fileKey,
        })),
      });
      router.push('/onboarding/address');
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError('Could not save your documents.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Legal information</CardTitle>
        <CardDescription>
          Upload your statutory documents. Stored securely on-premise — access is via signed links only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {DOC_TYPES.map(({ type, title, nameLabel, numberLabel }) => (
            <div key={type} className="rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-semibold">{title} details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={nameLabel} error={errors[`${type}.docName`]} required>
                  <Input
                    value={docs[type].docName}
                    onChange={(e) => update(type, { docName: e.target.value })}
                    aria-invalid={!!errors[`${type}.docName`]}
                  />
                </Field>
                <Field label={numberLabel} error={errors[`${type}.docNumber`]} required>
                  <Input
                    value={docs[type].docNumber}
                    onChange={(e) => update(type, { docNumber: e.target.value })}
                    aria-invalid={!!errors[`${type}.docNumber`]}
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Field label={`${title} certificate`} required>
                  <FileDropzone
                    onFile={(file) => handleFile(type, file)}
                    uploading={docs[type].uploading}
                    uploaded={!!docs[type].fileKey}
                    error={docs[type].error || errors[`${type}.file`]}
                  />
                </Field>
              </div>
            </div>
          ))}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.push('/onboarding/company')}>
              Back
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Saving…' : 'Continue'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
