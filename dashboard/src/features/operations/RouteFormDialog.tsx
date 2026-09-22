import { useMemo } from 'react'
import { FieldArray, Form, Formik, useFormikContext } from 'formik'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import * as Yup from 'yup'
import { routesApi } from '@/api/resources'
import { useCreateResource, useUpdateResource } from '@/hooks/useResource'
import { FormInput } from '@/components/common/FormInput'
import { FormSelect } from '@/components/common/FormSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Location, RouteSegmentInput, TravelRoute } from '@/types/entities'

/**
 * Create and edit a route.
 *
 * A route is either DIRECT (one hop) or COMPOSITE (two or more DIRECT routes
 * chained together). The API enforces the composite rules strictly, so this
 * form mirrors every one of them rather than letting the user discover them
 * as 422s:
 *
 *  - COMPOSITE needs >= 2 segments; DIRECT must send none.
 *  - Sequence is positional: 1, 2, 3... consecutive, so it is derived from
 *    row order and never entered by hand.
 *  - Segments must be DIRECT routes; composites cannot nest.
 *  - No duplicates, and a route cannot contain itself.
 *  - The chain must run from the route's own origin to its destination, each
 *    leg starting where the previous one ended.
 */

const TYPE_CHOICES = [
  { label: 'Direct - a single hop', value: 'DIRECT' },
  { label: 'Composite - built from other routes', value: 'COMPOSITE' },
]

const STATUS_CHOICES = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
]

const Schema = Yup.object({
  name: Yup.string().trim().required('Route name is required'),
  routeType: Yup.string().oneOf(['DIRECT', 'COMPOSITE']).required('Route type is required'),
  fromLocationId: Yup.string().required('Origin is required'),
  toLocationId: Yup.string()
    .required('Destination is required')
    .notOneOf([Yup.ref('fromLocationId')], 'Destination must differ from origin'),
  distance: Yup.number()
    .typeError('Distance must be a number')
    .moreThan(0, 'Distance must be greater than 0')
    .required('Distance is required'),
  estimatedTimeInMinutes: Yup.number()
    .typeError('Duration must be a number')
    .integer('Duration must be a whole number')
    .moreThan(0, 'Duration must be greater than 0')
    .required('Duration is required'),
  latLong: Yup.string().nullable(),
  status: Yup.string().oneOf(['active', 'inactive']).required('Status is required'),
  segments: Yup.array().when('routeType', {
    is: 'COMPOSITE',
    then: (schema) =>
      schema
        .min(2, 'A composite route needs at least two segments')
        .of(
          Yup.object({
            segmentRouteId: Yup.string().trim().required('Choose a route'),
          }),
        )
        .test('no-duplicates', 'Each segment must be a different route', (value) => {
          const ids = (value ?? []).map((s) => s?.segmentRouteId).filter(Boolean)
          return new Set(ids).size === ids.length
        }),
    // Stripped for DIRECT: the API rejects a direct route carrying segments.
    otherwise: (schema) => schema.strip(),
  }),
})

interface FormValues {
  name: string
  routeType: string
  fromLocationId: string
  toLocationId: string
  distance: string
  estimatedTimeInMinutes: string
  latLong: string
  status: string
  segments: Array<{ segmentRouteId: string }>
}

/**
 * Live feedback on whether the chosen legs actually join up.
 *
 * The API rejects a broken chain with "Route segments must start and end at
 * the main route locations", which does not say WHERE it broke. This does.
 */
