import { Form, Formik } from 'formik'
import * as Yup from 'yup'
import { toNumber } from '@/lib/utils'
import { baggageApi } from '@/api/resources'
import { useUpdateResource } from '@/hooks/useResource'
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
import type { Baggage, Car } from '@/types/entities'

/**
 * PATCH /api/v1/baggage/{id} accepts ONLY `maxWeight` and `status`, and its
 * body is strict: `number` and `carId` come back as "Unrecognized key" and
 * fail the whole request. So the form exposes just those two, and shows the
 * slot number and vehicle as read-only context.
 */
const EditSchema = Yup.object({
  maxWeight: Yup.number()
    .typeError('Max weight must be a number')
    .moreThan(0, 'Max weight must be greater than 0')
    .required('Max weight is required'),
  status: Yup.string().oneOf(['active', 'inactive']).required('Status is required'),
})

export interface BaggageEditDialogProps {
  baggage: Baggage | null
  /** Resolved vehicle, for read-only context. Null when outside the lookup page. */
  car: Car | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BaggageEditDialog({
  baggage,
  car,
  open,
  onOpenChange,
}: BaggageEditDialogProps) {
  const updateBaggage = useUpdateResource(baggageApi, 'Compartment')

  if (!baggage) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit compartment</DialogTitle>
          <DialogDescription>
            Slot {baggage.number}
            {car ? (
              <>
                {' '}
                on {car.model} (<span className="font-mono">{car.plateNumber}</span>)
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{
            maxWeight: baggage.maxWeight,
            status: baggage.status as string,
          }}
          validationSchema={EditSchema}
          enableReinitialize
          onSubmit={async (values) => {
            // Send only what changed: the API requires at least one field and
            // rejects anything outside maxWeight/status.
            const payload: Record<string, unknown> = {}
            if (Number(values.maxWeight) !== toNumber(baggage.maxWeight)) {
              payload.maxWeight = Number(values.maxWeight).toFixed(2)
            }
            if (values.status !== baggage.status) {
              payload.status = values.status
            }

            if (Object.keys(payload).length === 0) {
              onOpenChange(false)
              return
            }

            await updateBaggage.mutateAsync({ id: baggage.id, payload })
            onOpenChange(false)
          }}
        >
          {({ isSubmitting, values }) => {
            const unchanged =
              Number(values.maxWeight) === toNumber(baggage.maxWeight) &&
              values.status === baggage.status

            return (
              <Form className="space-y-4" noValidate>
                <FormInput
                  name="maxWeight"
                  label="Max weight (kg)"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="25.00"
                />

                <FormSelect
                  name="status"
                  label="Status"
                  required
                  options={[
                    { label: 'Active', value: 'active' },
                    { label: 'Inactive', value: 'inactive' },
                  ]}
                  hint="Inactive compartments stay on the vehicle but are out of service."
                />

                <p className="text-xs text-muted-foreground">
                  The slot number and vehicle cannot be changed after creation.
                </p>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={isSubmitting} disabled={unchanged}>
                    Save changes
                  </Button>
                </DialogFooter>
              </Form>
            )
          }}
        </Formik>
      </DialogContent>
    </Dialog>
  )
}
