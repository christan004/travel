import {
  Armchair,
  Briefcase,
  Building2,
  Bus,
  ClipboardCheck,
  CreditCard,
  IdCard,
  LayoutDashboard,
  MapPin,
  Package,
  Route,
  KeyRound,
  Settings,
  ShieldCheck,
  Tag,
  Ticket,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /**
   * Permission required to see the item. Checked with the ".manage"
   * fallback in AuthProvider.hasPermission.
   */
  permission?: string
  /**
   * Platform-level item, hidden from ordinary company admins.
   *
   * Some endpoints are gated by the isSuperAdmin flag rather than by a
   * permission string - /companies 403s for a company admin no matter what
   * permissions it holds - so those links cannot be gated the usual way.
   */
  superAdminOnly?: boolean
  /** Data is derived client-side rather than from a dedicated endpoint. */
  derived?: boolean
}

export interface NavGroup {
  /** Omitted for the top-level group so Dashboard sits alone. */
  title?: string
  items: NavItem[]
}

/**
 * Sidebar navigation, grouped because the API exposes 20 resources and a
 * flat list would be unusable. Labels match the API resources exactly.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, derived: true }],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Tickets', to: '/tickets', icon: Ticket, permission: 'tickets.read' },
      { label: 'Trips', to: '/trips', icon: Bus, permission: 'trips.read' },
      { label: 'Routes', to: '/routes', icon: Route, permission: 'routes.read' },
      { label: 'Route prices', to: '/route-prices', icon: CreditCard, permission: 'route_prices.read' },
      { label: 'Locations', to: '/locations', icon: MapPin, permission: 'locations.read' },
      { label: 'Passengers', to: '/passengers', icon: Users, permission: 'passengers.read' },
    ],
  },
  {
    title: 'Fleet',
    items: [
      { label: 'Cars', to: '/cars', icon: Bus, permission: 'cars.read' },
      { label: 'Seats', to: '/seats', icon: Armchair, permission: 'seats.read' },
      { label: 'Baggage', to: '/baggage', icon: Package, permission: 'baggage.read' },
      { label: 'Product types', to: '/product-types', icon: Tag, permission: 'product_types.read' },
      { label: 'Car insurance', to: '/car-insurance', icon: ShieldCheck, permission: 'car_insurance.read' },
      { label: 'Car controls', to: '/car-controls', icon: ClipboardCheck, permission: 'car_control.read' },
      { label: 'Drivers', to: '/drivers', icon: IdCard, permission: 'drivers.read' },
      { label: 'Assignments', to: '/driver-assignments', icon: UserCheck, permission: 'driver_car_assignments.read' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Branches', to: '/branches', icon: Building2, permission: 'branches.read' },
      { label: 'Accounts', to: '/company-accounts', icon: Briefcase, permission: 'company_accounts.read' },
      { label: 'Roles', to: '/roles', icon: KeyRound, permission: 'roles.read' },
      { label: 'Companies', to: '/companies', icon: Building2, superAdminOnly: true },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

/** Flat list, for resolving the current page title in the topbar. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)
