import { FieldArray, Form, Formik, type FormikErrors } from 'formik'
import * as Yup from 'yup'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { carsApi, baggageApi } from '@/api/resources'
import { useCreateResource, useLookup } from '@/hooks/useResource'
import { FormInput } from '@/components/common/FormInput'
import { FormSelect } from '@/components/common/FormSelect'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BaggageType, CreateBaggagePayload } from '@/types/entities'

interface BaggageFormValues {
  carId: string
  type: BaggageType
  /** Used when type is SOME_WEIGHT. */
  maxWeight: string
  /** Used when type is DIFFERENT_WEIGHT. */
  weights: Array<{ maxWeight: string; status: string }>
}

/**
 * The API discriminates on `type`, so each mode validates only its own
 * fields: requiring `maxWeight` in DIFFERENT_WEIGHT mode (or vice versa)
 * would block a legitimate submit.
 */
const BaggageSchema = Yup.object({
  carId: Yup.string().trim().matches(/^[cC][0-9a-z]{6,}$/, 'Select a vehicle').required('Vehicle is required'),
  type: Yup.string().oneOf(['SOME_WEIGHT', 'DIFFERENT_WEIGHT']).required(),

  maxWeight: Yup.string().when('type', {
    is: 'SOME_WEIGHT',
    then: (schema) =>
      schema
        .required('Max weight is required')
        .test('positive', 'Max weight must be greater than 0', (v) => Number(v) > 0)
        .test('numeric', 'Max weight must be a number', (v) => !Number.isNaN(Number(v))),
    otherwise: (schema) => schema.strip(),
  }),

  weights: Yup.array().when('type', {
    is: 'DIFFERENT_WEIGHT',
    then: (schema) =>
      schema
        .of(
          Yup.object({
            maxWeight: Yup.string()
              .required('Required')
              .test('positive', 'Must be > 0', (v) => Number(v) > 0)
              .test('numeric', 'Must be a number', (v) => !Number.isNaN(Number(v))),
            status: Yup.string().oneOf(['active', 'inactive']).required(),
          }),
        )
        .min(1, 'Add at least one compartment')
        .required(),
    otherwise: (schema) => schema.strip(),
  }),
})

export interface BaggageFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Creates luggage capacity for a vehicle.
 *
 * POST /api/v1/baggage takes one of two shapes, discriminated by `type`:
 *
 *   SOME_WEIGHT      { carId, type, maxWeight }
 *   DIFFERENT_WEIGHT { carId, type, weights: [{ maxWeight, status? }] }
 *
 * The API expands either into one Baggage row per compartment, and rejects a
 * request that would exceed the car's `totalWeightSlots` with a
 * BUSINESS_RULE_VIOLATION. SOME_WEIGHT fills every slot the car declares, so
 * the count is implied rather than supplied.
 */
