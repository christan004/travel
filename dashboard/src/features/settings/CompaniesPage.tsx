import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Form, Formik } from 'formik'
import * as Yup from 'yup'
import { Building2, Eye, EyeOff, Plus, Search, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { createCompany, listCompanies } from '@/api/auth'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FormInput } from '@/components/common/FormInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Company } from '@/types/entities'

/**
 * Every company on the platform, and the form to add one.
 *
 * SUPER ADMIN ONLY. Both GET and POST /companies answer 403 for a company
 * admin - they manage their own tenant through Settings, which uses
 * /companies/current instead.
 *
 * Creating a company also provisions its main branch and first admin user in
 * the same call, so the form collects both. There is no edit here: PATCH
 * /companies/{id} returns 404 even for a super admin, and the only working
 * update path is a company editing itself.
 */
const Schema = Yup.object({
  name: Yup.string().trim().max(191).required('Company name is required'),
  email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
  phone: Yup.string().trim().max(191).required('Phone is required'),
  supportingPhone: Yup.string().trim().max(191),
  tinNumber: Yup.string().trim().max(191).required('TIN is required'),
  address: Yup.string().trim().max(191).required('Address is required'),
  adminFirstName: Yup.string().trim().required('First name is required'),
  adminLastName: Yup.string().trim().required('Last name is required'),
  adminEmail: Yup.string().trim().email('Enter a valid email').required('Admin email is required'),
  adminPhone: Yup.string().trim().required('Admin phone is required'),
  // The API rejects anything shorter, the same rule as sign-in.
  adminPassword: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
})

function CreateCompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)

  const create = useMutation({
    mutationFn: createCompany,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success(
        `${result.company.name} created` +
          (result.admin ? ` with admin ${result.admin.email}` : ''),
      )
      onOpenChange(false)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not create the company'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription>
            This creates the company, its main branch and its first admin user together.
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{
            name: '',
            email: '',
            phone: '',
            supportingPhone: '',
            tinNumber: '',
            address: '',
            adminFirstName: '',
            adminLastName: '',
            adminEmail: '',
            adminPhone: '',
            adminPassword: '',
          }}
          validationSchema={Schema}
          onSubmit={async (values) => {
            await create.mutateAsync({
              name: values.name.trim(),
              email: values.email.trim(),
              phone: values.phone.trim(),
              supportingPhone: values.supportingPhone.trim() || undefined,
              tinNumber: values.tinNumber.trim(),
              address: values.address.trim(),
              admin: {
                firstName: values.adminFirstName.trim(),
                lastName: values.adminLastName.trim(),
                email: values.adminEmail.trim(),
                phone: values.adminPhone.trim(),
                password: values.adminPassword,
              },
            })
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-5" noValidate>
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Company</h3>

                <FormInput name="name" label="Company name" required placeholder="Kigali Transit Ltd" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormInput name="email" type="email" label="Email" required />
                  <FormInput name="phone" label="Phone" required placeholder="+250788123456" />
                  <FormInput name="supportingPhone" label="Support phone" />
                  <FormInput name="tinNumber" label="TIN number" required />
                </div>

                <FormInput name="address" label="Address" required placeholder="KN 5 Road, Kigali" />
                <p className="text-xs text-muted-foreground">
                  The company&apos;s admin uploads a logo from their own Settings page.
                </p>
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-background p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">First admin</h3>
                  <p className="text-xs text-muted-foreground">
                    This person signs in and sets up the rest of the company.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormInput name="adminFirstName" label="First name" required />
                  <FormInput name="adminLastName" label="Last name" required />
                  <FormInput name="adminEmail" type="email" label="Email" required />
                  <FormInput name="adminPhone" label="Phone" required />
                </div>

                <div className="relative">
                  <FormInput
                    name="adminPassword"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                    hint="At least 8 characters. Share it with them securely."
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    // Offset clears the label above and any message below.
                    className="absolute right-3 top-[2.05rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </section>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  Create company
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  )
}

export function CompaniesPage() {
  const { isSuperAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    enabled: isSuperAdmin,
  })

  const rows = useMemo(() => {
    const items = data ?? []
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (company) =>
        company.name.toLowerCase().includes(term) ||
        company.email.toLowerCase().includes(term) ||
        company.tinNumber.includes(term),
    )
  }, [data, search])

  const columns = useMemo<Array<Column<Company>>>(
    () => [
      {
        id: 'name',
        header: 'Company',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Phone',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{row.phone}</p>
            {row.supportingPhone && (
              <p className="truncate text-xs text-muted-foreground">{row.supportingPhone}</p>
            )}
          </div>
        ),
      },
      { id: 'tin', header: 'TIN', cell: (row) => <span className="tabular-nums">{row.tinNumber}</span> },
      {
        id: 'address',
        header: 'Address',
        cell: (row) => <span className="text-muted-foreground">{row.address}</span>,
      },
      {
        id: 'size',
        header: 'Users / branches',
        cell: (row) =>
          row._count ? (
            <span className="text-sm tabular-nums text-foreground">
              {row._count.users}
              <span className="text-muted-foreground"> / {row._count.branches}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (
          <Badge variant={row.status === 'active' ? 'success' : 'neutral'}>
            {row.status === 'active' ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [],
  )

  // A company admin has no business here; the API would 403 every request.
  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Companies" description="Platform-wide company records." />
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-6 shadow-card">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-medium text-foreground">This page is for platform admins</p>
            <p className="mt-1 text-sm text-muted-foreground">
              To edit your own company&apos;s details, go to Settings.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Every company on the platform."
        actions={
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="size-4" />
            New company
          </Button>
        }
      />

      <div className="relative sm:max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search companies..."
          aria-label="Search companies"
          className="pl-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        emptyTitle={search ? 'No matching companies' : 'No companies yet'}
        emptyDescription={
          search ? 'Try a different search term.' : 'Create the first company to get started.'
        }
        emptyAction={
          search ? (
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              Clear search
            </Button>
          ) : (
            <Button size="sm" onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              New company
            </Button>
          )
        }
      />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="size-3" aria-hidden />
        A company&apos;s own details are edited from inside it, under Settings.
      </p>

      <CreateCompanyDialog open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  )
}
