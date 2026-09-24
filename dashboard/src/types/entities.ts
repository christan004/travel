/**
 * Domain types, derived directly from the SwiftBus OpenAPI spec (see docs/).
 *
 * Names match the API exactly - Ticket, Car, Trip and so on - so there is no
 * translation layer between the UI and the backend.
 *
 * Decimal columns (price, distance, tankCapacity, maxWeight) arrive as
 * STRINGS to preserve precision: use toNumber()/formatCurrency() from
 * lib/utils rather than parsing them inline.
 */

/* ------------------------------------------------------------------ *
 * Shared
 * ------------------------------------------------------------------ */

/** Generic lifecycle status used across most resources. */
export type RecordStatus = 'active' | 'inactive'

/** Prisma Decimal serialised as a string, e.g. "3500.00". */
export type DecimalString = string

export interface Timestamps {
  createdAt: string
  updatedAt: string
}

export interface ListParams {
  page?: number
  limit?: number
  status?: string
  search?: string
}

/* ------------------------------------------------------------------ *
 * Auth / identity
 * ------------------------------------------------------------------ */

export interface AuthUser {
  id: string
  /** Resolved by the API from the account; no longer supplied at login. */
  companyId: string
  /** Null for company-wide users; set for branch-scoped ones. */
  branchId?: string | null
  /**
   * Platform-level account. Super admins come back with an EMPTY
   * `permissions` array, so every UI gate must treat this flag as a bypass -
   * checking the array alone would hide the whole app from them.
   *
   * Note this is a UI concern only: the API still scopes tenant resources
   * separately, and a super admin can be 403'd on them. See
   * docs/backend-auth.md.
   */
  isSuperAdmin?: boolean
  firstName: string
  lastName: string
  email: string
  status?: RecordStatus
  /** Flat permission strings, e.g. "cars.read". Drives UI gating. */
  permissions: string[]
}

/**
 * POST /api/v1/auth/login.
 *
 * `companyId` was removed: the API resolves the tenant from the account, and
 * a body carrying one is now simply ignored. The response still returns the
 * user's `companyId`, so nothing downstream had to change.
 */
export interface LoginPayload {
  email: string
  password: string
}

export interface Company {
  id: string
  name: string
  email: string
  phone: string
  supportingPhone?: string | null
  tinNumber: string
  logoUrl?: string | null
  address: string
  status: RecordStatus
  createdAt?: string
  updatedAt?: string
  /** Returned by the super-admin list and on create. */
  _count?: { users: number; branches: number; trips: number }
}

/**
 * PATCH /api/v1/companies/current - the tenant editing itself.
 *
 * Seven fields, all optional but at least one required. `status` is NOT
 * among them: sending it alone fails as an empty body, and alongside a real
 * field it is silently dropped. Companies cannot deactivate themselves.
 */
export interface UpdateCompanyPayload {
  name?: string
  email?: string
  phone?: string
  supportingPhone?: string | null
  tinNumber?: string
  address?: string
  /** A full URL, or null to clear. '' is rejected as an invalid URL. */
  logoUrl?: string | null
}

/**
 * POST /api/v1/companies - SUPER ADMIN ONLY (a company admin gets 403).
 *
 * Creates the company, its main branch and its first admin user in one call,
 * so `admin` is required: without it the request fails on `admin`.
 */
export interface CreateCompanyPayload {
  name: string
  email: string
  phone: string
  supportingPhone?: string
  tinNumber: string
  address: string
  logoUrl?: string | null
  admin: {
    firstName: string
    lastName: string
    email: string
    phone: string
    password: string
  }
}

/** What POST /api/v1/companies returns: the company plus what it provisioned. */
export interface CreateCompanyResult {
  company: Company
  mainBranch?: { id: string; name: string; type: string }
  admin?: { id: string; firstName: string; lastName: string; email: string; phone: string }
}

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  gender?: string | null
  phone?: string | null
  status: RecordStatus
}

export interface Role {
  id: string
  name: string
  isActive: boolean
}

export interface Permission {
  id: string
  permission: string
}

/* ------------------------------------------------------------------ *
 * Geography & routing
 * ------------------------------------------------------------------ */

export interface Location extends Timestamps {
  id: string
  name: string
  address: string
  parentId: string | null
  status: RecordStatus
  companyId: string
}

