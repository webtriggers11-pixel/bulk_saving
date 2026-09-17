import type { CreateVendorBody, UpdateVendorBody } from '@bulk/shared';

/** Raw (untrimmed) vendor form values, as typed. */
export interface VendorFormValues {
  name: string;
  phone: string;
  category: string;
  notes: string;
}

export type VendorFormErrors = Partial<Record<keyof VendorFormValues, string>>;

export const EMPTY_VENDOR_FORM: VendorFormValues = { name: '', phone: '', category: '', notes: '' };

/** Mirrors the backend vendor DTO rules: name 1–100 chars; phone 8–15 digits, optional leading +. */
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const NAME_MAX = 100;

/** Client-side validation; returns an empty object when the form is valid. */
export function validateVendorForm(values: VendorFormValues): VendorFormErrors {
  const errors: VendorFormErrors = {};
  const name = values.name.trim();
  if (name.length === 0) {
    errors.name = 'Name is required.';
  } else if (name.length > NAME_MAX) {
    errors.name = `Name must be at most ${NAME_MAX} characters.`;
  }
  if (!PHONE_PATTERN.test(values.phone.trim())) {
    errors.phone = 'Phone must be 8–15 digits, optionally starting with +.';
  }
  return errors;
}

/** Trimmed create body; empty optional fields are omitted. */
export function toCreateVendorBody(values: VendorFormValues): CreateVendorBody {
  const body: CreateVendorBody = { name: values.name.trim(), phone: values.phone.trim() };
  const category = values.category.trim();
  const notes = values.notes.trim();
  if (category) {
    body.category = category;
  }
  if (notes) {
    body.notes = notes;
  }
  return body;
}

/** Trimmed update body; an emptied optional field is cleared with null. */
export function toUpdateVendorBody(values: VendorFormValues): UpdateVendorBody {
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    category: values.category.trim() || null,
    notes: values.notes.trim() || null,
  };
}
