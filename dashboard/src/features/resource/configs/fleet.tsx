import * as Yup from 'yup'
import { cn, toNumber } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ResourceConfig } from '@/features/resource/field-types'
import {
  ACTIVE_CHOICES,
  cuidField,
  decimalField,
  intField,
  lookupCell,
  mono,
  muted,
  requiredText,
  status,
  statusField,
} from '@/features/resource/shared'
import type {
  Car,
  Driver,
  DriverAssignment,
  ProductType,
} from '@/types/entities'

/* ----------------------------- Product types ---------------------------- */

export const productTypesConfig: ResourceConfig<ProductType> = {
  label: 'Product type',
  labelPlural: 'Product types',
  description: 'Vehicle classes you operate.',
  permission: 'product_types',
  statusChoices: ACTIVE_CHOICES,
  searchFields: ['type'],
  columns: [
    { id: 'type', header: 'Type', cell: (row) => <span className="font-medium">{row.type}</span> },
    { id: 'status', header: 'Status', cell: (row) => status(row.status) },
  ],
  fields: [
    { name: 'type', label: 'Type', kind: 'text', required: true, half: true, placeholder: 'Passenger Bus' },
    { name: 'status', label: 'Status', kind: 'select', choices: ACTIVE_CHOICES, required: true, half: true },
  ],
  validation: Yup.object({ type: requiredText('Type'), status: statusField }),
  emptyValues: { type: '', status: 'active' },
  toFormValues: (row) => ({ type: row.type, status: row.status }),
  toPayload: (v) => ({ type: String(v.type).trim(), status: v.status }),
}

/* --------------------------------- Cars --------------------------------- */

/**
 * NOTE: `totalSeats` and `totalWeightSlots` are NOT part of the original
 * OpenAPI spec - capacity previously had to be derived by counting /seats and
 * /baggage rows. Both are sent on create and update, so the backend needs
 * matching columns, schema fields and serializer entries before they persist
 * (see docs/backend-car-fields.md).
 *
 * Until then the UI degrades gracefully: the columns show "Not set" and "--".
 */