/**
 * A route is a physical corridor between two locations.
 *
 * The API models fare separately (see RoutePrice) and has no operator,
 * departure time or amenities field - those live on Trip / Car.
 */
/**
 * DIRECT routes are a single hop. COMPOSITE routes are assembled from two or
 * more DIRECT routes, which the API enforces strictly - see RouteSegment.
 */
export type RouteType = 'DIRECT' | 'COMPOSITE'

/**
 * One leg of a COMPOSITE route.
 *
 * Reads embed the whole `segmentRoute`, so a composite can be described
 * without extra lookups. Writes send only `{ segmentRouteId, sequence }`.
 */
export interface RouteSegment {
  id: string
  mainRouteId: string
  segmentRouteId: string
  sequence: number
  segmentRoute?: TravelRoute
  createdAt?: string
  updatedAt?: string
}

/** A segment as sent on create/update. */
export interface RouteSegmentInput {
  segmentRouteId: string
  sequence: number
}

export interface TravelRoute extends Timestamps {
  id: string
  name: string
  routeType: RouteType
  fromLocationId: string
  toLocationId: string
  distance: DecimalString
  estimatedTimeInMinutes: number
  latLong: string | null
  status: RecordStatus
  companyId: string
  /** Always present; empty for DIRECT routes. */
  segments?: RouteSegment[]
}

/**
 * POST /api/v1/routes.
 *
 * The API enforces all of the following, so the form does too:
 *  - COMPOSITE requires >= 2 segments; DIRECT must have none.
 *  - `sequence` starts at 1 and must be consecutive.
 *  - Segments must be DIRECT routes (a COMPOSITE one is "not found").
 *  - No duplicate segments, and a route cannot contain itself.
 *  - The chain must run from the route's own origin to its destination.
 */
export interface CreateRoutePayload {
  name: string
  routeType: RouteType
  fromLocationId: string
  toLocationId: string
  distance: string
  estimatedTimeInMinutes: number
  latLong?: string | null
  status?: RecordStatus
  segments?: RouteSegmentInput[]
}

/**
 * The fare for a route.
 *
 * `fromLocationId` / `toLocationId` are DERIVED: the API copies them from the
 * route and rejects them on write ("Unrecognized keys"). They are read-only
 * echoes of the route's own endpoints, so the form only asks for the route.
 *
 * There is at most ONE price per route - a second POST for the same route is
 * refused with 409 RESOURCE_ALREADY_EXISTS.
 */
export interface RoutePrice extends Timestamps {
  id: string
  routeId: string
  /** Derived from the route; not writable. */
  fromLocationId: string
  /** Derived from the route; not writable. */
  toLocationId: string
  price: DecimalString
  currency: string | null
  status: RecordStatus
  companyId: string
}

/** POST /api/v1/route-prices - only these four keys are accepted. */
export interface CreateRoutePricePayload {
  routeId: string
  price: string
  currency?: string | null
  status?: RecordStatus
}

/** A scheduled run of a route by a specific vehicle and driver. */
/**
 * A scheduled run of a route.
 *
 * Only four fields are writable on create: `routeId`, `driverCarId`,
 * `departureAt` and `status`. Everything else the API derives:
 *
 *  - `arrivalAt` = departure + the route's estimatedTimeInMinutes. Sending it
 *    is rejected ("Unrecognized key").
 *  - `points` are generated from the route: one per endpoint for a DIRECT
 *    route, one per segment boundary for a COMPOSITE one, each with a
 *    scheduled time. This replaced the old `hasStops` flag, which is now
 *    rejected too - a trip has stops if its route has segments.
 *
 * Reads embed `route`, `vehicle` (the driver-assignment, with its driver and
 * car) and `points`, so a trip describes itself without extra lookups.
 */
export interface Trip extends Timestamps {
  id: string
  routeId: string
  /** A DriverAssignment id - the driver+car pairing running this trip. */
  driverCarId: string
  departureAt: string
  /** DERIVED from departure + route duration; not writable. */
  arrivalAt: string | null
  status: RecordStatus
  companyId: string
  route?: TravelRoute & {
    fromLocation?: Location
    toLocation?: Location
  }
  /** The driver-assignment, embedded under this name rather than `driverCar`. */
  vehicle?: DriverAssignment
  /** Generated stop schedule; see TripPoint. */
  points?: TripPoint[]
}

