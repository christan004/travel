import * as Yup from 'yup'
import { Badge } from '@/components/ui/badge'
import type { ResourceConfig } from '@/features/resource/field-types'
import {
  ACTIVE_CHOICES,
  mono,
  muted,
  optionalText,
  requiredText,
  status,
  statusField,
} from '@/features/resource/shared'
import type { Branch, CompanyAccount } from '@/types/entities'

/* ------------------------------- Branches ------------------------------- */

/**
 * NOTE: `name` is NOT part of the original OpenAPI spec - the API identified
 * a branch by `branchNumber` alone. It is sent on create and update, so the
 * backend needs a matching column, schema field and serializer entry before
 * the value will persist (see docs/backend-branch-name.md).
 *
 * Until then the UI degrades gracefully: the table falls back to the branch
 * number when no name comes back.
 */
export const branchesConfig: ResourceConfig<Branch> = {
  label: 'Branch',
  labelPlural: 'Branches',
  description: 'Offices and sales points in your network.',
  permission: 'branches',
  statusChoices: ACTIVE_CHOICES,
  searchFields: ['name', 'branchNumber', 'email', 'phone'],
  columns: [
    {
      id: 'branch',
      header: 'Branch',
      cell: (row) => (
        <div className="min-w-0">
          {/* Fall back to the number while the backend lacks a name column. */}
          <p className="truncate text-sm font-medium text-foreground">
            {row.name?.trim() || row.branchNumber}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.name?.trim() ? `${row.branchNumber} · ${row.email}` : row.email}
          </p>
        </div>
      ),
    },
    { id: 'phone', header: 'Phone', cell: (row) => muted(row.phone) },
    { id: 'support', header: 'Support phone', cell: (row) => muted(row.supportingPhone) },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => <Badge variant="neutral">{row.type}</Badge>,
    },
    { id: 'status', header: 'Status', cell: (row) => status(row.status) },
  ],
  fields: [
    // Full width and first: the name is what people actually recognise.
    {
      name: 'name',
      label: 'Branch name',
      kind: 'text',
      required: true,
      placeholder: 'Nyabugogo Office',
      hint: 'How this branch is referred to day to day.',
    },
    { name: 'branchNumber', label: 'Branch number', kind: 'text', required: true, half: true, placeholder: 'BR-001' },
    { name: 'type', label: 'Type', kind: 'text', required: true, half: true, placeholder: 'branch' },
    { name: 'email', label: 'Email', kind: 'email', required: true, half: true },
    { name: 'phone', label: 'Phone', kind: 'text', required: true, half: true },
    { name: 'supportingPhone', label: 'Support phone', kind: 'text', half: true },
    { name: 'phoneNumber', label: 'Phone label', kind: 'text', required: true, half: true, placeholder: 'BR-PHONE-01' },
    { name: 'status', label: 'Status', kind: 'select', choices: ACTIVE_CHOICES, required: true, half: true },
  ],
  validation: Yup.object({
    name: requiredText('Branch name'),
    branchNumber: requiredText('Branch number'),
    type: requiredText('Type'),
    email: Yup.string().trim().email('Enter a valid email address').required('Email is required'),
    phone: requiredText('Phone'),
    supportingPhone: optionalText(),
    phoneNumber: requiredText('Phone label'),
    status: statusField,
  }),
  emptyValues: {
    name: '', branchNumber: '', type: 'branch', email: '', phone: '',
    supportingPhone: '', phoneNumber: '', status: 'active',
  },
  toFormValues: (row) => ({
    name: row.name ?? '',
    branchNumber: row.branchNumber,
    type: row.type,
    email: row.email,
    phone: row.phone,
    supportingPhone: row.supportingPhone ?? '',
    phoneNumber: row.phoneNumber,
    status: row.status,
  }),
  toPayload: (v) => ({
    name: String(v.name).trim(),
    branchNumber: String(v.branchNumber).trim(),
    type: String(v.type).trim(),
    email: String(v.email).trim(),
    phone: String(v.phone).trim(),
    supportingPhone: v.supportingPhone ? String(v.supportingPhone).trim() : null,
    phoneNumber: String(v.phoneNumber).trim(),
    status: v.status,
  }),
}

/* --------------------------- Company accounts --------------------------- */

/**
 * NOTE: the spec exposes no DELETE for company accounts - only GET, POST and
 * PATCH, plus PATCH /:id/status. The page therefore offers edit but the API
 * will reject a delete; the permission gate normally hides it anyway.
 */
export const companyAccountsConfig: ResourceConfig<CompanyAccount> = {
  label: 'Account',
  labelPlural: 'Company accounts',
  description: 'Cash and bank accounts money is recorded against.',
  permission: 'company_accounts',
  statusChoices: ACTIVE_CHOICES,
  searchFields: ['code', 'name'],
  columns: [
    { id: 'code', header: 'Code', cell: (row) => mono(row.code) },
    { id: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name}</span> },
    { id: 'status', header: 'Status', cell: (row) => status(row.status ?? 'active') },
  ],
  fields: [
    { name: 'code', label: 'Code', kind: 'text', required: true, half: true, placeholder: 'CASH-001' },
    { name: 'name', label: 'Name', kind: 'text', required: true, half: true, placeholder: 'Main Cash Account' },
  ],
  validation: Yup.object({ code: requiredText('Code'), name: requiredText('Name') }),
  emptyValues: { code: '', name: '' },
  toFormValues: (row) => ({ code: row.code, name: row.name }),
  toPayload: (v) => ({ code: String(v.code).trim(), name: String(v.name).trim() }),
}
