import { Form, Formik } from 'formik'
import * as Yup from 'yup'
import { rolesApi } from '@/api/resources'
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
import type { Role } from '@/types/entities'

/**
 * Create or rename a role.
 *
 * Permissions are deliberately absent: POST accepts a `permissions` key but
 * ignores it, so a new role is always created empty and its permissions are
 * assigned afterwards through PUT /roles/{id}/permissions. The page opens the
 * permissions dialog straight after a create so that is not a hidden step.
 */
const Schema = Yup.object({
  name: Yup.string().trim().required('Role name is required'),
  isActive: Yup.string().oneOf(['true', 'false']).required('Status is required'),
})

const STATUS_CHOICES = [
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

export interface RoleFormDialogProps {
  role: Role | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the new role so the caller can open the permissions picker. */
  onCreated?: (role: Role) => void
}

export function RoleFormDialog({ role, open, onOpenChange, onCreated }: RoleFormDialogProps) {
  const createRole = useCreateResource(rolesApi, 'Role')
  const updateRole = useUpdateResource(rolesApi, 'Role')

  const isEdit = Boolean(role)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit role' : 'New role'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Rename this role or take it out of service.'
              : 'Create the role, then choose its permissions.'}
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{
            name: role?.name ?? '',
            isActive: String(role?.isActive ?? true),
          }}
          validationSchema={Schema}
          enableReinitialize
          onSubmit={async (values, { setFieldError }) => {
            const payload = {
              name: values.name.trim(),
              isActive: values.isActive === 'true',
            }

            try {
              if (role) {
                await updateRole.mutateAsync({ id: role.id, payload })
              } else {
                const created = (await createRole.mutateAsync(payload)) as Role
                onCreated?.(created)
              }
              onOpenChange(false)
            } catch (error) {
              // Role names are unique per company; surface that on the field
              // rather than as a bare "already exists" toast.
              const message = error instanceof Error ? error.message : ''
              if (/already exists/i.test(message)) {
                setFieldError('name', 'A role with this name already exists')
                return
              }
              throw error
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4" noValidate>
              <FormInput
                name="name"
                label="Role name"
                required
                placeholder="Fleet Manager"
                autoComplete="off"
              />

              <FormSelect
                name="isActive"
                label="Status"
                required
                options={STATUS_CHOICES}
                hint="Inactive roles stay on record but should not be assigned."
              />

              {!isEdit && (
                <p className="text-xs text-muted-foreground">
                  The role starts with no permissions. You will be asked to choose them next.
                </p>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {isEdit ? 'Save changes' : 'Create role'}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  )
}