/**
 * GET /api/v1/trips/{id} - a DIFFERENT, deeper shape from the list.
 *
 * It adds the operating company, the route's prices and segments, and the
 * whole vehicle: product type, seats, baggage, inspections and insurance.
 *
 * But it STRIPS IDS from the nested records. `route` has no `id`, `vehicle`
 * has neither `id` nor `carId`/`driverId`, and each `points` entry contains
 * ONLY `location` - no point id, sequence, status or times. So this response
 * cannot drive anything editable: TripDetailPage reads /trip-points
 * separately for the timetable. See docs/backend-trips.md.
 */
export interface TripDetail extends Timestamps {
  id: string
  companyId: string
  routeId: string
  driverCarId: string
  departureAt: string
  arrivalAt: string | null
  status: RecordStatus
  company?: Company
  route?: TripDetailRoute
  vehicle?: { driver?: Driver; car?: TripDetailCar }
  /** Location only - no point id, status or schedule. */
  points?: Array<{ location?: Location }>
  tickets?: Ticket[]
}

/** The route as embedded in a trip detail: no `id`, prices and segments included. */
export interface TripDetailRoute {
  name: string
  routeType: RouteType
  status: RecordStatus
  distance: DecimalString
  estimatedTimeInMinutes: number
  latLong: string | null
  fromLocation?: Partial<Location> & { name: string }
  toLocation?: Partial<Location> & { name: string }
  prices?: Array<{ price: DecimalString; currency: string | null; status: RecordStatus }>
  segments?: RouteSegment[]
}

/** The vehicle as embedded in a trip detail: full fleet context, no ids. */
export interface TripDetailCar {
  model: string
  plateNumber: string
  tankCapacity: DecimalString
  totalSeats?: number
  totalWeightSlots?: number
  product?: { type: string; status: RecordStatus }
  seats?: Array<{ number: number; status: RecordStatus }>
  baggage?: Array<{ maxWeight: DecimalString; number: number; status: RecordStatus }>
  controls?: Array<{
    location: string
    validFrom: string
    validTo: string
    status: InsuranceStatus
  }>
  /** Capitalised in the response, unlike every sibling key. */
  CarInsurance?: Array<{
    name: string
    validFrom: string
    validTo: string
    status: InsuranceStatus
  }>
}

/**
 * A scheduled stop on a trip, generated by the API from the route.
 *
 * The first point has no `scheduledArrivalAt` and the last none departure -
 * you do not arrive at the origin or depart the destination.
 */
export interface TripPoint {
  id: string
  tripId: string
  locationId: string
  sequence: number
  scheduledArrivalAt: string | null
  scheduledDepartureAt: string | null
  actualArrivalAt: string | null
  actualDepartureAt: string | null
  status: TripStopStatus
  location?: Location
  createdAt?: string
  updatedAt?: string
}

/** POST /api/v1/trips. `status` defaults to active; nothing else is optional. */
export interface CreateTripPayload {
  routeId: string
  driverCarId: string
  departureAt: string
  status?: RecordStatus
}

/**
 * PATCH /api/v1/trips/{id} accepts ONLY these. `routeId`, `departureAt` and
 * `arrivalAt` are all rejected as unrecognized keys, so a scheduled trip
 * cannot be re-routed or rescheduled - only reassigned or deactivated.
 */
export interface UpdateTripPayload {
  driverCarId?: string
  status?: RecordStatus
}

export type TripStopStatus =
  | 'PENDING'
  | 'AVAILABLE'
  | 'CLOSED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'COMPLETED'

/**
 * The old /trip-stops shape. That endpoint now 404s - see TripPoint, which
 * replaces it. Kept only so the status enum's history is legible; nothing
 * references this type.
 *
 * @deprecated Use TripPoint.
 */
export interface TripStop extends Timestamps {
  id: string
  tripId: string
  routeId: string
  fromLocationId: string
  toLocationId: string
  scheduledArrivalAt: string
  scheduledDepartureAt: string
  actualArrivalAt: string | null
  actualDepartureAt: string | null
  sequence: number
  status: TripStopStatus
}

/**
 * PATCH /api/v1/trip-points/{id} accepts ONLY these three.
 *
 * The schedule (`scheduledArrivalAt`, `scheduledDepartureAt`), `sequence` and
 * `locationId` are all generated from the trip's route and rejected as
 * unrecognized keys - you record what ACTUALLY happened, not what was planned.
 */