function ChainStatus({
  segments,
  fromLocationId,
  toLocationId,
  routeById,
  locationName,
}: {
  segments: Array<{ segmentRouteId: string }>
  fromLocationId: string
  toLocationId: string
  routeById: Map<string, TravelRoute>
  locationName: (id: string) => string
}) {
  const chosen = segments.map((s) => routeById.get(s.segmentRouteId)).filter(Boolean) as TravelRoute[]
  if (chosen.length < 2 || !fromLocationId || !toLocationId) return null

  if (chosen[0].fromLocationId !== fromLocationId) {
    return (
      <p className="text-xs font-medium text-destructive" role="alert">
        Segment 1 starts at {locationName(chosen[0].fromLocationId)}, but this route starts at{' '}
        {locationName(fromLocationId)}.
      </p>
    )
  }

  for (let i = 1; i < chosen.length; i += 1) {
    if (chosen[i].fromLocationId !== chosen[i - 1].toLocationId) {
      return (
        <p className="text-xs font-medium text-destructive" role="alert">
          Segment {i + 1} starts at {locationName(chosen[i].fromLocationId)}, but segment {i} ends
          at {locationName(chosen[i - 1].toLocationId)}.
        </p>
      )
    }
  }

  const last = chosen[chosen.length - 1]
  if (last.toLocationId !== toLocationId) {
    return (
      <p className="text-xs font-medium text-destructive" role="alert">
        The last segment ends at {locationName(last.toLocationId)}, but this route ends at{' '}
        {locationName(toLocationId)}.
      </p>
    )
  }

  const km = chosen.reduce((sum, r) => sum + Number(r.distance ?? 0), 0)
  const mins = chosen.reduce((sum, r) => sum + (r.estimatedTimeInMinutes ?? 0), 0)
  return (
    <p className="text-xs font-medium text-primary-hover">
      Chain is connected: {locationName(fromLocationId)} to {locationName(toLocationId)} -{' '}
      {km.toLocaleString()} km, {mins} min across {chosen.length} segments.
    </p>
  )
}

