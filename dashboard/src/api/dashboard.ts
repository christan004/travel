import type { DashboardStats, RevenuePoint, Ticket, TopRoute, TravelRoute } from '@/types/entities'
import { carsApi, driversApi, routesApi, ticketsApi, tripsApi } from '@/api/resources'
import { toNumber } from '@/lib/utils'

/* ===================================================================== *
 *  NO /dashboard OR /stats ENDPOINT EXISTS.
 *
 *  Every figure below is DERIVED from real endpoints (/tickets, /routes,
 *  /trips, /cars, /drivers) rather than invented. If the backend later adds
 *  an aggregate endpoint, replace `getDashboardStats` with that single call.
 *
 *  Caveat worth knowing: the API caps `limit` at 100, so these totals are
 *  computed over the most recent page of tickets, not the whole table.
 *  `meta.total` is used for true counts wherever it is available.
 * ===================================================================== */

/** The API rejects limit > 100. */
const MAX_PAGE_SIZE = 100

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Group tickets into the last `months` buckets for the revenue chart. */
function buildRevenueSeries(tickets: Ticket[], months = 6): RevenuePoint[] {
  const buckets = new Map<string, RevenuePoint>()
  const now = new Date()

  // Seed every bucket so months with no sales still render a zero point.
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, {
      label: d.toLocaleDateString('en', { month: 'short' }),
      revenue: 0,
      bookings: 0,
    })
  }

  tickets.forEach((ticket) => {
    // Refunded and cancelled sales are not revenue.
    if (ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED') return

    const d = new Date(ticket.createdAt)
    if (Number.isNaN(d.getTime())) return

    const bucket = buckets.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (!bucket) return // older than the window

    bucket.revenue += toNumber(ticket.price)
    bucket.bookings += 1
  })

  return [...buckets.values()]
}

function buildTopRoutes(tickets: Ticket[], routes: TravelRoute[], limit = 5): TopRoute[] {
  // Tickets carry from/to locations rather than a routeId, so group on the
  // location pair and label it from a matching route where one exists.
  const totals = new Map<string, TopRoute>()

  tickets.forEach((ticket) => {
    if (ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED') return

    const key = `${ticket.fromLocationId}->${ticket.toLocationId}`
    const existing = totals.get(key)

    if (existing) {
      existing.bookings += 1
      existing.revenue += toNumber(ticket.price)
      return
    }

    const match = routes.find(
      (route) =>
        route.fromLocationId === ticket.fromLocationId &&
        route.toLocationId === ticket.toLocationId,
    )

    totals.set(key, {
      routeId: match?.id ?? key,
      name: match?.name ?? 'Unmapped route',
      bookings: 1,
      revenue: toNumber(ticket.price),
    })
  })

  return [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}

/**
 * Fetch the sources in parallel and tolerate partial failure: a user
 * without `routes.read` should still see ticket KPIs rather than an error
 * page. `partial` tells the UI to caveat the numbers.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const listParams = { limit: MAX_PAGE_SIZE, page: 1 }

  const [ticketsResult, routesResult, tripsResult, carsResult, driversResult] =
    await Promise.allSettled([
      ticketsApi.list(listParams),
      routesApi.list({ ...listParams, status: 'active' }),
      tripsApi.list({ ...listParams, status: 'active' }),
      carsApi.list(listParams),
      driversApi.list({ ...listParams, status: 'active' }),
    ])

  const partial = [routesResult, tripsResult, carsResult, driversResult].some(
    (result) => result.status === 'rejected',
  )

  // A failed tickets call is fatal: every revenue KPI derives from it.
  if (ticketsResult.status === 'rejected') {
    throw ticketsResult.reason
  }

  const tickets = ticketsResult.value.items
  const routes = routesResult.status === 'fulfilled' ? routesResult.value.items : []

  /** Prefer meta.total (the true count) over the capped page length. */
  const totalOf = (result: PromiseSettledResult<{ meta: { total: number }; items: unknown[] }>) =>
    result.status === 'fulfilled' ? (result.value.meta.total ?? result.value.items.length) : 0

  const billable = tickets.filter((t) => t.status !== 'CANCELLED' && t.status !== 'REFUNDED')
  const totalRevenue = billable.reduce((sum, t) => sum + toNumber(t.price), 0)

  const todayStart = startOfToday()
  const seatsSoldToday = billable.filter((t) => {
    const time = new Date(t.createdAt).getTime()
    return !Number.isNaN(time) && time >= todayStart
  }).length

  const recentBookings = [...tickets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  return {
    totalBookings: ticketsResult.value.meta.total ?? tickets.length,
    totalRevenue,
    activeRoutes: totalOf(routesResult),
    activeTrips: totalOf(tripsResult),
    totalCars: totalOf(carsResult),
    activeDrivers: totalOf(driversResult),
    seatsSoldToday,
    currency: tickets.find((t) => t.currency)?.currency ?? 'RWF',
    revenueSeries: buildRevenueSeries(tickets),
    topRoutes: buildTopRoutes(tickets, routes),
    recentBookings,
    partial,
  }
}