export interface UpdateTripPointPayload {
  status?: TripStopStatus
  actualArrivalAt?: string | null
  actualDepartureAt?: string | null
}

/* ------------------------------------------------------------------ *
 * Tickets
 * ------------------------------------------------------------------ */

/**
 * Verified against the API, which rejects anything else with
 * `expected one of "PENDING_PAYMENT"|"BOOKED"|...`.
 *
 * PENDING_PAYMENT and EXPIRED were missing here: a seat is held while payment
 * is attempted, and the hold lapses into EXPIRED if it never completes. Both
 * appear in real data, so leaving them out mislabelled live tickets.
 */
export type TicketStatus =
  | 'PENDING_PAYMENT'
  | 'BOOKED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'REFUNDED'
  | 'EXPIRED'

export const TICKET_STATUSES: TicketStatus[] = [
  'PENDING_PAYMENT',
  'BOOKED',
  'CANCELLED',
  'COMPLETED',
  'REFUNDED',
  'EXPIRED',
]

/** Payment attempt attached to a ticket. */
export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED'

export interface TicketPayment {
  id: string
  ticketId: string
  companyId?: string
  amount: DecimalString
  currency: string | null
  provider: string
  payerPhone: string | null
  transactionId: string | null
  referenceId: string | null
  idempotencyKey?: string
  status: PaymentStatus | string
  failureReason: string | null
  paidAt: string | null
  createdAt?: string
  updatedAt?: string
}

/** A stop as referenced by a ticket's boarding/destination point. */
export interface TicketPoint {
  id: string
  sequence: number
  scheduledArrivalAt?: string | null
  scheduledDepartureAt?: string | null
  location?: { id: string; name: string; address?: string }
}

/**
 * A ticket as returned by the trip sales report, which is much richer than
 * the flat /tickets row: it carries the passenger's boarding and destination
 * POINTS (not bare location ids), the seats held, and every payment attempt.
 */
export interface ReportTicket {
  id: string
  publicReference: string
  ticketNumber: string
  passengerName: string
  passengerPhone: string
  price: DecimalString
  currency: string | null
  status: TicketStatus
  holdExpiresAt: string | null
  createdAt: string
  updatedAt?: string
  branch?: { id: string; name?: string } | null
  boardingPoint?: TicketPoint
  destinationPoint?: TicketPoint
  ticketSeats?: Array<{ seat: { id: string; number: number; letter: string | null } }>
  payments?: TicketPayment[]
}

/** Sales totals for one trip. */
export interface TripSalesSummary {
  total: number
  seats: number
  revenue: DecimalString
  currency: string | null
  /** Ticket counts keyed by status; only non-zero statuses appear. */
  byStatus: Partial<Record<TicketStatus, number>>
}

/**
 * GET /api/v1/tickets/trips - one row per trip, with its sales summary.
 *
 * `?startDate=` / `?endDate=` filter by **departureAt** here, unlike
 * /trips where the same params filter createdAt. `?routeId=` is rejected.
 */
export interface TripSalesRow {
  id: string
  departureAt: string
  arrivalAt: string | null
  status: RecordStatus
  createdAt: string
  branch?: { id: string; name?: string } | null
  route?: {
    id: string
    name: string
    routeType: RouteType
    distance: DecimalString
    estimatedTimeInMinutes: number
    fromLocation?: { id: string; name: string; address?: string }
    toLocation?: { id: string; name: string; address?: string }
  }
  vehicle?: {
    id: string
    car?: { id: string; model: string; plateNumber: string; totalSeats?: number }
    driver?: { id: string; firstName: string; lastName: string; phoneNumber?: string }
  }
  summary: TripSalesSummary
}

/**
 * GET /api/v1/tickets/trips/{id} - the same row plus the trip's stops and
 * every ticket sold on it.
 */
export interface TripSalesDetail extends TripSalesRow {
  points?: Array<{
    id: string
    sequence: number
    status: TripStopStatus
    scheduledArrivalAt: string | null
    scheduledDepartureAt: string | null
    actualArrivalAt: string | null
    actualDepartureAt: string | null
    location?: { id: string; name: string; address?: string }
  }>
  tickets?: ReportTicket[]
}

