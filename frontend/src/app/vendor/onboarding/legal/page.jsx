'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/db';
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
      const path = await db.uploadLegal(type, file);
      update(type, { fileKey: path, uploading: false });
    } catch (err) {
      update(type, { uploading: false, fileKey: '', error: err.message || 'Upload failed' });
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

          {DOC_TYPES.map(({ type, title, nameLabel, numberLabel, placeholder }) => (
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
                <Field label={numberLabel} error={errors[`${type}.docNumber`]} required hint={`Format: ${placeholder}`}>
                  <Input
                    value={docs[type].docNumber}
                    placeholder={placeholder}
                    maxLength={MAXLEN[type]}
                    className="uppercase"
                    onChange={(e) => update(type, { docNumber: upper(e.target.value).slice(0, MAXLEN[type]) })}
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
            <Button type="button" variant="outline" onClick={() => router.push('/vendor/onboarding/company')}>
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
