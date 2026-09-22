import * as Yup from 'yup'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDateTime, toNumber } from '@/lib/utils'
import type { LookupContext, LookupKey, SelectChoice } from '@/features/resource/field-types'

/** Choices shared by every resource with the generic active/inactive status. */
export const ACTIVE_CHOICES: SelectChoice[] = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
]

/** The API validates cuids with this pattern. */
export const CUID = /^[cC][0-9a-z]{6,}$/
export const cuidField = (message: string) =>
  Yup.string().trim().matches(CUID, 'Select a valid record').required(message)

export const statusField = Yup.string().oneOf(['active', 'inactive']).required('Status is required')

export const requiredText = (label: string, max = 191) =>
  Yup.string().trim().max(max, `${label} is too long`).required(`${label} is required`)

export const optionalText = (max = 191) => Yup.string().trim().max(max)

export const decimalField = (label: string) =>
  Yup.number()
    .typeError(`${label} must be a number`)
    .min(0, `${label} cannot be negative`)
    .required(`${label} is required`)

export const intField = (label: string) =>
  Yup.number()
    .typeError(`${label} must be a number`)
    .integer(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`)
    .required(`${label} is required`)

export const requiredDate = (label: string) => Yup.string().required(`${label} is required`)

/* ------------------------------------------------------------------ *
 * Datetime conversion
 *
 * <input type="datetime-local"> speaks "YYYY-MM-DDTHH:mm" in local time,
 * while the API requires a full ISO-8601 UTC string. These convert both ways.
 * ------------------------------------------------------------------ */

export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  // Shift by the timezone offset so the picker shows local wall-clock time.
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function localInputToIso(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/* --------------------------- Cell renderers --------------------------- */

export const text = (value: unknown) =>
  value === null || value === undefined || value === '' ? (
    <span className="text-muted-foreground">--</span>
  ) : (
    String(value)
  )

export const muted = (value: unknown) => (
  <span className="text-muted-foreground">{value ? String(value) : '--'}</span>
)

export const mono = (value: unknown) => (
  <span className="font-mono text-xs">{value ? String(value) : '--'}</span>
)

export const status = (value: unknown) => <StatusBadge status={value as string} />

export const dateTime = (value: unknown) => (
  <span className="whitespace-nowrap text-muted-foreground">
    {formatDateTime(value as string)}
  </span>
)

export const number = (value: unknown) => (
  <span className="tabular-nums">{toNumber(value as string).toLocaleString()}</span>
)

/** Resolve a foreign key to its human label via the loaded lookups. */
export const lookupCell =
  (key: LookupKey) =>
  (id: unknown, ctx: LookupContext) => {
    if (!id) return <span className="text-muted-foreground">--</span>
    const label = ctx[key].get(String(id))
    return label ? (
      <span className="truncate">{label}</span>
    ) : (
      // The record exists but is outside the 100-row lookup page.
      <span className="font-mono text-xs text-muted-foreground">{String(id).slice(-8)}</span>
    )
  }

export const boolCell = (value: unknown) => (
  <span className={value ? 'text-primary' : 'text-muted-foreground'}>{value ? 'Yes' : 'No'}</span>
)

/** Form values use strings; the API wants a real boolean. */
export const toBool = (value: unknown) => value === true || value === 'true'
