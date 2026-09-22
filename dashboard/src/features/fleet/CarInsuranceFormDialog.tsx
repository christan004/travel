import { Form, Formik } from 'formik'
import * as Yup from 'yup'
import { carInsuranceItemApi } from '@/api/resources'
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
import type { CarInsurance, InsuranceStatus } from '@/types/entities'

/**
 * Create and edit an insurance policy.
 *
 * Two things drive the shape of this form:
 *
 * 1. `carId` is required by BOTH POST and PATCH. Most resources let you PATCH
 *    a single field; this one rejects any body without `carId`, so every edit
 *    resends it even when the vehicle has not changed.
 * 2. Status is `active` | `expired`, not the `active` | `inactive` used
 *    elsewhere in the app. "inactive" is rejected outright.
 */
const STATUS_CHOICES = [
  { label: 'Active', value: 'active' },
  { label: 'Expired', value: 'expired' },
]

const Schema = Yup.object({
  carId: Yup.string().trim().required('Vehicle is required'),
  name: Yup.string().trim().required('Policy name is required'),
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

export interface CarInsuranceFormDialogProps {
  /** Null creates; a policy edits it. */
  policy: (CarInsurance & { carId: string }) | null
  /** Vehicle options, labelled for humans. */
  carOptions: Array<{ label: string; value: string }>
  /** Preselected vehicle when creating from a car's own card. */
  defaultCarId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CarInsuranceFormDialog({
  policy,
  carOptions,
  defaultCarId,
  open,
  onOpenChange,
}: CarInsuranceFormDialogProps) {
  const createPolicy = useCreateResource(carInsuranceItemApi, 'Policy')
  const updatePolicy = useUpdateResource(carInsuranceItemApi, 'Policy')

  const isEdit = Boolean(policy)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit policy' : 'Add insurance policy'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this policy and the vehicle it covers.'
              : 'Cover a vehicle for a fixed validity window.'}
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{
            carId: policy?.carId ?? defaultCarId ?? '',
            name: policy?.name ?? '',
            validFrom: isoToLocalInput(policy?.validFrom) || '',
            validTo: isoToLocalInput(policy?.validTo) || '',
            status: (policy?.status ?? 'active') as string,
          }}
          validationSchema={Schema}
          enableReinitialize
          onSubmit={async (values) => {
            // carId goes on every request, including edits: PATCH rejects a
            // body without it.
            const payload = {
              carId: values.carId,
              name: String(values.name).trim(),
              validFrom: localInputToIso(values.validFrom),
              validTo: localInputToIso(values.validTo),
              status: values.status as InsuranceStatus,
            }

            if (policy) {
              await updatePolicy.mutateAsync({ id: policy.id, payload })
            } else {
              await createPolicy.mutateAsync(payload)
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
                hint={
                  isEdit
                    ? 'Moving a policy to another vehicle is allowed.'
                    : undefined
                }
              />

              <FormInput
                name="name"
                label="Policy name"
                required
                placeholder="Comprehensive Insurance"
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
                hint="Policies are active or expired - there is no inactive state."
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {isEdit ? 'Save changes' : 'Add policy'}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  )
}