export const carsConfig: ResourceConfig<Car> = {
  label: 'Car',
  labelPlural: 'Cars',
  description: 'Vehicles in your fleet.',
  permission: 'cars',
  statusChoices: ACTIVE_CHOICES,
  searchFields: ['model', 'plateNumber'],
  lookups: ['productTypes'],
  columns: [
    {
      id: 'model',
      header: 'Vehicle',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.model}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{row.plateNumber}</p>
        </div>
      ),
    },
    {
      id: 'type',
      // UI label only - the field on the wire is still `productId`.
      header: 'Product type',
      cell: (row, ctx) => {
        const label = ctx.productTypes.get(row.productId)
        return label ? <Badge variant="neutral">{label}</Badge> : muted(null)
      },
    },
    {
      id: 'totalSeats',
      header: 'Seats',
      align: 'right',
      cell: (row) => {
        const declared = row.totalSeats
        // `seats` is embedded by the API; absent means "not returned", which
        // is different from an empty array ("none configured").
        const configured = row.seats?.length

        if (typeof configured !== 'number') {
          return typeof declared === 'number' ? (
            <span className="tabular-nums">{declared}</span>
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )
        }

        if (typeof declared !== 'number') {
          return <span className="tabular-nums">{configured}</span>
        }

        // Configured vs declared. They drift while seats are being set up, so
        // show both and flag the gap rather than silently picking one.
        return (
          <span
            className={cn('tabular-nums', configured !== declared && 'text-warning')}
            title={
              configured === declared
                ? `${configured} seats configured`
                : `${configured} configured, ${declared} declared`
            }
          >
            {configured}
            <span className="text-muted-foreground"> / {declared}</span>
          </span>
        )
      },
    },
    {
      id: 'totalWeightSlots',
      header: 'Baggage slots',
      align: 'right',
      cell: (row) =>
        typeof row.totalWeightSlots === 'number' ? (
          <span className="tabular-nums">{row.totalWeightSlots}</span>
        ) : (
          // Genuinely optional, so a dash rather than "Not set": a vehicle
          // with no luggage capacity is a valid state, not missing data.
          <span className="text-muted-foreground">--</span>
        ),
    },
    {
      id: 'tank',
      header: 'Tank',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {toNumber(row.tankCapacity).toLocaleString()} L
        </span>
      ),
    },
  ],
  fields: [
    { name: 'model', label: 'Model', kind: 'text', required: true, half: true, placeholder: 'Toyota Coaster' },
    { name: 'plateNumber', label: 'Plate number', kind: 'text', required: true, half: true, placeholder: 'RAB 123 A' },
    {
      name: 'totalSeats',
      label: 'Total seats',
      kind: 'number',
      required: true,
      half: true,
      placeholder: '30',
      hint: 'Seating capacity of this vehicle.',
    },
    {
      name: 'totalWeightSlots',
      label: 'Baggage slots',
      kind: 'number',
      half: true,
      placeholder: '4',
      hint: 'Optional. Number of luggage compartments.',
    },
    { name: 'tankCapacity', label: 'Tank capacity (L)', kind: 'decimal', required: true, half: true },
    // Label only: the API field is still `productId`.
    { name: 'productId', label: 'Product type', kind: 'lookup', lookup: 'productTypes', required: true, half: true },
  ],
  validation: Yup.object({
    model: requiredText('Model'),
    plateNumber: requiredText('Plate number'),
    // A vehicle with zero seats cannot carry passengers, so require min 1
    // rather than the min 0 that intField() allows.
    totalSeats: intField('Total seats').min(1, 'A vehicle needs at least one seat'),
    // Optional: blank is valid (no luggage capacity), but a supplied value
    // must be a non-negative whole number. Yup coerces '' to NaN, so the
    // transform maps an empty input back to undefined for `.notRequired()`.
    totalWeightSlots: Yup.number()
      .transform((value, original) => (original === '' || original === null ? undefined : value))
      .typeError('Baggage slots must be a number')
      .integer('Baggage slots must be a whole number')
      .min(0, 'Baggage slots cannot be negative')
      .notRequired(),
    tankCapacity: decimalField('Tank capacity'),
    productId: cuidField('Product type is required'),
  }),
  emptyValues: {
    model: '', plateNumber: '', totalSeats: '',
    totalWeightSlots: '', tankCapacity: '', productId: '',
  },
  toFormValues: (row) => ({
    model: row.model,
    plateNumber: row.plateNumber,
    totalSeats: typeof row.totalSeats === 'number' ? String(row.totalSeats) : '',
    totalWeightSlots:
      typeof row.totalWeightSlots === 'number' ? String(row.totalWeightSlots) : '',
    tankCapacity: row.tankCapacity,
    productId: row.productId,
  }),
  toPayload: (v) => ({
    model: String(v.model).trim(),
    plateNumber: String(v.plateNumber).trim(),
    totalSeats: Number(v.totalSeats),
    // null, not 0: a blank field means "not declared", which is different
    // from a vehicle that explicitly carries no luggage.
    totalWeightSlots: v.totalWeightSlots === '' ? null : Number(v.totalWeightSlots),
    tankCapacity: Number(v.tankCapacity).toFixed(2),
    productId: v.productId,
  }),
}

/* -------------------------------- Drivers ------------------------------- */

