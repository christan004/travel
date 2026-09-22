import { useEffect, useMemo, useRef, useState } from 'react'
import { Form, Formik } from 'formik'
import * as Yup from 'yup'
import { Image as ImageIcon, ShieldCheck, Upload } from 'lucide-react'
import { initials } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { LOGO_MAX_BYTES, LOGO_TYPES } from '@/api/auth'
import { env } from '@/config/env'
import { useCurrentCompany, usePermissions, useRoles, useUpdateCompany, useUsers } from '@/hooks/useSettings'
import { PageHeader } from '@/components/common/PageHeader'
import { FormInput } from '@/components/common/FormInput'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * The API stores logos at a server-relative path (/uploads/logos/<uuid>.png),
 * so it must be resolved against the API host - in dev the Vite proxy serves
 * it same-origin, in production it is the API domain.
 */
function absoluteLogoUrl(path: string | null): string | null {
  if (!path) return null
  if (/^(https?:|data:|blob:)/.test(path)) return path
  // apiBaseUrl is already '' when the dev proxy serves the API same-origin.
  const base = env.apiBaseUrl.replace(/\/+$/, '')
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

const CompanySchema = Yup.object({
  name: Yup.string().trim().max(191).required('Company name is required'),
  email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
  phone: Yup.string().trim().max(191).required('Phone is required'),
  supportingPhone: Yup.string().trim().max(191),
  tinNumber: Yup.string().trim().max(191).required('TIN is required'),
  address: Yup.string().trim().max(191).required('Address is required'),
})

/** Read-only view of the signed-in user, from GET /auth/me. */
function ProfileTab() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-base">
                {initials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
            {user.status && <StatusBadge status={user.status} className="ml-auto" />}
          </div>

          <p className="text-xs text-muted-foreground">
            The API exposes no self-service profile update endpoint, so these details are
            read-only here. An administrator can change them under Users.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Your permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No permissions assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {user.permissions.map((permission) => (
                <Badge key={permission} variant="neutral" className="font-mono text-[11px]">
                  {permission}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Pick a logo file, or clear the existing one.
 *
 * The API takes the image itself as multipart on `PATCH /companies/current`
 * (field name `logo`) and returns the stored path, so there is no URL for a
 * user to type. Type and size are checked here because the server's errors
 * ("Logo must be a PNG, JPEG or WebP image", "request file too large")
 * arrive only after a full upload.
 */
function LogoField({
  currentUrl,
  file,
  onPick,
  onRemove,
  isRemoved,
}: {
  currentUrl: string | null
  file: File | null
  onPick: (file: File | null) => void
  onRemove: () => void
  isRemoved: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  // Preview the pending file without uploading it first.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const shown = preview ?? (isRemoved ? null : absoluteLogoUrl(currentUrl))

  const choose = (picked: File | null) => {
    setError(null)
    if (!picked) return onPick(null)

    if (!LOGO_TYPES.includes(picked.type)) {
      setError('Choose a PNG, JPEG or WebP image.')
      return
    }
    if (picked.size >= LOGO_MAX_BYTES) {
      setError(`That file is ${(picked.size / 1024 / 1024).toFixed(1)}MB. The limit is 2MB.`)
      return
    }
    onPick(picked)
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="logo">Logo</Label>

      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
          {shown ? (
            <img src={shown} alt="Company logo" className="size-full object-contain" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
          )}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id="logo"
            type="file"
            accept={LOGO_TYPES.join(',')}
            className="sr-only"
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" />
            {shown ? 'Replace' : 'Upload'}
          </Button>

          {shown && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (inputRef.current) inputRef.current.value = ''
                setError(null)
                onRemove()
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {file
            ? `${file.name} - saved when you save the form.`
            : isRemoved
              ? 'The logo will be removed when you save.'
              : 'PNG, JPEG or WebP, up to 2MB.'}
        </p>
      )}
    </div>
  )
}

function CompanyTab() {
  const { data: company, isLoading } = useCurrentCompany()
  const updateCompany = useUpdateCompany()
  // A picked file lives outside Formik: it is uploaded, not a form value.
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Could not load the company profile. You may not have the companies.read permission.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company profile</CardTitle>
      </CardHeader>
      <CardContent>
        <Formik
          initialValues={{
            name: company.name ?? '',
            email: company.email ?? '',
            phone: company.phone ?? '',
            supportingPhone: company.supportingPhone ?? '',
            tinNumber: company.tinNumber ?? '',
            address: company.address ?? '',
          }}
          validationSchema={CompanySchema}
          enableReinitialize
          onSubmit={async (values) => {
            await updateCompany.mutateAsync({
              ...values,
              // A chosen file is uploaded with the form; clearing sends null.
              ...(logoFile ? { logo: logoFile } : {}),
              ...(removeLogo ? { logoUrl: null } : {}),
            })
            setLogoFile(null)
            setRemoveLogo(false)
          }}
        >
          {({ isSubmitting, dirty }) => (
            <Form className="space-y-4" noValidate>
              <FormInput name="name" label="Company name" required />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput name="email" type="email" label="Email" required />
                <FormInput name="phone" label="Phone" required />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput name="supportingPhone" label="Support phone" />
                <FormInput name="tinNumber" label="TIN number" required />
              </div>

              <FormInput name="address" label="Address" required />

              <LogoField
                currentUrl={company.logoUrl ?? null}
                file={logoFile}
                onPick={(file) => {
                  setLogoFile(file)
                  setRemoveLogo(false)
                }}
                onRemove={() => {
                  setLogoFile(null)
                  setRemoveLogo(true)
                }}
                isRemoved={removeLogo}
              />

              <div className="flex justify-end">
                <Button type="submit" loading={isSubmitting} disabled={!dirty && !logoFile && !removeLogo}>
                  Save changes
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </CardContent>
    </Card>
  )
}

function TeamTab() {
  const { data: usersPage, isLoading: loadingUsers } = useUsers({ limit: 20 })
  const { data: rolesPage } = useRoles({ limit: 100 })
  const { data: permissions } = usePermissions()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5 sm:pl-6">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingUsers &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-5 sm:pl-6">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                  </TableRow>
                ))}

              {!loadingUsers && (usersPage?.items.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    No team members found.
                  </TableCell>
                </TableRow>
              )}

              {!loadingUsers &&
                usersPage?.items.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="pl-5 font-medium sm:pl-6">
                      {member.firstName} {member.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <StatusBadge status={member.status} />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent>
            {(rolesPage?.items.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No roles defined.</p>
            ) : (
              <ul className="space-y-2">
                {rolesPage?.items.map((role) => (
                  <li
                    key={role.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium">{role.name}</span>
                    <StatusBadge status={role.isActive ? 'active' : 'inactive'} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company permissions</CardTitle>
          </CardHeader>
          <CardContent>
            {(permissions?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No permissions granted.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {permissions?.map((permission) => (
                  <Badge key={permission.id} variant="neutral" className="font-mono text-[11px]">
                    {permission.permission}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your profile, company details and team access." />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="team">Team &amp; roles</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="company">
          <CompanyTab />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
