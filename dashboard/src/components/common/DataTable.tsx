import type { ReactNode } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ApiMeta } from '@/lib/axios'

export interface Column<T> {
  /** Stable key, also used as the React key for cells. */
  id: string
  header: ReactNode
  /** Renders the cell. Kept as a render fn so columns stay declarative. */
  cell: (row: T) => ReactNode
  className?: string
  headerClassName?: string
}

export interface DataTableProps<T> {
  columns: Array<Column<T>>
  rows: T[]
  getRowId: (row: T) => string
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
  onRowClick?: (row: T) => void
  meta?: ApiMeta
  onPageChange?: (page: number) => void
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  /** Rows of shimmer to show while loading. */
  skeletonRows?: number
  className?: string
}

/**
 * Generic table with built-in loading, empty, error and pagination states.
 *
 * It is intentionally presentational: data fetching stays in the React Query
 * hook that owns it, and this component only renders what it is handed.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading = false,
  error = null,
  onRetry,
  onRowClick,
  meta,
  onPageChange,
  emptyTitle = 'Nothing to show yet',
  emptyDescription = 'Records will appear here once they exist.',
  emptyAction,
  skeletonRows = 6,
  className,
}: DataTableProps<T>) {
  const colSpan = columns.length

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-card', className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {columns.map((column) => (
              <TableHead key={column.id} className={column.headerClassName}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading &&
            Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableCell key={column.id}>
                    <Skeleton className="h-4 w-[70%]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && error && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colSpan} className="py-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
                    <AlertCircle className="size-5 text-destructive" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Could not load this data</p>
                    <p className="mt-0.5 max-w-sm text-sm text-muted-foreground">{error.message}</p>
                  </div>
                  {onRetry && (
                    <Button variant="outline" size="sm" onClick={onRetry}>
                      Try again
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !error && rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colSpan} className="py-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary-light">
                    <Inbox className="size-5 text-primary" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
                    <p className="mt-0.5 max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
                  </div>
                  {emptyAction}
                </div>
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            !error &&
            rows.map((row) => (
              <TableRow
                key={getRowId(row)}
                // Ignore clicks that came from something interactive inside
                // the row - a row-actions menu, a toggle, a link. Without
                // this, opening the Edit menu also fires the row click and
                // the detail dialog appears on top of the edit form.
                onClick={
                  onRowClick
                    ? (event) => {
                        const target = event.target as HTMLElement | null
                        if (
                          target?.closest(
                            'button, a, input, select, textarea, [role="menu"], [role="menuitem"], [role="dialog"]',
                          )
                        ) {
                          return
                        }
                        onRowClick(row)
                      }
                    : undefined
                }
                // Rows become keyboard-operable only when they are clickable.
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
                className={cn(onRowClick && 'cursor-pointer focus-visible:bg-primary-light')}
              >
                {columns.map((column) => (
                  <TableCell key={column.id} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {meta && onPageChange && !error && meta.total > 0 && (
        <TablePagination meta={meta} onPageChange={onPageChange} disabled={isLoading} />
      )}
    </div>
  )
}

function TablePagination({
  meta,
  onPageChange,
  disabled,
}: {
  meta: ApiMeta
  onPageChange: (page: number) => void
  disabled?: boolean
}) {
  const from = (meta.page - 1) * meta.limit + 1
  const to = Math.min(meta.page * meta.limit, meta.total)

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>-
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{meta.total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="px-1 text-xs text-muted-foreground">
          Page {meta.page} of {Math.max(meta.totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
