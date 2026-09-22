import { Form, Formik } from 'formik'
import * as Yup from 'yup'
import { carControlsApi } from '@/api/resources'
import { useCreateResource, useUpdateResource } from '@/hooks/useResource'
import { isoToLocalInput, localInputToIso } from '@/features/resource/shared'
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
import type { CarControl, InsuranceStatus } from '@/types/entities'

/**
 * Create and edit a technical inspection.
 *
 * PATCH here is a real partial update - unlike car insurance, which demands
 * `carId` on every call - so edits send only the fields that actually
 * changed, and an unchanged form is a no-op rather than a redundant write.
 *
 * Status is `active` | `expired`, matching insurance. "inactive" is rejected.
 */
const STATUS_CHOICES = [
  { label: 'Active', value: 'active' },
  { label: 'Expired', value: 'expired' },
]

const Schema = Yup.object({
  carId: Yup.string().trim().required('Vehicle is required'),
  location: Yup.string().trim().required('Inspection centre is required'),
  validFrom: Yup.string().required('Valid from is required'),
  validTo: Yup.string()
    .required('Valid to is required')
    .test('after-from', 'End date must be after the start date', function (value) {
      const from = this.parent.validFrom
      if (!value || !from) return true
      return new Date(value).getTime() > new Date(from).getTime()
    }),
  status: Yup.string().oneOf(['active', 'expired']).required('Status is required'),
})

export interface CarControlFormDialogProps {
  /** Null creates; a record edits it. */
  control: CarControl | null
  carOptions: Array<{ label: string; value: string }>
  /** Preselected vehicle when creating with a vehicle filter applied. */
  defaultCarId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CarControlFormDialog({
  control,
  carOptions,
  defaultCarId,
  open,
  onOpenChange,
}: CarControlFormDialogProps) {
  const createControl = useCreateResource(carControlsApi, 'Inspection')
  const updateControl = useUpdateResource(carControlsApi, 'Inspection')

  const isEdit = Boolean(control)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit inspection' : 'Add inspection'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this inspection and its validity window.'
              : 'Record a technical inspection and how long it stays valid.'}
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{
            carId: control?.carId ?? defaultCarId ?? '',
            location: control?.location ?? '',
            validFrom: isoToLocalInput(control?.validFrom) || '',
            validTo: isoToLocalInput(control?.validTo) || '',
            status: (control?.status ?? 'active') as string,
          }}
          validationSchema={Schema}
          enableReinitialize
          onSubmit={async (values) => {
            const validFrom = localInputToIso(values.validFrom)
            const validTo = localInputToIso(values.validTo)
            const location = String(values.location).trim()
            const status = values.status as InsuranceStatus

            if (control) {
              // Partial update: send only what changed. An empty body is
              // rejected with "At least one field is required", so an
              // unchanged form just closes.
              const payload: Record<string, unknown> = {}
              if (values.carId !== control.carId) payload.carId = values.carId
              if (location !== control.location) payload.location = location
              if (validFrom !== control.validFrom) payload.validFrom = validFrom
              if (validTo !== control.validTo) payload.validTo = validTo
              if (status !== control.status) payload.status = status

              if (Object.keys(payload).length === 0) {
                onOpenChange(false)
                return
              }

              await updateControl.mutateAsync({ id: control.id, payload })
            } else {
              await createControl.mutateAsync({
                carId: values.carId,
                location,
                validFrom,
                validTo,
                status,
              })
            }
            onOpenChange(false)
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <FormSelect
                name="carId"
                label="Vehicle"
                required
                options={carOptions}
                placeholder="Select a vehicle"
              />

              <FormInput
                name="location"
                label="Inspection centre"
                required
                placeholder="Remera Inspection Centre"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput name="validFrom" label="Valid from" type="datetime-local" required />
                <FormInput name="validTo" label="Valid to" type="datetime-local" required />
              </div>

              <FormSelect
                name="status"
                label="Status"
                required
                options={STATUS_CHOICES}
                hint="Inspections are active or expired - there is no inactive state."
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {isEdit ? 'Save changes' : 'Add inspection'}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  )
}
