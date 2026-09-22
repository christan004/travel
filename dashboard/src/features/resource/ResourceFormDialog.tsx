import { useMemo } from 'react'
import { Form, Formik } from 'formik'
import { cn } from '@/lib/utils'
import { FormInput } from '@/components/common/FormInput'
import { FormSelect, type SelectOption } from '@/components/common/FormSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { FieldDef, LookupKey, ResourceConfig } from '@/features/resource/field-types'

export interface ResourceFormDialogProps<T> {
  config: ResourceConfig<T>
  /** null = create mode. */
  row: T | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: Record<string, unknown>, id?: string) => Promise<unknown>
  /** Options for each lookup field, keyed by lookup source. */
  lookupOptions: Partial<Record<LookupKey, SelectOption[]>>
  lookupsLoading: boolean
  /** Values already taken, per field name, for config.uniqueBy fields. */
  takenValues?: Record<string, Set<string>>
}

/** A copy of `set` without `keep`, so an edited row can keep its own value. */
function exclude(set: Set<string>, keep: string): Set<string> {
  if (!keep || !set.has(keep)) return set
  const copy = new Set(set)
  copy.delete(keep)
  return copy
}

const BOOLEAN_CHOICES: SelectOption[] = [
  { label: 'Yes', value: 'true' },
  { label: 'No', value: 'false' },
]

function renderField(
  field: FieldDef,
  lookupOptions: ResourceFormDialogProps<unknown>['lookupOptions'],
  taken: Set<string> | undefined,
  lookupsLoading: boolean,
) {
  const shared = {
    name: field.name,
    label: field.label,
    required: field.required,
    hint: field.hint,
  }

  switch (field.kind) {
    case 'select':
      return (
        <FormSelect
          key={field.name}
          {...shared}
          options={field.choices ?? []}
          placeholder={field.placeholder ?? 'Select'}
        />
      )

    case 'boolean':
      return (
        <FormSelect key={field.name} {...shared} options={BOOLEAN_CHOICES} placeholder="Select" />
      )

    case 'lookup': {
      const all = (field.lookup && lookupOptions[field.lookup]) ?? []
      // Grey out values already used by another record rather than letting
      // the user submit and collect a 409 from the API.
      const options = taken
        ? all.map((o) => (taken.has(o.value) ? { ...o, disabled: true } : o))
        : all
      return (
        <FormSelect
          key={field.name}
          {...shared}
          options={options}
          disabled={lookupsLoading}
          placeholder={
            lookupsLoading
              ? 'Loading...'
              : options.length === 0
                ? 'Nothing available'
                : (field.placeholder ?? 'Select')
          }
          hint={
            !lookupsLoading && options.length === 0
              ? 'No records exist yet - create one first.'
              : field.hint
          }
        />
      )
    }

    case 'datetime':
      // datetime-local gives a native picker; converted to ISO on submit.
      return <FormInput key={field.name} {...shared} type="datetime-local" />

    case 'number':
      return <FormInput key={field.name} {...shared} type="number" step="1" />

    case 'decimal':
      return <FormInput key={field.name} {...shared} type="number" step="0.01" />

    case 'email':
      return <FormInput key={field.name} {...shared} type="email" placeholder={field.placeholder} />

    case 'password':
      return (
        <FormInput
          key={field.name}
          {...shared}
          type="password"
          autoComplete="new-password"
          placeholder={field.placeholder}
        />
      )

    default:
      return <FormInput key={field.name} {...shared} placeholder={field.placeholder} />
  }
}

/** Create/edit dialog generated from a ResourceConfig. */
export function ResourceFormDialog<T extends { id: string }>({
  config,
  row,
  open,
  onOpenChange,
  onSubmit,
  lookupOptions,
  lookupsLoading,
  takenValues,
}: ResourceFormDialogProps<T>) {
  const isEdit = Boolean(row)

  const fields = config.fields.filter((field) =>
    isEdit ? !field.createOnly : !field.editOnly,
  )

  const createOnlyNames = useMemo(
    () => new Set(config.fields.filter((f) => f.createOnly).map((f) => f.name)),
    [config.fields],
  )

  const initialValues = isEdit && row ? config.toFormValues(row) : config.emptyValues

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${config.label.toLowerCase()}` : `New ${config.label.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update this ${config.label.toLowerCase()}.`
              : `Add a new ${config.label.toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={initialValues}
          validationSchema={config.validation}
          enableReinitialize
          onSubmit={async (values) => {
            // Drop createOnly fields on edit. They stay in initialValues (so
            // toFormValues need not special-case them), but a PATCH that
            // carries an immutable field is rejected outright by strict
            // endpoints - /trips refuses routeId and departureAt with
            // "Unrecognized key".
            const submitted = isEdit
              ? Object.fromEntries(
                  Object.entries(values).filter(([key]) => !createOnlyNames.has(key)),
                )
              : values

            await onSubmit(config.toPayload(submitted), row?.id)
            onOpenChange(false)
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.name} className={cn(!field.half && 'sm:col-span-2')}>
                    {renderField(
                      field,
                      lookupOptions,
                      // The row being edited keeps its own value selectable.
                      takenValues?.[field.name] &&
                        exclude(
                          takenValues[field.name],
                          row ? String((row as Record<string, unknown>)[field.name] ?? '') : '',
                        ),
                      lookupsLoading,
                    )}
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {isEdit ? 'Save changes' : `Create ${config.label.toLowerCase()}`}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  )
}
