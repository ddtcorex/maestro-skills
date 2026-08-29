# Components — 15 Primitives and Composition

## Components

This catalog covers fifteen shadcn and Radix primitives that compose most pages. Each entry lists key variants, Radix props, and accessibility notes so generated code stays consistent and inclusive.

Button uses variant default, outline, ghost, destructive with size sm, default, lg, icon. Input supports text, email, password with disabled and error states. Card provides header, content, footer slots. Dialog shares open and onOpenChange and must trap focus. Dropdown and Select expose value and onValueChange with keyboard support. Table pairs with pagination and empty state. Tabs use value and onValueChange with roving focus. Badge and Chip convey status without color alone and wrap with flex. Avatar shows image with fallback initials. Navigation and Header combine links, dropdowns, and sticky offset. Form wraps validation with label and error via aria-describedby. Toast and Sonner handle transient feedback. Skeleton renders placeholder with aria-busy. Carousel uses orientation and loop with keyboard arrows. Command and Combobox provide searchable selection.

Composition favors reuse. Combine Card with Badge for pricing, Dialog with Form for creation, Table with Pagination and Empty for data, Tabs with Card for settings, and Navigation with Dropdown for menus. Keep empty, loading, and error explicit: empty shows illustration with action, loading uses Skeleton with stable size, error shows message with retry and role alert.

```tsx
// Button — shadcn + Radix
import { Button } from "@/components/ui/button"
<Button variant="default" size="lg" className="cursor-pointer focus-visible:ring-2 focus-visible:ring-ring">CTA</Button>

// Card + Badge — pricing
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
<Card className="rounded-2xl shadow-lg">
  <CardHeader><Badge>Popular</Badge><h3 className="text-xl font-semibold">Pro</h3></CardHeader>
  <CardContent>Features and pricing details</CardContent>
</Card>

// Dialog + Form — creation
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
<Dialog><DialogTrigger asChild><Button>New item</Button></DialogTrigger><DialogContent><form className="grid gap-4">{/* fields */}</form></DialogContent></Dialog>

// Skeleton — loading
import { Skeleton } from "@/components/ui/skeleton"
<Skeleton className="h-6 w-full" aria-busy="true" />
```
