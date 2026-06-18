// Centralised Zod schemas for input validation + sanitization.
import { z } from 'zod';

const trimmed = z.string().transform((s) => s.trim());
const nonEmpty = (label) => trimmed.pipe(z.string().min(1, `${label} is required`));
const email = trimmed.pipe(z.string().email('A valid email is required'));

// Password policy mirrors Keycloak: >=12 chars, 1 digit, 1 special char.
const strongPassword = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const resetPasswordSchema = z
  .object({
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const inviteSchema = z.object({
  email,
});

export const profileSchema = z.object({
  firstName: nonEmpty('First name'),
  lastName: nonEmpty('Last name'),
  phone: trimmed.pipe(z.string().min(6, 'A valid phone number is required').max(20)),
});

export const companySchema = z.object({
  legalName: nonEmpty('Legal entity name'),
  tradeName: trimmed.optional().default(''),
  registrationNumber: trimmed.optional().default(''),
  incorporationDate: trimmed
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'))
    .optional()
    .or(z.literal('')),
  industry: trimmed.optional().default(''),
  vendorType: trimmed.optional().default(''),
  vendorCategory: trimmed.optional().default(''),
  yearsInBusiness: trimmed.optional().default(''),
  numberOfEmployees: trimmed.optional().default(''),
  annualTurnover: trimmed.optional().default(''),
  website: trimmed.optional().default(''),
  companyEmail: trimmed.optional().default(''),
  companySpeciality: trimmed.optional().default(''),
});

const docTypeEnum = z.enum(['GST', 'PAN', 'CIN']);

export const legalSaveSchema = z.object({
  documents: z
    .array(
      z.object({
        docType: docTypeEnum,
        docName: nonEmpty('Name on document'),
        docNumber: nonEmpty('Document number'),
        fileKey: nonEmpty('File key'),
      }),
    )
    .min(1, 'At least one document is required'),
});

const oneAddress = z.object({
  streetAddress: nonEmpty('Street address'),
  city: nonEmpty('City'),
  state: nonEmpty('State'),
  postalCode: nonEmpty('Postal code'),
  country: nonEmpty('Country'),
});

export const addressSchema = z.object({
  registered: oneAddress,
  sameAsBilling: z.boolean().optional().default(false),
  billing: oneAddress.optional(),
  shipping: oneAddress.optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended']),
});

export const rejectSchema = z.object({
  reason: nonEmpty('Rejection reason'),
});

export const vendorListQuery = z.object({
  status: z.enum(['pending', 'active', 'suspended']).optional(),
  search: trimmed.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
