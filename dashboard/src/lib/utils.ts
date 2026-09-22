import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The API returns Prisma Decimal columns as strings ("3500.00") to avoid
 * float precision loss. Parse defensively: a bad value formats as 0 rather
 * than rendering "NaN" in a table cell.
 */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Format a money amount. The API's default currency is RWF. */
export function formatCurrency(
  value: string | number | null | undefined,
  currency = 'RWF',
): string {
  const amount = toNumber(value)
  try {
    // 'code' rather than the symbol: Intl renders RWF as "RF", which is
    // ambiguous in an admin tool. The ISO code is unmistakable.
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    // Unknown currency code from the API - fall back to a plain number.
    return `${currency} ${amount.toLocaleString()}`
  }
}

/** Compact number for KPI tiles: 12400 -> "12.4K". */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/**
 * The API's timestamps are WALL-CLOCK times, stored with a Z suffix.
 *
 * A trip departing "08:00" departs at 08:00 where the bus is - the zone is
 * not meaningful. Formatting in the browser's zone would show 10:00 to a
 * viewer in UTC+2 and 08:00 to one in UTC, for the same departure. Rendering
 * in UTC shows everyone the time that was actually entered.
 */
const WALL_CLOCK = 'UTC'

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '--'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: WALL_CLOCK,
  }).format(d)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '--'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: WALL_CLOCK,
  }).format(d)
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '--'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: WALL_CLOCK,
  }).format(d)
}

export function initials(...parts: Array<string | null | undefined>): string {
  const letters = parts.filter(Boolean).map((p) => p!.trim()[0]).filter(Boolean)
  return letters.slice(0, 2).join('').toUpperCase() || '?'
}

/** Minutes -> "2h 30m", for route durations. */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '--'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}
