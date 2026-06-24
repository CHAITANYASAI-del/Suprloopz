'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/db';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  INDUSTRIES, VENDOR_TYPES, VENDOR_CATEGORIES, YEARS_IN_BUSINESS, EMPLOYEE_RANGES, TURNOVER_RANGES,
} from '@/lib/options';
import { companyNameError, regNumberError, emailError, urlError, pastDateError } from '@/lib/validators';

const initial = {
  legalName: '', tradeName: '', registrationNumber: '', incorporationDate: '',
  industry: '', companyEmail: '', vendorType: '', vendorCategory: '',
  yearsInBusiness: '', numberOfEmployees: '', annualTurnover: '', website: '', companySpeciality: '',
};

function SelectField({ label, value, onChange, options, placeholder, error }) {
  return (
    <Field label={label} error={error}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder || 'Select…'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export default function CompanyPage() {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const validate = () => {
    const e = {};
    const ln = companyNameError(form.legalName, 'Legal entity name');
    if (ln) e.legalName = ln;
    const tn = companyNameError(form.tradeName, 'Trade name', { required: false });
    if (tn) e.tradeName = tn;
    const reg = regNumberError(form.registrationNumber);
    if (reg) e.registrationNumber = reg;
    const em = emailError(form.companyEmail);
    if (em) e.companyEmail = em;
    const web = urlError(form.website);
    if (web) e.website = web;
    const inc = pastDateError(form.incorporationDate);
    if (inc) e.incorporationDate = inc;
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
      await db.saveCompany(form);
      router.push('/vendor/onboarding/legal');
    } catch (err) {
      setFormError(err.message || 'Could not save company information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company information</CardTitle>
        <CardDescription>Basic details about your business.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Legal entity name" htmlFor="legalName" error={errors.legalName} required className="sm:col-span-2">
              <Input id="legalName" value={form.legalName} onChange={set('legalName')} aria-invalid={!!errors.legalName} />
            </Field>
            <Field label="Trade name" htmlFor="tradeName" error={errors.tradeName}>
              <Input id="tradeName" value={form.tradeName} onChange={set('tradeName')} aria-invalid={!!errors.tradeName} />
            </Field>
            <Field label="Registration number" htmlFor="registrationNumber" error={errors.registrationNumber}>
              <Input id="registrationNumber" value={form.registrationNumber} onChange={set('registrationNumber')} aria-invalid={!!errors.registrationNumber} />
            </Field>
            <Field label="Date of incorporation" htmlFor="incorporationDate" error={errors.incorporationDate}>
              <Input id="incorporationDate" type="date" max={new Date().toISOString().slice(0, 10)}
                value={form.incorporationDate} onChange={set('incorporationDate')} aria-invalid={!!errors.incorporationDate} />
            </Field>
            <SelectField label="Industry" value={form.industry} onChange={set('industry')} options={INDUSTRIES} />
            <Field label="Company email" htmlFor="companyEmail" error={errors.companyEmail}>
              <Input id="companyEmail" type="email" value={form.companyEmail} onChange={set('companyEmail')} aria-invalid={!!errors.companyEmail} />
            </Field>
            <SelectField label="Vendor type" value={form.vendorType} onChange={set('vendorType')} options={VENDOR_TYPES} />
            <SelectField label="Vendor category" value={form.vendorCategory} onChange={set('vendorCategory')} options={VENDOR_CATEGORIES} />
            <SelectField label="Years in business" value={form.yearsInBusiness} onChange={set('yearsInBusiness')} options={YEARS_IN_BUSINESS} />
            <SelectField label="Number of employees" value={form.numberOfEmployees} onChange={set('numberOfEmployees')} options={EMPLOYEE_RANGES} />
            <SelectField label="Annual turnover" value={form.annualTurnover} onChange={set('annualTurnover')} options={TURNOVER_RANGES} />
            <Field label="Website" htmlFor="website" error={errors.website}>
              <Input id="website" placeholder="https://example.com" value={form.website} onChange={set('website')} aria-invalid={!!errors.website} />
            </Field>
          </div>

          <Field label="Company speciality" htmlFor="companySpeciality">
            <Textarea
              id="companySpeciality"
              placeholder="What does your company specialise in?"
              value={form.companySpeciality}
              onChange={set('companySpeciality')}
            />
          </Field>

          <div className="flex justify-between pt-2">
            <Button type="button" variant="outline" onClick={() => router.push('/vendor/onboarding/profile')}>
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
