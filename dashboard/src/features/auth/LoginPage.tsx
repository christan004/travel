import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Form, Formik } from 'formik'
import * as Yup from 'yup'
import { Bus, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormInput } from '@/components/common/FormInput'

/**
 * POST /api/v1/auth/login takes just email and password.
 *
 * `companyId` used to be required and was asked for on this form. The API now
 * resolves the tenant from the account itself, so the field is gone; a body
 * still carrying one is ignored rather than rejected.
 *
 * The 8-character minimum mirrors the API, which returns a validation error
 * rather than a 401 for a short password - catching it here keeps that from
 * looking like a wrong-credentials failure.
 */
const LoginSchema = Yup.object({
  email: Yup.string().trim().email('Enter a valid email address').required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
})

interface LoginValues {
  email: string
  password: string
}

export function LoginPage() {
  const { login, isAuthenticated, isInitialising } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)

  // Return the user to wherever ProtectedRoute intercepted them.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  if (!isInitialising && isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const initialValues: LoginValues = {
    email: '',
    password: '',
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-navy">
            <Bus className="size-6 text-primary-foreground" aria-hidden />
          </span>
          <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your SwiftBus dashboard
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <Formik
            initialValues={initialValues}
            validationSchema={LoginSchema}
            onSubmit={async (values, { setSubmitting, setFieldError }) => {
              try {
                await login({
                  email: values.email.trim(),
                  password: values.password,
                })
                toast.success('Signed in')
                navigate(from, { replace: true })
              } catch (error) {
                if (error instanceof ApiError) {
                  // 401 means bad credentials; anything else is worth showing verbatim.
                  if (error.status === 401) {
                    setFieldError('password', 'Incorrect email or password')
                  }
                  toast.error(error.message)
                } else {
                  toast.error('Could not sign in. Please try again.')
                }
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4" noValidate>
                <FormInput
                  name="email"
                  type="email"
                  label="Email"
                  placeholder="you@company.rw"
                  autoComplete="email"
                  required
                />

                <div className="relative">
                  <FormInput
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="pr-10"
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

                <Button type="submit" className="w-full" loading={isSubmitting} size="lg">
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </Button>
              </Form>
            )}
          </Formik>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          SwiftBus &middot; Bus ticketing &amp; travel management
        </p>
      </div>
    </div>
  )
}
