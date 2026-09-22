import * as Yup from 'yup'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ResourceConfig, SelectChoice } from '@/features/resource/field-types'
import {
  ACTIVE_CHOICES,
  cuidField,
  dateTime,
  decimalField,
  isoToLocalInput,
  localInputToIso,
  lookupCell,
  mono,
  muted,
  optionalText,
  requiredDate,
  requiredText,
  status,
  statusField,
} from '@/features/resource/shared'
import type {
  Location,
  RoutePrice,
  Ticket,
  Trip,
} from '@/types/entities'

/* ------------------------------- Locations ------------------------------ */

export const locationsConfig: ResourceConfig<Location> = {
  label: 'Location',
  labelPlural: 'Locations',
  description: 'Stations and stops your routes connect.',
  permission: 'locations',
  statusChoices: ACTIVE_CHOICES,
  searchFields: ['name', 'address'],
  lookups: ['locations'],
  columns: [
    { id: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name}</span> },
    { id: 'address', header: 'Address', cell: (row) => muted(row.address) },
    {
      id: 'parent',
      header: 'Parent',
      cell: (row, ctx) => lookupCell('locations')(row.parentId, ctx),
    },
    { id: 'status', header: 'Status', cell: (row) => status(row.status) },
  ],
  fields: [
    { name: 'name', label: 'Name', kind: 'text', required: true, half: true, placeholder: 'Kigali' },
    { name: 'address', label: 'Address', kind: 'text', required: true, half: true, placeholder: 'Nyabugogo' },
    {
      name: 'parentId',
      label: 'Parent location',
      kind: 'lookup',
      lookup: 'locations',
      half: true,
      hint: 'Optional. Leave empty for a top-level location.',
    },
    { name: 'status', label: 'Status', kind: 'select', choices: ACTIVE_CHOICES, required: true, half: true },
  ],
  validation: Yup.object({
    name: requiredText('Name'),
    address: requiredText('Address'),
    // parentId is optional, but must be a cuid when supplied.
    parentId: Yup.string().trim().matches(/^[cC][0-9a-z]{6,}$|^$/, 'Select a valid location'),
    status: statusField,
  }),
  emptyValues: { name: '', address: '', parentId: '', status: 'active' },
  toFormValues: (row) => ({
    name: row.name,
    address: row.address,
    parentId: row.parentId ?? '',
    status: row.status,
  }),
  toPayload: (v) => ({
    name: String(v.name).trim(),
    address: String(v.address).trim(),
    parentId: v.parentId ? String(v.parentId) : null,
    status: v.status,
  }),
}

/* ----------------------------- Route prices ----------------------------- */

/**
 * Fares, one per route.
 *
 * The write shape is just `{ routeId, price, currency, status }`. From/to are
 * DERIVED by the API from the route and are REJECTED if sent
 * ("Unrecognized keys: fromLocationId, toLocationId"), so the form asks only
 * for the route and shows its endpoints read-only in the table.
 *
 * `routeId` is resent on every edit even when unchanged: PATCHing price,
 * status or currency WITHOUT it fails with a spurious 409
 * RESOURCE_ALREADY_EXISTS (see docs/backend-route-prices.md).
 */
