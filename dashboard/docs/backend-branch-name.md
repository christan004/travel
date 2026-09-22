# Backend change required: `name` on Branch

The dashboard's Branches page now sends a `name` field on create and update.
**It is not in the current OpenAPI spec** — the API identifies a branch by
`branchNumber` alone — so the value will not persist until the backend is
updated.

The frontend degrades gracefully in the meantime: the table falls back to
`branchNumber` when no `name` comes back, so nothing breaks. But a user who
types a name, saves, and reloads will see it vanish.

## What the API receives now

```http
POST /api/v1/branches
Content-Type: application/json

{
  "name": "Nyabugogo Office",
  "branchNumber": "BR-001",
  "type": "branch",
  "email": "nyabugogo@kigali-transit.rw",
  "phone": "+250788100200",
  "supportingPhone": "+250788100201",
  "phoneNumber": "BR-PHONE-01",
  "status": "active"
}
```

`PATCH /api/v1/branches/:id` sends the same shape.

## Three changes needed

### 1. Prisma model

Nullable, so existing rows remain valid without a backfill:

```prisma
model Branch {
  id        String  @id @default(cuid())
  name      String? @db.VarChar(191)   // <- add
  branchNumber String
  // ...existing fields
}
```

Then `npx prisma migrate dev --name add_branch_name`.

Make it `String` (non-null) instead only if you backfill existing rows first —
the dashboard already marks the field required in its own form.

### 2. Validation schema

Add `name` to the create and update schemas. Matching the conventions used by
the other resources in the spec (max 191, matching the `VarChar`):

```ts
// create - required, mirroring the dashboard form
name: z.string().trim().min(1).max(191),

// update - optional, since PATCH bodies are partial
name: z.string().trim().min(1).max(191).optional(),
```

Without this, a schema using `additionalProperties: false` / `.strict()` will
**reject the whole request** rather than ignore the unknown key — so this step
is what stops branch creation breaking outright.

### 3. Response serializer

Include `name` in whatever `select` or DTO shapes the branch response, for all
of: list, get-by-id, create and update. If it is missing here the write will
succeed but the dashboard will still show the fallback, which looks like the
save failed.

## Verifying

```bash
# Expect "name": "Nyabugogo Office" in the response body.
curl -X POST https://tickets.quicko.rw/api/v1/branches \
  -H "Content-Type: application/json" \
  -b "access_token=<signed cookie>" \
  -d '{"name":"Nyabugogo Office","branchNumber":"BR-001","type":"branch",
       "email":"n@kigali-transit.rw","phone":"+250788100200",
       "phoneNumber":"BR-PHONE-01","status":"active"}'
```

In the dashboard: create a branch with a name, reload the page, and confirm
the name still shows as the row heading rather than reverting to `BR-001`.

## Also update the spec

Add `name` to the Branch request bodies and response examples in the Apidog
export so the contract and the implementation stay in step, then refresh
`docs/` from the new export.