export const driversConfig: ResourceConfig<Driver> = {
  label: 'Driver',
  labelPlural: 'Drivers',
  description: 'Licensed drivers available for trips.',
  permission: 'drivers',
  statusChoices: ACTIVE_CHOICES,
  searchFields: ['firstName', 'lastName', 'licenseNumber', 'phoneNumber'],
  columns: [
    {
      id: 'name',
      header: 'Driver',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.firstName} {row.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.phoneNumber}</p>
        </div>
      ),
    },
    { id: 'license', header: 'Licence', cell: (row) => mono(row.licenseNumber) },
    {
      id: 'category',
      header: 'Category',
      cell: (row) => <Badge variant="neutral">{row.category}</Badge>,
    },
    { id: 'idNumber', header: 'ID number', cell: (row) => mono(row.idNumber) },
    { id: 'status', header: 'Status', cell: (row) => status(row.status) },
  ],
  fields: [
    { name: 'firstName', label: 'First name', kind: 'text', required: true, half: true },
    { name: 'lastName', label: 'Last name', kind: 'text', required: true, half: true },
    { name: 'idNumber', label: 'ID number', kind: 'text', required: true, half: true },
    { name: 'phoneNumber', label: 'Phone', kind: 'text', required: true, half: true },
    { name: 'email', label: 'Email', kind: 'email', half: true },
    { name: 'licenseNumber', label: 'Licence number', kind: 'text', required: true, half: true },
    { name: 'category', label: 'Licence category', kind: 'text', required: true, half: true, placeholder: 'D' },
    { name: 'status', label: 'Status', kind: 'select', choices: ACTIVE_CHOICES, required: true, half: true },
  ],
  validation: Yup.object({
    firstName: requiredText('First name'),
    lastName: requiredText('Last name'),
    idNumber: requiredText('ID number'),
    phoneNumber: requiredText('Phone'),
    email: Yup.string().trim().email('Enter a valid email address'),
    licenseNumber: requiredText('Licence number'),
    category: requiredText('Licence category'),
    status: statusField,
  }),
  emptyValues: {
    firstName: '', lastName: '', idNumber: '', phoneNumber: '',
    email: '', licenseNumber: '', category: '', status: 'active',
  },
  toFormValues: (row) => ({
    firstName: row.firstName,
    lastName: row.lastName,
    idNumber: row.idNumber,
    phoneNumber: row.phoneNumber,
    email: row.email ?? '',
    licenseNumber: row.licenseNumber,
    category: row.category,
    status: row.status,
  }),
  toPayload: (v) => ({
    firstName: String(v.firstName).trim(),
    lastName: String(v.lastName).trim(),
    idNumber: String(v.idNumber).trim(),
    phoneNumber: String(v.phoneNumber).trim(),
    email: v.email ? String(v.email).trim() : null,
    licenseNumber: String(v.licenseNumber).trim(),
    category: String(v.category).trim(),
    status: v.status,
  }),
}

/* -------------------------- Driver assignments -------------------------- */

export const driverAssignmentsConfig: ResourceConfig<DriverAssignment> = {
  label: 'Assignment',
  labelPlural: 'Driver assignments',
  description: 'Which driver is assigned to which vehicle.',
  permission: 'driver_car_assignments',
  statusChoices: ACTIVE_CHOICES,
  lookups: ['cars', 'drivers'],
  columns: [
    { id: 'driver', header: 'Driver', cell: (row, ctx) => lookupCell('drivers')(row.driverId, ctx) },
    { id: 'car', header: 'Vehicle', cell: (row, ctx) => lookupCell('cars')(row.carId, ctx) },
    { id: 'status', header: 'Status', cell: (row) => status(row.status) },
  ],
  fields: [
    { name: 'driverId', label: 'Driver', kind: 'lookup', lookup: 'drivers', required: true, half: true },
    { name: 'carId', label: 'Vehicle', kind: 'lookup', lookup: 'cars', required: true, half: true },
    { name: 'status', label: 'Status', kind: 'select', choices: ACTIVE_CHOICES, required: true, half: true },
  ],
  validation: Yup.object({
    driverId: cuidField('Driver is required'),
    carId: cuidField('Vehicle is required'),
    status: statusField,
  }),
  emptyValues: { driverId: '', carId: '', status: 'active' },
  toFormValues: (row) => ({ driverId: row.driverId, carId: row.carId, status: row.status }),
  toPayload: (v) => ({ driverId: v.driverId, carId: v.carId, status: v.status }),
}