export const routePricesConfig: ResourceConfig<RoutePrice> = {
  label: 'Route price',
  labelPlural: 'Route prices',
  description: 'The fare charged on each route.',
  permission: 'route_prices',
  statusChoices: ACTIVE_CHOICES,
  lookups: ['routes', 'locations'],
  columns: [
    { id: 'route', header: 'Route', cell: (row, ctx) => lookupCell('routes')(row.routeId, ctx) },
    { id: 'from', header: 'From', cell: (row, ctx) => lookupCell('locations')(row.fromLocationId, ctx) },
    { id: 'to', header: 'To', cell: (row, ctx) => lookupCell('locations')(row.toLocationId, ctx) },
    {
      id: 'price',
      header: 'Price',
      align: 'right',
      cell: (row) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(row.price, row.currency ?? 'RWF')}
        </span>
      ),
    },
    { id: 'status', header: 'Status', cell: (row) => status(row.status) },
  ],
  fields: [
    {
      name: 'routeId',
      label: 'Route',
      kind: 'lookup',
      lookup: 'routes',
      required: true,
      hint: 'Each route can have one price. Origin and destination come from the route.',
    },
    { name: 'price', label: 'Price', kind: 'decimal', required: true, half: true },
    { name: 'currency', label: 'Currency', kind: 'text', half: true, placeholder: 'RWF' },
    { name: 'status', label: 'Status', kind: 'select', choices: ACTIVE_CHOICES, required: true, half: true },
  ],
  validation: Yup.object({
    routeId: cuidField('Route is required'),
    price: decimalField('Price'),
    currency: optionalText(),
    status: statusField,
  }),
  // One price per route: grey out routes that already have one.
  uniqueBy: ['routeId'],
  emptyValues: { routeId: '', price: '', currency: 'RWF', status: 'active' },
  toFormValues: (row) => ({
    routeId: row.routeId,
    price: row.price,
    currency: row.currency ?? '',
    status: row.status,
  }),
  toPayload: (v) => ({
    // routeId always goes, including on edits: without it PATCH 409s.
    routeId: v.routeId,
    price: Number(v.price).toFixed(2),
    currency: v.currency ? String(v.currency).trim() : null,
    status: v.status,
  }),
}

/* -------------------------------- Trips --------------------------------- */

/**
 * Scheduled runs.
 *
 * Create takes only `{ routeId, driverCarId, departureAt, status }`. The API
 * derives the rest and REJECTS the old fields as unrecognized keys:
 *
 *  - `arrivalAt` is computed as departure + the route's duration.
 *  - `hasStops` is gone: a trip's stops come from its route's segments, and
 *    the API generates a timetabled `points[]` to match.
 *
 * Edit is narrower still - PATCH accepts only `driverCarId` and `status`, so
 * a trip cannot be re-routed or rescheduled once created (see
 * docs/backend-trips.md). Route and departure are therefore edit-disabled.
 *
 * Rows embed `route` and `vehicle`, so no lookups are needed to label them;
 * the pickers still use them for the create form.
 */
