'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES } from '@/lib/options';

const blank = () => ({ streetAddress: '', city: '', state: '', postalCode: '', country: 'India' });

function AddressFields({ value, onChange, errors = {}, prefix }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e?.target ? e.target.value : e });
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
        <Input value={value.postalCode} onChange={set('postalCode')} aria-invalid={!!errors[`${prefix}.postalCode`]} />
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
    for (const k of ['streetAddress', 'city', 'state', 'postalCode', 'country']) {
      if (!String(a[k] || '').trim()) e[`${prefix}.${k}`] = 'Required';
    }
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
      const idempotencyKey =
        (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
        `addr-${Date.now()}`;
      await api.saveAddress(
        { registered, sameAsBilling, billing: sameAsBilling ? undefined : billing, shipping },
        idempotencyKey,
      );
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError('Could not save your addresses.');
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
            <Button type="button" variant="outline" onClick={() => router.push('/onboarding/legal')}>
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
