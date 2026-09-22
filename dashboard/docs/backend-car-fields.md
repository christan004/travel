# Backend change required: `totalSeats` and `totalWeightSlots` on Car

The dashboard's Cars page now sends two fields that are **not in the current
OpenAPI spec**:

| Field | Type on the wire | Required in the UI | Meaning |
| --- | --- | --- | --- |
| `totalSeats` | JSON number | yes, min 1 | Seating capacity |
| `totalWeightSlots` | JSON number or `null` | no | Number of luggage compartments |

Neither will persist until the backend is updated. The frontend degrades
gracefully in the meantime — the Seats column shows "Not set" and Baggage
slots shows a dash — but a user who enters values, saves, and reloads will see
them disappear.

## What the API receives now

```http
POST /api/v1/cars
Content-Type: application/json

{
  "model": "Toyota Coaster",
  "plateNumber": "RAB 123 A",
  "totalSeats": 30,
  "totalWeightSlots": 4,
  "tankCapacity": "95.50",
  "productId": "cm1234567890123456789006"
}
```

`PATCH /api/v1/cars/:id` sends the same shape.

Two details worth noting:

- Both new fields are **JSON numbers**, unlike `tankCapacity`, which stays a
  decimal string because it is a Prisma `Decimal`.
- `totalWeightSlots` is sent as **`null`** when the input is left blank —
  meaning "not declared", which is deliberately distinct from `0` ("declared
  as carrying no luggage"). Accept both.

## Three changes needed

### 1. Prisma model

Both nullable, so existing rows remain valid without a backfill:

```prisma
model Car {
  id               String  @id @default(cuid())
  model            String
  plateNumber      String
  tankCapacity     Decimal
  totalSeats       Int?                    // <- add
  totalWeightSlots Int?                    // <- add
  productId        String
  // ...existing fields
}
```

Then `npx prisma migrate dev --name add_car_capacity_fields`.

Make `totalSeats` non-null only if you backfill existing rows first — the
dashboard already marks it required in its own form. `totalWeightSlots` should
stay nullable either way, since it is genuinely optional.

### 2. Validation schema

```ts
// create
totalSeats:       z.number().int().min(1).max(1000),
totalWeightSlots: z.number().int().min(0).max(1000).nullable().optional(),

// update - partial, so everything optional
totalSeats:       z.number().int().min(1).max(1000).optional(),
totalWeightSlots: z.number().int().min(0).max(1000).nullable().optional(),
```

Without this, a schema using `additionalProperties: false` / `.strict()` will
**reject the whole request** rather than ignore the unknown keys — so this step
is what stops car creation breaking outright.

`.nullable()` on `totalWeightSlots` is required: the dashboard sends explicit
`null` for a blank field, and a plain `.optional()` will reject it.

The dashboard enforces `totalSeats >= 1` and `totalWeightSlots >= 0`;
mirroring those bounds server-side keeps the two in step.

### 3. Response serializer

Include both fields in whatever `select` or DTO shapes the car response, for
all of: list, get-by-id, create and update. If they are missing here the write
will succeed but the dashboard will still show "Not set" / "--", which looks
like the save failed.

## Worth deciding: are these counts authoritative?

Once these columns exist, capacity has two sources:

| Declared on Car | Derived from rows |
| --- | --- |
| `totalSeats` | `COUNT(*)` of `Seat` where `carId = ...` |
| `totalWeightSlots` | `COUNT(*)` of `Baggage` where `carId = ...` |

They can disagree. Options, in rough order of effort:

1. **Treat the Car columns as declarations and the rows as the layout.** A
   mismatch is legitimate while seats and compartments are still being
   configured. Simplest.
2. **Validate on row creation** — reject a new `Seat` when the car already has
   `totalSeats` of them, and likewise for `Baggage`.
3. **Auto-generate rows** — create the numbered `Seat` and `Baggage` rows when
   a car is created.

The dashboard currently does (1): it displays the declared numbers without
reconciling them against the Seats and Baggage pages. Tell me which you pick
and I will surface any mismatch in the UI.

## Verifying

```bash
# Expect "totalSeats": 30 and "totalWeightSlots": 4 in the response body.
curl -X POST https://tickets.quicko.rw/api/v1/cars \
  -H "Content-Type: application/json" \
  -b "access_token=<signed cookie>" \
  -d '{"model":"Toyota Coaster","plateNumber":"RAB 123 A","totalSeats":30,
       "totalWeightSlots":4,"tankCapacity":"95.50",
       "productId":"<a real product type id>"}'

# And that a null baggage slot count is accepted rather than rejected.
curl -X POST https://tickets.quicko.rw/api/v1/cars \
  -H "Content-Type: application/json" \
  -b "access_token=<signed cookie>" \
  -d '{"model":"Hiace","plateNumber":"RAB 456 B","totalSeats":14,
       "totalWeightSlots":null,"tankCapacity":"70.00",
       "productId":"<a real product type id>"}'
```

In the dashboard: create a car with both values, reload, and confirm the Seats
and Baggage slots columns show the numbers rather than the placeholders.

## Also update the spec

Add both fields to the Car request bodies and response examples in the Apidog
export so the contract and the implementation stay in step, then refresh
`docs/` from the new export.

---

**Note on naming:** the dashboard relabelled "Vehicle type" to "Product type"
in the UI. That is a display-only change — the field on the wire is still
`productId`, pointing at `/api/v1/product-types`. No backend change needed.