/** The segment rows, shown only for COMPOSITE. */
function SegmentBuilder({
  directRoutes,
  routeById,
  locationName,
  editingId,
}: {
  directRoutes: TravelRoute[]
  routeById: Map<string, TravelRoute>
  locationName: (id: string) => string
  editingId?: string
}) {
  const { values } = useFormikContext<FormValues>()

  if (values.routeType !== 'COMPOSITE') return null

  const options = directRoutes
    // A route cannot contain itself, and only DIRECT routes may be segments.
    .filter((r) => r.id !== editingId)
    .map((r) => ({
      label: `${r.name} (${locationName(r.fromLocationId)} to ${locationName(r.toLocationId)})`,
      value: r.id,
    }))

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Segments</p>
        <p className="text-xs text-muted-foreground">
          Two or more direct routes, in travel order. Each leg must start where the previous one
          ended.
        </p>
      </div>

      {options.length === 0 && (
        <p className="text-xs text-warning" role="alert">
          No direct routes exist yet. Create at least two before building a composite route.
        </p>
      )}

      <FieldArray name="segments">
        {({ push, remove }) => (
          <div className="space-y-2">
            {values.segments.map((segment, index) => {
              const route = routeById.get(segment.segmentRouteId)
              return (
                <div key={index} className="flex items-end gap-2">
                  <span
                    className="mb-2 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-light text-xs font-semibold text-primary-hover"
                    aria-hidden
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <FormSelect
                      name={`segments.${index}.segmentRouteId`}
                      label={index === 0 ? 'Route' : undefined}
                      options={options}
                      placeholder="Choose a direct route"
                    />
                    {route && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {locationName(route.fromLocationId)}
                        <ArrowRight className="size-3" aria-hidden />
                        {locationName(route.toLocationId)}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-2 size-8 shrink-0 text-destructive hover:bg-destructive/10"
                    onClick={() => remove(index)}
                    disabled={values.segments.length <= 2}
                    aria-label={`Remove segment ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => push({ segmentRouteId: '' })}
            >
              <Plus className="size-4" />
              Add segment
            </Button>
          </div>
        )}
      </FieldArray>

      <ChainStatus
        segments={values.segments}
        fromLocationId={values.fromLocationId}
        toLocationId={values.toLocationId}
        routeById={routeById}
        locationName={locationName}
      />
    </div>
  )
}

export interface RouteFormDialogProps {
  route: TravelRoute | null
  locations: Location[]
  /** All routes, used to offer DIRECT ones as segments. */
  routes: TravelRoute[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RouteFormDialog({
  route,
  locations,
  routes,
  open,
  onOpenChange,
}: RouteFormDialogProps) {
  const createRoute = useCreateResource(routesApi, 'Route')
  const updateRoute = useUpdateResource(routesApi, 'Route')

  const isEdit = Boolean(route)

  const locationOptions = useMemo(
    () => locations.map((l) => ({ label: l.name, value: l.id })),
    [locations],
  )
  const locationName = useMemo(() => {
    const byId = new Map(locations.map((l) => [l.id, l.name]))
    return (id: string) => byId.get(id) ?? id.slice(-6)
  }, [locations])

  const directRoutes = useMemo(() => routes.filter((r) => r.routeType === 'DIRECT'), [routes])
  const routeById = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit route' : 'New route'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this route and, for composites, the legs it is built from.'
              : 'A direct route is a single hop; a composite route chains existing direct routes.'}
          </DialogDescription>
        </DialogHeader>

        <Formik<FormValues>
          initialValues={{
            name: route?.name ?? '',
            routeType: route?.routeType ?? 'DIRECT',
            fromLocationId: route?.fromLocationId ?? '',
            toLocationId: route?.toLocationId ?? '',
            distance: route?.distance ?? '',
            estimatedTimeInMinutes:
              typeof route?.estimatedTimeInMinutes === 'number'
                ? String(route.estimatedTimeInMinutes)
                : '',
            latLong: route?.latLong ?? '',
            status: route?.status ?? 'active',
            segments:
              route?.segments && route.segments.length > 0
                ? [...route.segments]
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((s) => ({ segmentRouteId: s.segmentRouteId }))
                : [{ segmentRouteId: '' }, { segmentRouteId: '' }],
          }}
          validationSchema={Schema}
          enableReinitialize
          onSubmit={async (values) => {
            const isComposite = values.routeType === 'COMPOSITE'

            const payload: Record<string, unknown> = {
              name: values.name.trim(),
              routeType: values.routeType,
              fromLocationId: values.fromLocationId,
              toLocationId: values.toLocationId,
              distance: Number(values.distance).toFixed(2),
              estimatedTimeInMinutes: Number(values.estimatedTimeInMinutes),
              latLong: values.latLong ? values.latLong.trim() : null,
              status: values.status,
            }

            // Sequence is positional, so derive it from row order: the API
            // requires 1..n consecutive.
            if (isComposite) {
              payload.segments = values.segments.map(
                (s, i): RouteSegmentInput => ({
                  segmentRouteId: s.segmentRouteId,
                  sequence: i + 1,
                }),
              )
            }

            if (route) {
              await updateRoute.mutateAsync({ id: route.id, payload })
            } else {
              await createRoute.mutateAsync(payload)
            }
            onOpenChange(false)
          }}
        >
          {({ isSubmitting, values }) => (
            <Form className="space-y-4" noValidate>
              <FormInput name="name" label="Route name" required placeholder="Kigali to Huye" />

              <FormSelect
                name="routeType"
                label="Route type"
                required
                options={TYPE_CHOICES}
                hint={
                  values.routeType === 'COMPOSITE'
                    ? 'Built from two or more direct routes.'
                    : 'A single hop between two locations.'
                }
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelect
                  name="fromLocationId"
                  label="From"
                  required
                  options={locationOptions}
                  placeholder="Select origin"
                />
                <FormSelect
                  name="toLocationId"
                  label="To"
                  required
                  options={locationOptions}
                  placeholder="Select destination"
                />
              </div>

              <SegmentBuilder
                directRoutes={directRoutes}
                routeById={routeById}
                locationName={locationName}
                editingId={route?.id}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  name="distance"
                  label="Distance (km)"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                />
                <FormInput
                  name="estimatedTimeInMinutes"
                  label="Duration (minutes)"
                  type="number"
                  min="0"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput name="latLong" label="Lat/Long" hint="Optional." />
                <FormSelect name="status" label="Status" required options={STATUS_CHOICES} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {isEdit ? 'Save changes' : 'Create route'}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  )
}
