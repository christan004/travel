import { useMemo, useState } from 'react'
import { Mail, Phone, Search, X } from 'lucide-react'
import { formatCurrency, formatDate, initials } from '@/lib/utils'
import { usePassengers } from '@/hooks/usePassengers'
import { ticketsApi } from '@/api/resources'
import { useResourceList } from '@/hooks/useResource'
import type { Passenger } from '@/types/entities'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

const PAGE_SIZE = 20

/**
 * Booking history for a passenger.
 *
 * The API has no "tickets for passenger" endpoint, so history is matched on
 * phone number against the bookings page already in cache. That is the only
 * field the two resources share.
 */
function PassengerDetailDialog({
  passenger,
  open,
  onOpenChange,
}: {
  passenger: Passenger | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: ticketsPage, isLoading } = useResourceList(ticketsApi, { limit: 100 })

  const history = useMemo(() => {
    if (!passenger) return []
    return (ticketsPage?.items ?? []).filter(
      (ticket) => ticket.passengerPhone === passenger.phoneNumber,
    )
  }, [ticketsPage?.items, passenger])

  if (!passenger) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{passenger.names}</DialogTitle>
          <DialogDescription>Customer since {formatDate(passenger.createdAt)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-4" />
            {passenger.phoneNumber}
          </span>
          {passenger.email && (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" />
              {passenger.email}
            </span>
          )}
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold text-foreground">Booking history</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Matched on phone number across the most recent bookings.
          </p>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No bookings found for this passenger.
            </p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {history.map((ticket) => (
                <li
                  key={ticket.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-foreground">
                      {ticket.ticketNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(ticket.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">
                      {formatCurrency(ticket.price, ticket.currency ?? 'RWF')}
                    </span>
                    <StatusBadge status={ticket.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PassengersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Passenger | null>(null)

  const { data, isLoading, error, refetch } = usePassengers({ page, limit: PAGE_SIZE })

  const rows = useMemo(() => {
    const items = data?.items ?? []
    const term = search.trim().toLowerCase()
    if (!term) return items

    return items.filter(
      (passenger) =>
        passenger.names.toLowerCase().includes(term) ||
        passenger.phoneNumber.toLowerCase().includes(term) ||
        (passenger.email ?? '').toLowerCase().includes(term),
    )
  }, [data?.items, search])

  const columns = useMemo<Array<Column<Passenger>>>(
    () => [
      {
        id: 'name',
        header: 'Passenger',
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-[11px]">{initials(row.names)}</AvatarFallback>
            </Avatar>
            <p className="truncate font-medium text-foreground">{row.names}</p>
          </div>
        ),
      },
      {
        id: 'phone',
        header: 'Phone',
        cell: (row) => <span className="text-muted-foreground">{row.phoneNumber}</span>,
      },
      {
        id: 'email',
        header: 'Email',
        cell: (row) =>
          row.email ? (
            <span className="truncate text-muted-foreground">{row.email}</span>
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
      {
        id: 'joined',
        header: 'Joined',
        cell: (row) => <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>,
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passengers"
        description="Customers who have travelled with you."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this page..."
            aria-label="Search passengers on the current page"
            className="pl-9"
          />
        </div>

        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        onRowClick={setSelected}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={search ? 'No matching passengers' : 'No passengers yet'}
        emptyDescription={
          search
            ? 'Try a different search term.'
            : 'Passengers appear here once they hold a ticket with your company.'
        }
      />

      <PassengerDetailDialog
        passenger={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  )
}
