import {
  branchesApi,
  carsApi,
  companyAccountsApi,
  driverAssignmentsApi,
  driversApi,
  locationsApi,
  productTypesApi,
  routePricesApi,
  ticketsApi,
  tripsApi,
} from '@/api/resources'
import { ResourcePage } from '@/features/resource/ResourcePage'
import {
  locationsConfig,
  routePricesConfig,
  ticketsConfig,
  tripsConfig,
} from '@/features/resource/configs/operations'
import {
  carsConfig,
  driverAssignmentsConfig,
  driversConfig,
  productTypesConfig,
} from '@/features/resource/configs/fleet'
import { branchesConfig, companyAccountsConfig } from '@/features/resource/configs/admin'

/**
 * One page per API resource. Each is the generic ResourcePage bound to its
 * client and config, so behaviour stays identical across all of them.
 */

export const LocationsPage = () => <ResourcePage client={locationsApi} config={locationsConfig} />
/**
 * Routes needs its own page: a route is DIRECT or COMPOSITE, and a composite
 * carries a repeatable `segments` array with chain rules the generic form
 * renderer cannot express. See RoutesPage.
 */
export { RoutesPage } from '@/features/operations/RoutesPage'
export { TripDetailPage } from '@/features/operations/TripDetailPage'
/**
 * Roles are hand-written: the main action is assigning permissions, which is
 * its own endpoint and dialog. See RolesPage.
 */
export { RolesPage } from '@/features/settings/RolesPage'
/**
 * Companies is super-admin only: /companies 403s for a company admin, which
 * manages itself through Settings instead. See CompaniesPage.
 */
export { CompaniesPage } from '@/features/settings/CompaniesPage'
export const RoutePricesPage = () => <ResourcePage client={routePricesApi} config={routePricesConfig} />
/**
 * Trips get a detail view: the list response embeds the whole `points`
 * timetable, so clicking a row can show the full run for free.
 */
export const TripsPage = () => <ResourcePage client={tripsApi} config={tripsConfig} />
export const TicketsPage = () => <ResourcePage client={ticketsApi} config={ticketsConfig} />

export const ProductTypesPage = () => <ResourcePage client={productTypesApi} config={productTypesConfig} />

export const CarsPage = () => <ResourcePage client={carsApi} config={carsConfig} />

/**
 * Seats are managed per vehicle rather than as a flat list: the page lists
 * cars, and opening one shows its seat layout. See CarSeatsPage.
 */
export { CarSeatsPage as SeatsPage } from '@/features/fleet/CarSeatsPage'
/**
 * Baggage is car-first like Seats: GET /baggage returns cars with their
 * compartments embedded, and creation has two modes. See BaggagePage.
 */
export { BaggagePage } from '@/features/fleet/BaggagePage'
/**
 * Car insurance needs its own page: GET groups policies by car, meta.total
 * counts cars rather than policies, and PATCH requires a carId the grouped
 * rows do not carry. See CarInsurancePage.
 */
export { CarInsurancePage } from '@/features/fleet/CarInsurancePage'
/**
 * Car controls needs its own page: status is active/expired, and the ?status=
 * query validator contradicts it by accepting active/inactive. See
 * CarControlsPage.
 */
export { CarControlsPage } from '@/features/fleet/CarControlsPage'
export const DriversPage = () => <ResourcePage client={driversApi} config={driversConfig} />
export const DriverAssignmentsPage = () => (
  <ResourcePage client={driverAssignmentsApi} config={driverAssignmentsConfig} />
)

export const BranchesPage = () => <ResourcePage client={branchesApi} config={branchesConfig} />
export const CompanyAccountsPage = () => (
  <ResourcePage client={companyAccountsApi} config={companyAccountsConfig} />
)
