import { useField } from 'formik'
import { cn } from '@/lib/utils'
import { Input, type InputProps } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface FormInputProps extends Omit<InputProps, 'name'> {
  name: string
  label?: string
  /** Helper text shown when there is no error to display. */
  hint?: string
  containerClassName?: string
}

/**
 * Formik-bound input with consistent label, error and hint treatment.
 *
 * Errors surface only after the field is touched, so a pristine form does
 * not greet the user with red text.
 */
export function FormInput({
  name,
  label,
  hint,
  className,
  containerClassName,
  required,
  ...props
}: FormInputProps) {
  const [field, meta] = useField(name)
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

      <Input
        id={name}
        aria-invalid={showError}
        aria-describedby={showError ? errorId : hint ? hintId : undefined}
        className={cn(showError && 'border-destructive', className)}
        {...field}
        // Formik supplies '' for empty; never hand React an undefined value.
        value={field.value ?? ''}
        {...props}
      />

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
