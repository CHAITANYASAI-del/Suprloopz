'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/db';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES } from '@/lib/options';
import { requiredText, placeError, pinError, digitsOnly, MAXLEN } from '@/lib/validators';

const blank = () => ({ streetAddress: '', city: '', state: '', postalCode: '', country: 'India' });

function AddressFields({ value, onChange, errors = {}, prefix }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e?.target ? e.target.value : e });
  // Indian PIN codes are 6 digits — keep digits only and cap the length.
  const setPostal = (e) => {
    const raw = e.target.value;
    const next = value.country === 'India' ? digitsOnly(raw).slice(0, MAXLEN.pinIN) : raw.slice(0, 12);
    onChange({ ...value, postalCode: next });
  };
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Street address" error={errors[`${prefix}.streetAddress`]} required className="sm:col-span-2">
        <Input value={value.streetAddress} onChange={set('streetAddress')} aria-invalid={!!errors[`${prefix}.streetAddress`]} />
      </Field>
      <Field label="City" error={errors[`${prefix}.city`]} required>
        <Input value={value.city} onChange={set('city')} aria-invalid={!!errors[`${prefix}.city`]} />
      </Field>
      <Field label="State" error={errors[`${prefix}.state`]} required>
        <Input value={value.state} onChange={set('state')} aria-invalid={!!errors[`${prefix}.state`]} />
      </Field>
      <Field label="Postal code" error={errors[`${prefix}.postalCode`]} required>
        <Input
          value={value.postalCode}
          onChange={setPostal}
          inputMode={value.country === 'India' ? 'numeric' : 'text'}
          maxLength={value.country === 'India' ? MAXLEN.pinIN : 12}
          placeholder={value.country === 'India' ? '560001' : ''}
          aria-invalid={!!errors[`${prefix}.postalCode`]}
        />
      </Field>
      <Field label="Country" error={errors[`${prefix}.country`]} required>
        <Select value={value.country} onValueChange={set('country')}>
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

export default function AddressPage() {
  const router = useRouter();
  const [registered, setRegistered] = useState(blank());
  const [billing, setBilling] = useState(blank());
  const [shipping, setShipping] = useState(blank());
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateAddress = (a, prefix, e) => {
    const s = requiredText(a.streetAddress, 'Street address', 3);
    if (s) e[`${prefix}.streetAddress`] = s;
    const c = placeError(a.city, 'City');
    if (c) e[`${prefix}.city`] = c;
    const st = placeError(a.state, 'State');
    if (st) e[`${prefix}.state`] = st;
    const p = pinError(a.country, a.postalCode);
    if (p) e[`${prefix}.postalCode`] = p;
    if (!String(a.country || '').trim()) e[`${prefix}.country`] = 'Country is required';
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const v = {};
    validateAddress(registered, 'registered', v);
    if (!sameAsBilling) validateAddress(billing, 'billing', v);
    validateAddress(shipping, 'shipping', v);
    setErrors(v);
    if (Object.keys(v).length) return;

    setLoading(true);
    try {
      await db.saveAddress({ registered, sameAsBilling, billing: sameAsBilling ? undefined : billing, shipping });
      router.push('/vendor/dashboard');
    } catch (err) {
      setFormError(err.message || 'Could not save your addresses.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Address information</CardTitle>
        <CardDescription>Where is your business registered and where do you operate?</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold">Registered address</h3>
            <AddressFields value={registered} onChange={setRegistered} errors={errors} prefix="registered" />
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Billing address</h3>
            <div className="mb-3 flex items-center gap-2">
              <Checkbox
                id="sameAsBilling"
                checked={sameAsBilling}
                onCheckedChange={(c) => setSameAsBilling(!!c)}
              />
              <Label htmlFor="sameAsBilling" className="cursor-pointer font-normal">
                Same as registered address
              </Label>
            </div>
            {!sameAsBilling && (
              <AddressFields value={billing} onChange={setBilling} errors={errors} prefix="billing" />
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Shipping address</h3>
            <AddressFields value={shipping} onChange={setShipping} errors={errors} prefix="shipping" />
          </section>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.push('/vendor/onboarding/legal')}>
              Back
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Finishing…' : 'Complete onboarding'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
