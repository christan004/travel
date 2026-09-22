import { useField, useFormikContext } from 'formik'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface SelectOption {
  label: string
  value: string
  disabled?: boolean
}

export interface FormSelectProps {
  name: string
  label?: string
  placeholder?: string
  options: SelectOption[]
  hint?: string
  required?: boolean
  disabled?: boolean
  containerClassName?: string
}

/**
 * Formik-bound select built on the Radix primitive.
 *
 * Radix is uncontrolled-by-callback rather than event-based, so this wires
 * onValueChange to setFieldValue and marks the field touched manually.
 */
export function FormSelect({
  name,
  label,
  placeholder = 'Select an option',
  options,
  hint,
  required,
  disabled,
  containerClassName,
}: FormSelectProps) {
  const [field, meta] = useField(name)
  const { setFieldValue, setFieldTouched } = useFormikContext()

  const showError = Boolean(meta.touched && meta.error)
  const errorId = `${name}-error`
  const hintId = `${name}-hint`

  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <Label htmlFor={name}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}

      <Select
        // Radix treats '' as "no selection"; undefined would make it uncontrolled.
        value={field.value ? String(field.value) : undefined}
        disabled={disabled}
        onValueChange={(value) => {
          void setFieldValue(name, value)
          void setFieldTouched(name, true, false)
        }}
      >
        <SelectTrigger
          id={name}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : hint ? hintId : undefined}
          className={cn(showError && 'border-destructive')}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showError ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {meta.error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