export function BaggageFormDialog({ open, onOpenChange }: BaggageFormDialogProps) {
  const createBaggage = useCreateResource(baggageApi, 'Baggage')
  const { data: carsPage, isLoading: loadingCars } = useLookup(carsApi)

  const carById = new Map((carsPage?.items ?? []).map((car) => [car.id, car]))
  const carOptions = (carsPage?.items ?? []).map((car) => ({
    label: `${car.model} - ${car.plateNumber}`,
    value: car.id,
  }))

  const initialValues: BaggageFormValues = {
    carId: '',
    type: 'SOME_WEIGHT',
    maxWeight: '',
    weights: [{ maxWeight: '', status: 'active' }],
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add baggage</DialogTitle>
          <DialogDescription>
            Define the luggage compartments for a vehicle.
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={initialValues}
          validationSchema={BaggageSchema}
          onSubmit={async (values) => {
            // Build exactly the shape the discriminated union expects; sending
            // the unused branch's fields risks a strict-schema rejection.
            const payload: CreateBaggagePayload =
              values.type === 'SOME_WEIGHT'
                ? {
                    carId: values.carId,
                    type: 'SOME_WEIGHT',
                    maxWeight: Number(values.maxWeight).toFixed(2),
                  }
                : {
                    carId: values.carId,
                    type: 'DIFFERENT_WEIGHT',
                    weights: values.weights.map((weight) => ({
                      maxWeight: Number(weight.maxWeight).toFixed(2),
                      status: weight.status as 'active' | 'inactive',
                    })),
                  }

            await createBaggage.mutateAsync(payload as unknown as Record<string, unknown>)
            onOpenChange(false)
          }}
        >
          {({ values, isSubmitting, errors, touched }) => {
            // The API caps compartments at the car's declared slot count and
            // rejects anything over it, so show the limit up front.
            const slots = carById.get(values.carId)?.totalWeightSlots
            const overSlots =
              typeof slots === 'number' &&
              values.type === 'DIFFERENT_WEIGHT' &&
              values.weights.length > slots

            return (
            <Form className="space-y-4" noValidate>
              <FormSelect
                name="carId"
                label="Vehicle"
                required
                options={carOptions}
                disabled={loadingCars}
                placeholder={loadingCars ? 'Loading...' : 'Select a vehicle'}
                hint={
                  typeof slots === 'number'
                    ? `This vehicle declares ${slots} baggage slot${slots === 1 ? '' : 's'}.`
                    : undefined
                }
              />

              <FormSelect
                name="type"
                label="Weight type"
                required
                options={[
                  { label: 'Same weight for every compartment', value: 'SOME_WEIGHT' },
                  { label: 'Different weight per compartment', value: 'DIFFERENT_WEIGHT' },
                ]}
              />

              {values.type === 'SOME_WEIGHT' ? (
                <FormInput
                  name="maxWeight"
                  label="Max weight (kg)"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="25.00"
                  hint={
                    typeof slots === 'number'
                      ? `Applied to all ${slots} compartment${slots === 1 ? '' : 's'}.`
                      : 'Applied to every compartment on this vehicle.'
                  }
                />
              ) : (
                <FieldArray name="weights">
                  {({ push, remove }) => (
                    <div className="space-y-2">
                      <Label>
                        Compartments<span className="ml-0.5 text-destructive">*</span>
                      </Label>

                      {values.weights.map((_, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <FormInput
                            name={`weights.${index}.maxWeight`}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="10.00"
                            containerClassName="flex-1"
                          />
                          <FormSelect
                            name={`weights.${index}.status`}
                            options={[
                              { label: 'Active', value: 'active' },
                              { label: 'Inactive', value: 'inactive' },
                            ]}
                            containerClassName="w-36"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            // Never let the array empty: the API requires >= 1.
                            disabled={values.weights.length === 1}
                            onClick={() => remove(index)}
                            aria-label={`Remove compartment ${index + 1}`}
                            className={cn(
                              'shrink-0 text-muted-foreground hover:text-destructive',
                              values.weights.length === 1 && 'opacity-40',
                            )}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}

                      {/* A whole-array error (e.g. min 1) has no field to attach to. */}
                      {typeof errors.weights === 'string' && touched.weights && (
                        <p role="alert" className="text-xs font-medium text-destructive">
                          {errors.weights as string}
                        </p>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => push({ maxWeight: '', status: 'active' })}
                      >
                        <Plus className="size-4" />
                        Add compartment
                      </Button>

                      {overSlots ? (
                        <p role="alert" className="text-xs font-medium text-destructive">
                          This vehicle declares only {slots} slot{slots === 1 ? '' : 's'}. The
                          API will reject {values.weights.length} compartments.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Each compartment carries its own weight limit.
                        </p>
                      )}
                    </div>
                  )}
                </FieldArray>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  Add baggage
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

/** Narrow Formik's error shape for the weights array. */
export type BaggageFormErrors = FormikErrors<BaggageFormValues>