export interface Ticket extends Timestamps {
  id: string
  tripId: string
  seatId: string
  ticketNumber: string
  fromLocationId: string
  toLocationId: string
  currency: string | null
  passengerName: string
  passengerPhone: string
  price: DecimalString
  status: TicketStatus
  companyId: string
}

export interface CreateTicketPayload {
  tripId: string
  seatId: string
  ticketNumber: string
  fromLocationId: string
  toLocationId: string
  currency?: string | null
  passengerName: string
  passengerPhone: string
  price: string | number
  status?: TicketStatus
}

export type UpdateTicketPayload = Partial<CreateTicketPayload>

/* ------------------------------------------------------------------ *
 * Fleet
 * ------------------------------------------------------------------ */

export interface Car {
  id: string
  model: string
  plateNumber: string
  tankCapacity: DecimalString
  productId: string
  /**
   * Seating capacity declared on the vehicle.
   *
   * NOT in the original OpenAPI spec - capacity previously had to be derived
   * by counting /seats rows. Optional here so the UI still renders against a
   * backend that has not yet added the column.
   * See docs/backend-car-fields.md for the server-side change required.
   */
  totalSeats?: number | null
  /**
   * Number of luggage compartments the vehicle has.
   *
   * A count of slots, not a weight: each slot's own limit lives on
   * `Baggage.maxWeight`. Optional throughout - vehicles that carry no
   * luggage simply leave it unset.
   *
   * NOT in the original OpenAPI spec; see docs/backend-car-fields.md.
   */
  totalWeightSlots?: number | null
  /**
   * Seats belonging to this car, embedded by the API on list and detail.
   *
   * Narrower than the standalone `Seat`: the embedded copy omits `carId`,
   * which would be redundant here. Optional so the UI still works against a
   * response that does not include it.
   */
  seats?: EmbeddedSeat[]
  status?: RecordStatus
}

export interface CreateCarPayload {
  model: string
  plateNumber: string
  tankCapacity: string | number
  productId: string
  totalSeats?: number
  totalWeightSlots?: number | null
}

export type UpdateCarPayload = Partial<CreateCarPayload>

/**
 * A seat as returned by GET /api/v1/seats, where `carId` identifies its
 * vehicle.
 */
export interface Seat {
  id: string
  carId: string
  number: number
  /**
   * The seat's ROW, e.g. "A".
   *
   * Seats sharing a letter sit in the same row, so the letters describe the
   * vehicle's real layout - a 29-seater came back as A:2, B:4, C:3, D-H:4,
   * the 2 and 3 being the driver's row and the door row. Null on vehicles
   * whose seats were created before rows existed; those render as one flat
   * block.
   *
   * Not writable: PATCH /seats/{id} accepts only `status`.
   */
  letter: string | null
  status: RecordStatus
}

/**
 * A seat as embedded in a Car response. Same record, minus `carId` - the
 * parent car already establishes that.
 */
export type EmbeddedSeat = Omit<Seat, 'carId'>

/**
 * How a vehicle's luggage capacity is declared on create.
 *
 *   SOME_WEIGHT      - one limit applied to every slot, sent as `maxWeight`
 *   DIFFERENT_WEIGHT - a limit per slot, sent as a `weights` array
 *
 * This is a WRITE-ONLY discriminator: POST accepts it, but the API expands
 * the request into one Baggage row per slot, and GET returns those flat rows
 * with no `type` field.
 */
export type BaggageType = 'SOME_WEIGHT' | 'DIFFERENT_WEIGHT'

export const BAGGAGE_TYPES: BaggageType[] = ['SOME_WEIGHT', 'DIFFERENT_WEIGHT']

/**
 * One luggage compartment, as returned by GET /api/v1/baggage.
 *
 * The API creates these from a POST: SOME_WEIGHT fans one maxWeight out
 * across the car's totalWeightSlots, DIFFERENT_WEIGHT creates one per
 * entry in weights. Either way the rows look identical afterwards.
 */
export interface Baggage {
  id: string
  carId: string
  maxWeight: DecimalString
  number: number
  status: RecordStatus
  createdAt?: string
  companyId?: string
}

/** A weight entry as SENT on create - no id yet, status optional. */
export interface BaggageWeightInput {
  maxWeight: string
  status?: RecordStatus
}

/** POST /api/v1/baggage - one shape per type, discriminated by it. */
export type CreateBaggagePayload =
  | { carId: string; type: 'SOME_WEIGHT'; maxWeight: string; status?: RecordStatus }
  | { carId: string; type: 'DIFFERENT_WEIGHT'; weights: BaggageWeightInput[] }

