import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** Pill badge. Green/amber/red map to the brand status palette. */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-light text-primary-hover',
        success: 'border-transparent bg-primary-light text-primary-hover',
        warning: 'border-transparent bg-warning/15 text-[hsl(30_85%_35%)]',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        neutral: 'border-transparent bg-muted text-muted-foreground',
        outline: 'border-border text-foreground',
        navy: 'border-transparent bg-navy/10 text-navy',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