export const tripsConfig: ResourceConfig<Trip> = {
  label: 'Trip',
  labelPlural: 'Trips',
  description: 'Scheduled runs of a route by a driver and vehicle.',
  permission: 'trips',
  statusChoices: ACTIVE_CHOICES,
  /**
   * `?startDate=`/`?endDate=` filter by `createdAt` - when the trip was
   * RECORDED - NOT by `departureAt`. Verified live: a trip departing in
   * November but created today is excluded by startDate=2026-09-18 and
   * included by startDate=2026-09-16. Labelled accordingly so the filter
   * cannot be mistaken for a departure-date range.
   */
  dateFilter: {
    label: 'Created',
    hint: 'Filtering by when trips were added, not when they depart - that is what the API supports.',
  },
  lookups: ['routes', 'driverAssignments'],
  // GET /trips/{id} is far richer than a list row - the whole vehicle, fares
  // and segments - so detail gets its own page rather than a dialog.
  detailPath: (row) => `/trips/${row.id}`,
  columns: [
    {
      id: 'route',
      header: 'Route',
      // Embedded by the API; fall back to the lookup for older responses.
      cell: (row, ctx) =>
        row.route?.name ? (
          <span className="font-medium text-foreground">{row.route.name}</span>
        ) : (
          lookupCell('routes')(row.routeId, ctx)
        ),
    },
    {
      id: 'driverCar',
      header: 'Driver and vehicle',
      cell: (row, ctx) => {
        const driver = row.vehicle?.driver
        const car = row.vehicle?.car
        if (!driver && !car) return lookupCell('driverAssignments')(row.driverCarId, ctx)
        return (
          <div className="min-w-0">
            {driver && (
              <p className="truncate text-foreground">
                {driver.firstName} {driver.lastName}
              </p>
            )}
            {car && (
              <p className="truncate font-mono text-xs text-muted-foreground">
                {car.plateNumber}
              </p>
            )}
          </div>
        )
      },
    },
    {
      id: 'path',
      header: 'From / To',
      // route.fromLocation / toLocation are embedded, so this needs no lookup.
      cell: (row) => {
        const from = row.route?.fromLocation?.name
        const to = row.route?.toLocation?.name
        if (!from || !to) return <span className="text-muted-foreground">--</span>
        return (
          <span className="flex items-center gap-1.5 text-sm">
            <span className="truncate">{from}</span>
            <span className="shrink-0 text-muted-foreground" aria-label="to">
              &rarr;
            </span>
            <span className="truncate">{to}</span>
          </span>
        )
      },
    },
    { id: 'departure', header: 'Departs', cell: (row) => dateTime(row.departureAt) },
    {
      id: 'arrival',
      header: 'Arrives',
      // Derived by the API from the route duration, so it is always present.
      cell: (row) => dateTime(row.arrivalAt),
    },
    {
      id: 'stops',
      header: 'Stops',
      cell: (row) => {
        const count = row.points?.length ?? 0
        // Every trip has at least an origin and a destination point; more
        // than two means the route was composite.
        if (count > 2) return <Badge variant="warning">{count - 2} en route</Badge>
        return <span className="text-muted-foreground">Direct</span>
      },
    },
    { id: 'status', header: 'Status', cell: (row) => status(row.status) },
  ],
  fields: [
    {
      name: 'routeId',
      label: 'Route',
      kind: 'lookup',
      lookup: 'routes',
      required: true,
      createOnly: true,
      hint: 'Stops and arrival time are taken from the route.',
    },
    {
      name: 'driverCarId',
      label: 'Driver and vehicle',
      kind: 'lookup',
      lookup: 'driverAssignments',
      required: true,
    },
    {
      name: 'departureAt',
      label: 'Departure',
      kind: 'datetime',
      required: true,
      half: true,
      createOnly: true,
      hint: 'Arrival is calculated from the route duration.',
    },
    { name: 'status', label: 'Status', kind: 'select', choices: ACTIVE_CHOICES, required: true, half: true },
  ],
  validation: Yup.object({
    routeId: cuidField('Route is required'),
    driverCarId: cuidField('Driver and vehicle is required'),
    departureAt: requiredDate('Departure'),
    status: statusField,
  }),
  emptyValues: { routeId: '', driverCarId: '', departureAt: '', status: 'active' },
  toFormValues: (row) => ({
    routeId: row.routeId,
    driverCarId: row.driverCarId,
    departureAt: isoToLocalInput(row.departureAt),
    status: row.status,
  }),
  toPayload: (v) => ({
    // routeId and departureAt are createOnly, so they are absent from an edit
    // submission - which is what PATCH requires, since it rejects both.
    ...(v.routeId ? { routeId: v.routeId } : {}),
    ...(v.departureAt ? { departureAt: localInputToIso(v.departureAt) } : {}),
    driverCarId: v.driverCarId,
    status: v.status,
  }),
}

/* -------------------------------- Tickets -------------------------------- */

const TICKET_CHOICES: SelectChoice[] = [
  { label: 'Booked', value: 'BOOKED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Refunded', value: 'REFUNDED' },
]