export interface ProductType {
  id: string
  type: string
  status: RecordStatus
}

/**
 * Insurance policy status is its OWN enum - `active` | `expired` - not the
 * `active` | `inactive` used everywhere else. Sending "inactive" is rejected
 * with `Invalid option: expected one of "active"|"expired"`.
 */
export type InsuranceStatus = 'active' | 'expired'

/**
 * A policy as returned by GET /api/v1/car-insurance/{id}, which is the only
 * endpoint that returns `carId`.
 *
 * The LIST endpoint returns a different, narrower shape: policies grouped
 * under their car with `carId` omitted entirely (see CarInsuranceGroup). That
 * matters because PATCH REQUIRES `carId` on every call, so an edit needs the
 * car resolved from the grouping - it cannot come from the row itself.
 */
export interface CarInsurance {
  id: string
  carId: string
  name: string
  validFrom: string
  validTo: string
  status: InsuranceStatus
  companyId?: string
  createdAt?: string
}

/** One policy as it appears inside a list group: no carId, no companyId. */
export type CarInsuranceSummary = Omit<CarInsurance, 'carId' | 'companyId' | 'createdAt'>

/**
 * GET /api/v1/car-insurance returns one entry per CAR, each holding that
 * car's policies under a capitalised `CarInsurance` key. `meta.total` counts
 * CARS, not policies, so pagination is per-car too.
 */
export interface CarInsuranceGroup {
  CarInsurance: CarInsuranceSummary[]
}

/** POST /api/v1/car-insurance. `carId` is required; `status` defaults to active. */
export interface CreateCarInsurancePayload {
  carId: string
  name: string
  validFrom: string
  validTo: string
  status?: InsuranceStatus
}

/**
 * A technical inspection.
 *
 * Unlike car insurance, this endpoint is well behaved: LIST returns flat rows
 * with `carId`, `meta.total` counts records, and PATCH is a true partial
 * update. It shares insurance's `active` | `expired` status enum (see
 * InsuranceStatus) rather than the app-wide active/inactive.
 */
export interface CarControl {
  id: string
  carId: string
  location: string
  validFrom: string
  validTo: string
  status: InsuranceStatus
  companyId?: string
  createdAt?: string
  /** Embedded by LIST and GET-by-id: just the id and plate, no model. */
  companyCar?: { id: string; plateNumber: string }
}

/**
 * GET /api/v1/car-controls returns one entry per CAR, each holding that car's
 * inspections under `controls`.
 *
 * The group's `id` IS the car id, and it names the plate - so unlike the
 * car-insurance grouping, rows can be flattened and edited without an extra
 * GET-by-id round-trip.
 *
 * The nested controls themselves carry NO `carId` and no `companyId`; callers
 * must stamp the group's `id` onto each row while flattening.
 *
 * A car with NO inspections is still returned, with `controls: []` - which is
 * what makes the "never inspected" state visible rather than silently absent.
 */
export interface CarControlGroup {
  /** The CAR's id, not a control id. */
  id: string
  plateNumber: string
  controls: EmbeddedCarControl[]
}

/** A control as nested in a group: no carId, no companyId. */
export type EmbeddedCarControl = Omit<CarControl, 'carId' | 'companyId' | 'companyCar'>

/** POST /api/v1/car-controls. `status` defaults to active when omitted. */
export interface CreateCarControlPayload {
  carId: string
  location: string
  validFrom: string
  validTo: string
  status?: InsuranceStatus
}

/* ------------------------------------------------------------------ *
 * People
 * ------------------------------------------------------------------ */

/** API spells this model `Passanger`; the endpoint path is /passengers. */
export interface Passenger extends Timestamps {
  id: string
  names: string
  email: string | null
  phoneNumber: string
}

export interface CreatePassengerPayload {
  names: string
  email?: string | null
  phoneNumber: string
  password: string
  /** The API requires at least one tenant-owned ticket to create a passenger. */
  ticketIds: string[]
}

export type UpdatePassengerPayload = Partial<CreatePassengerPayload>

export interface Driver {
  id: string
  firstName: string
  lastName: string
  idNumber: string
  email: string | null
  phoneNumber: string
  licenseNumber: string
  category: string
  status: RecordStatus
}

