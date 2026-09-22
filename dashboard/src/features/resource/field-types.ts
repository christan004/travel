import type * as Yup from 'yup'
import type { ReactNode } from 'react'

/**
 * Declarative description of one resource, used to generate both its table
 * and its create/edit form. Keeps 16 CRUD screens as config rather than 16
 * hand-written near-identical components.
 */

export type FieldKind =
  | 'text'
  | 'number'
  | 'decimal'
  | 'email'
  | 'password'
  | 'datetime'
  | 'select'
  | 'lookup'
  | 'boolean'

export interface SelectChoice {
  label: string
  value: string
}

export interface FieldDef {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  hint?: string
  placeholder?: string
  /** Static options for kind 'select'. */
  choices?: SelectChoice[]
  /** Lookup resource key for kind 'lookup' (see LOOKUPS in ResourcePage). */
  lookup?: LookupKey
  /** Omit from the create form (e.g. server-assigned). */
  createOnly?: boolean
  editOnly?: boolean
  /** Half-width on desktop, so two fields share a row. */
  half?: boolean
}

/** Lookup sources available to 'lookup' fields. */
export type LookupKey =
  | 'locations'
  | 'routes'
  | 'trips'
  | 'cars'
  | 'drivers'
  | 'driverAssignments'
  | 'seats'
  | 'productTypes'
  | 'tickets'

export interface ColumnDef<T> {
  id: string
  header: string
  cell: (row: T, ctx: LookupContext) => ReactNode
  align?: 'left' | 'right'
}

/** Resolved id -> label maps, passed to cell renderers. */
export type LookupContext = Record<LookupKey, Map<string, string>>

export interface ResourceConfig<T> {
  /** Singular, for buttons and toasts: "Trip". */
  label: string
  /** Plural, for the page title: "Trips". */
  labelPlural: string
  description: string
  /** Permission prefix, e.g. 'trips' -> trips.read / trips.create. */
  permission: string
  columns: Array<ColumnDef<T>>
  fields: FieldDef[]
  validation: Yup.AnyObjectSchema
  /** Status values offered in the list filter; omitted hides the filter. */
  statusChoices?: SelectChoice[]
  /** Lookups this resource needs loaded. */
  lookups?: LookupKey[]
  /** Fields searched by the client-side box (the API has no search param). */
  searchFields?: Array<keyof T & string>
  /** Build form values from an existing record for editing. */
  toFormValues: (row: T) => Record<string, unknown>
  /** Build the API payload from form values. */
  toPayload: (values: Record<string, unknown>) => Record<string, unknown>
  /** Blank form values for creating. */
  emptyValues: Record<string, unknown>
  /**
   * Lookup fields whose already-taken values must be disabled in the picker.
   *
   * For resources the API allows only one of per parent (route prices: one
   * per route), this greys out parents that already have a record instead of
   * letting the user submit and collect a 409. The row being edited keeps its
   * own value selectable.
   *
   * Maps the FIELD name to the row property holding the taken value - usually
   * the same name.
   */
  uniqueBy?: Array<keyof T & string>
  /**
   * Verbs the API does not implement for this resource, regardless of what
   * the user's permissions say.
   *
   * Some resources are generated rather than authored - /trip-points is
   * created and removed with its trip, and POST/DELETE there both 404 - so
   * the buttons must be hidden even when permission is granted. Listing a
   * verb here beats offering an action that cannot succeed.
   *
   * Currently unused: the trip-points list page was removed in favour of the
   * timetable inside TripDetailPage. Kept because read-only endpoints keep
   * appearing in this API.
   */
  disabledActions?: Array<'create' | 'delete'>
  /**
   * Enables the startDate/endDate range filter on the list.
   *
   * `label` names the field the API actually filters on, which is not always
   * the obvious one: /trips filters by `createdAt`, so labelling it
   * "departure" would be wrong and misleading.
   */
  dateFilter?: { label: string; hint?: string }
  /**
   * Builds a link to a full detail page for a row.
   *
   * Supplying this adds a "Show detail" row action and makes the row itself
   * navigate. Use it when a resource has its own GET-by-id view too rich for
   * a dialog - /trips returns the whole vehicle, fares and segments.
   */
  detailPath?: (row: T) => string
}
