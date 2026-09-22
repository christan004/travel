import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoginPage } from '@/features/auth/LoginPage'
import { NotFoundPage } from '@/routes/NotFoundPage'

/**
 * Feature pages are code-split so the initial bundle stays small: recharts
 * ships only with the dashboard, and each resource page loads on demand.
 * LoginPage is eager - it is the first screen an unauthenticated user sees.
 */
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const PassengersPage = lazy(() =>
  import('@/features/passengers/PassengersPage').then((m) => ({ default: m.PassengersPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

/**
 * Every generated resource page lives in one module, so a single dynamic
 * import backs them all; `pick` selects the named export.
 */
const resourcePages = () => import('@/features/pages')
type ResourcePageName = keyof Awaited<ReturnType<typeof resourcePages>>

const pick = (name: ResourcePageName) =>
  lazy(() =>
    resourcePages().then((m) => ({ default: m[name] as ComponentType })),
  )

const TicketsPage = pick('TicketsPage')
const TripsPage = pick('TripsPage')
const TripDetailPage = pick('TripDetailPage')
const RoutesPage = pick('RoutesPage')
const RoutePricesPage = pick('RoutePricesPage')
const LocationsPage = pick('LocationsPage')
const CarsPage = pick('CarsPage')
const SeatsPage = pick('SeatsPage')
const BaggagePage = pick('BaggagePage')
const ProductTypesPage = pick('ProductTypesPage')
const CarInsurancePage = pick('CarInsurancePage')
const CarControlsPage = pick('CarControlsPage')
const DriversPage = pick('DriversPage')
const DriverAssignmentsPage = pick('DriverAssignmentsPage')
const BranchesPage = pick('BranchesPage')
const CompanyAccountsPage = pick('CompanyAccountsPage')
const RolesPage = pick('RolesPage')
const CompaniesPage = pick('CompaniesPage')

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-primary" />
      <span className="sr-only">Loading page</span>
    </div>
  )
}

/** Every lazy page needs a Suspense boundary of its own. */
function page(element: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <ErrorBoundary>
        <LoginPage />
      </ErrorBoundary>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: page(<DashboardPage />) },

          // Operations
          { path: 'tickets', element: page(<TicketsPage />) },
          { path: 'trips', element: page(<TripsPage />) },
          { path: 'trips/:id', element: page(<TripDetailPage />) },
          { path: 'routes', element: page(<RoutesPage />) },
          { path: 'route-prices', element: page(<RoutePricesPage />) },
          { path: 'locations', element: page(<LocationsPage />) },
          { path: 'passengers', element: page(<PassengersPage />) },

          // Fleet
          { path: 'cars', element: page(<CarsPage />) },
          { path: 'seats', element: page(<SeatsPage />) },
          { path: 'baggage', element: page(<BaggagePage />) },
          { path: 'product-types', element: page(<ProductTypesPage />) },
          { path: 'car-insurance', element: page(<CarInsurancePage />) },
          { path: 'car-controls', element: page(<CarControlsPage />) },
          { path: 'drivers', element: page(<DriversPage />) },
          { path: 'driver-assignments', element: page(<DriverAssignmentsPage />) },

          // Administration
          { path: 'branches', element: page(<BranchesPage />) },
          { path: 'company-accounts', element: page(<CompanyAccountsPage />) },
          { path: 'roles', element: page(<RolesPage />) },
          { path: 'companies', element: page(<CompaniesPage />) },
          { path: 'settings', element: page(<SettingsPage />) },

          { path: '404', element: <NotFoundPage /> },
          { path: '*', element: <Navigate to="/404" replace /> },
        ],
      },
    ],
  },
])