/**
 * A driver paired with a car. A Trip references one of these by id, via its
 * `driverCarId`, rather than naming a vehicle and driver separately.
 */
export interface DriverAssignment {
  id: string
  carId: string
  driverId: string
  status: RecordStatus
  /**
   * Embedded by the list endpoints. Depth varies by caller: /trips returns
   * the car's model and capacity too, /driver-assignments only the plate.
   * Typed as a partial Car so either is assignable.
   */
  car?: Partial<Car> & { id: string; plateNumber: string }
  driver?: Partial<Driver> & { id: string; firstName: string; lastName: string }
}

/* ------------------------------------------------------------------ *
 * Roles and permissions
 * ------------------------------------------------------------------ */

/**
 * A role, as returned by GET /api/v1/roles.
 *
 * `permissions` here is a FLAT STRING ARRAY. GET-by-id returns the same
 * record but with permissions as nested join objects instead - see
 * RoleDetail - so the list shape is the one worth reading.
 */
export interface Role extends Timestamps {
  id: string
  companyId: string
  name: string
  isActive: boolean
  /**
   * Built-in roles. They CANNOT be renamed or deleted (both 422), though the
   * API does still allow their permissions to be replaced.
   *
   * Absent from list rows; only GET-by-id returns it.
   */
  isFixed?: boolean
  /** Flat permission strings on the list endpoint. */
  permissions?: string[]
  _count?: { users: number }
}

/** One entry of the nested `permissions` array on GET /roles/{id}. */
export interface RolePermissionLink {
  roleId: string
  companyPermissionId: string
  companyPermission?: {
    id: string
    companyId: string
    permission: string
    createdAt?: string
    updatedAt?: string
  }
}

/**
 * GET /api/v1/roles/{id}: same record, but `permissions` comes back as join
 * rows rather than strings. Use permissionNames() to flatten either shape.
 */
export interface RoleDetail extends Omit<Role, 'permissions'> {
  permissions?: RolePermissionLink[]
}

/**
 * POST /api/v1/roles. `isActive` defaults to true.
 *
 * A `permissions` key is ACCEPTED here but silently ignored - the role is
 * created empty. Assign them with PUT /roles/{id}/permissions afterwards.
 */
export interface CreateRolePayload {
  name: string
  isActive?: boolean
}

/** PATCH /api/v1/roles/{id}. At least one field required. */
export interface UpdateRolePayload {
  name?: string
  isActive?: boolean
}

/**
 * PUT /api/v1/roles/{id}/permissions - a full REPLACE, not a merge.
 *
 * POST and PATCH on this path both 404. An empty array clears every
 * permission. Unknown strings are rejected against the catalog.
 */
export interface ReplaceRolePermissionsPayload {
  permissions: string[]
}

/** A row from GET /api/v1/permissions. */
export interface CompanyPermission {
  id: string
  permission: string
}

export interface Branch {
  id: string
  /**
   * Human-readable branch name, e.g. "Nyabugogo Office".
   *
   * NOT in the original OpenAPI spec - the API identified branches by
   * `branchNumber` alone. Optional here so the UI still renders correctly
   * against a backend that has not yet added the column.
   * See docs/backend-branch-name.md for the server-side change required.
   */
  name?: string | null
  email: string
  phone: string
  supportingPhone: string | null
  phoneNumber: string
  branchNumber: string
  type: string
  status: RecordStatus
}

export interface CompanyAccount {
  id: string
  code: string
  name: string
  status?: RecordStatus
}

/* ------------------------------------------------------------------ *
 * Dashboard
 *
 * Derived client-side from tickets/routes/cars - the API has no stats
 * endpoint. See hooks/useDashboardStats.ts.
 * ------------------------------------------------------------------ */

export interface RevenuePoint {
  label: string
  revenue: number
  bookings: number
}

export interface TopRoute {
  routeId: string
  name: string
  bookings: number
  revenue: number
}

export interface DashboardStats {
  totalBookings: number
  totalRevenue: number
  activeRoutes: number
  activeTrips: number
  totalCars: number
  activeDrivers: number
  seatsSoldToday: number
  currency: string
  revenueSeries: RevenuePoint[]
  topRoutes: TopRoute[]
  recentBookings: Ticket[]
  /** True when any underlying source failed, so the UI can caveat the numbers. */
  partial: boolean
}

