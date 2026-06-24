'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/db';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { COUNTRY_CODES } from '@/lib/options';
import { nameError, phoneError, digitsOnly, MAXLEN } from '@/lib/validators';

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', countryCode: '+91', phone: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  // Phone: keep only digits; cap at 10 for Indian numbers.
  const setPhone = (e) => {
    const max = form.countryCode === '+91' ? MAXLEN.phoneIN : 15;
    setForm((f) => ({ ...f, phone: digitsOnly(e.target.value).slice(0, max) }));
  };

  const validate = () => {
    const e = {};
    const fn = nameError(form.firstName, 'First name');
    if (fn) e.firstName = fn;
    const ln = nameError(form.lastName, 'Last name');
    if (ln) e.lastName = ln;
    const ph = phoneError(form.countryCode, form.phone);
    if (ph) e.phone = ph;
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
      await db.saveProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: `${form.countryCode} ${form.phone.trim()}`,
      });
      router.push('/vendor/onboarding/company');
    } catch (err) {
      setFormError(err.message || 'Could not save your profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
        <CardDescription>Tell us who you are.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName" error={errors.firstName} required>
              <Input id="firstName" value={form.firstName} onChange={set('firstName')} aria-invalid={!!errors.firstName} />
            </Field>
            <Field label="Last name" htmlFor="lastName" error={errors.lastName} required>
              <Input id="lastName" value={form.lastName} onChange={set('lastName')} aria-invalid={!!errors.lastName} />
            </Field>
          </div>

          <Field label="Mobile number" error={errors.phone} required>
            <div className="flex gap-2">
              <div className="w-40 shrink-0">
                <Select value={form.countryCode} onValueChange={set('countryCode')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c) => (
                      <SelectItem key={c.iso} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                inputMode="numeric"
                placeholder="9876543210"
                value={form.phone}
                onChange={setPhone}
                maxLength={form.countryCode === '+91' ? MAXLEN.phoneIN : 15}
                aria-invalid={!!errors.phone}
              />
            </div>
          </Field>

          <div className="flex justify-end pt-2">
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