export const ticketsConfig: ResourceConfig<Ticket> = {
  label: 'Ticket',
  labelPlural: 'Tickets',
  description: 'Every ticket sold across your network.',
  permission: 'tickets',
  statusChoices: TICKET_CHOICES,
  searchFields: ['passengerName', 'ticketNumber', 'passengerPhone'],
  lookups: ['trips', 'seats', 'locations'],
  columns: [
    {
      id: 'passenger',
      header: 'Passenger',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.passengerName}</p>
          <p className="truncate text-xs text-muted-foreground">{row.passengerPhone}</p>
        </div>
      ),
    },
    { id: 'ticket', header: 'Ticket no.', cell: (row) => mono(row.ticketNumber) },
    { id: 'from', header: 'From', cell: (row, ctx) => lookupCell('locations')(row.fromLocationId, ctx) },
    { id: 'to', header: 'To', cell: (row, ctx) => lookupCell('locations')(row.toLocationId, ctx) },
    { id: 'seat', header: 'Seat', cell: (row, ctx) => lookupCell('seats')(row.seatId, ctx) },
    {
      id: 'price',
      header: 'Price',
      align: 'right',
      cell: (row) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(row.price, row.currency ?? 'RWF')}
        </span>
      ),
    },
    { id: 'status', header: 'Status', cell: (row) => status(row.status) },
  ],
  fields: [
    { name: 'ticketNumber', label: 'Ticket number', kind: 'text', required: true, half: true, placeholder: 'TKT-20260912-001' },
    { name: 'tripId', label: 'Trip', kind: 'lookup', lookup: 'trips', required: true, half: true },
    { name: 'seatId', label: 'Seat', kind: 'lookup', lookup: 'seats', required: true, half: true },
    { name: 'passengerName', label: 'Passenger name', kind: 'text', required: true, half: true },
    { name: 'passengerPhone', label: 'Passenger phone', kind: 'text', required: true, half: true },
    { name: 'fromLocationId', label: 'From', kind: 'lookup', lookup: 'locations', required: true, half: true },
    { name: 'toLocationId', label: 'To', kind: 'lookup', lookup: 'locations', required: true, half: true },
    { name: 'price', label: 'Price', kind: 'decimal', required: true, half: true },
    { name: 'currency', label: 'Currency', kind: 'text', half: true, placeholder: 'RWF' },
    { name: 'status', label: 'Status', kind: 'select', choices: TICKET_CHOICES, required: true, half: true },
  ],
  validation: Yup.object({
    ticketNumber: requiredText('Ticket number'),
    tripId: cuidField('Trip is required'),
    seatId: cuidField('Seat is required'),
    fromLocationId: cuidField('Origin is required'),
    toLocationId: cuidField('Destination is required').notOneOf(
      [Yup.ref('fromLocationId')],
      'Destination must differ from origin',
    ),
    passengerName: requiredText('Passenger name'),
    passengerPhone: requiredText('Passenger phone'),
    price: decimalField('Price'),
    currency: optionalText(),
    status: Yup.string().oneOf(TICKET_CHOICES.map((c) => c.value)).required('Status is required'),
  }),
  emptyValues: {
    ticketNumber: '', tripId: '', seatId: '',
    fromLocationId: '', toLocationId: '',
    passengerName: '', passengerPhone: '',
    price: '', currency: 'RWF', status: 'BOOKED',
  },
  toFormValues: (row) => ({
    ticketNumber: row.ticketNumber,
    tripId: row.tripId,
    seatId: row.seatId,
    fromLocationId: row.fromLocationId,
    toLocationId: row.toLocationId,
    passengerName: row.passengerName,
    passengerPhone: row.passengerPhone,
    price: row.price,
    currency: row.currency ?? '',
    status: row.status,
  }),
  toPayload: (v) => ({
    ticketNumber: String(v.ticketNumber).trim(),
    tripId: v.tripId,
    seatId: v.seatId,
    fromLocationId: v.fromLocationId,
    toLocationId: v.toLocationId,
    passengerName: String(v.passengerName).trim(),
    passengerPhone: String(v.passengerPhone).trim(),
    price: Number(v.price).toFixed(2),
    currency: v.currency ? String(v.currency).trim() : null,
    status: v.status,
  }),
}
