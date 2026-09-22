# Backend: authentication

Findings from probing the live API on 2026-09-22.

## Login takes email and password only

```json
{ "email": "admin@kigali-transit.rw", "password": "StrongPassword123!" }
```

`companyId` was removed. A body still carrying one is **ignored**, not
rejected, so the change is non-breaking. The API resolves the tenant from the
account and returns the user's `companyId` in the response.

Password has an 8-character minimum, enforced as a **400 validation error**
rather than a 401 - so a short password looks like a malformed request, not
bad credentials. The login form mirrors the rule to keep that distinction.

## `isSuperAdmin` with an empty permissions array

```json
{ "id": "...", "companyId": "cm1234567890123456789036", "branchId": null,
  "isSuperAdmin": true, "email": "superadmin@tickets.local",
  "permissions": [] }
```

Super admins carry **no permission strings at all**. Any UI that checks the
array alone hides the entire app from them, so `hasPermission` treats the flag
as an unconditional grant. The flag is present on both `/auth/login` and
`/auth/me`, so it survives a page reload.

### The flag does NOT grant API access

This is the part worth knowing. Despite `isSuperAdmin: true`, the account is
**403 on tenant-scoped endpoints**:

```
GET /companies        -> 200   (2 companies: the platform and the tenant)
GET /roles            -> 403
GET /permissions      -> 403
GET /cars             -> 403
GET /users            -> 403
GET /trips            -> 403
GET /company-accounts -> 403
GET /branches         -> 403
```

So it is a **platform-level account** - it can see the list of companies, but
not operate inside one. The dashboard now shows it the full navigation, and
those pages will surface the API's own 403 when opened.

That may well be intended: a platform operator managing tenants rather than
driving a single company's fleet. But it means the UI bypass and the API's
behaviour disagree, and the honest options are:

1. **The API should honour the flag** on tenant endpoints, if a super admin is
   meant to act inside any company; or
2. **The UI should show only platform-level pages** for super admins (a
   companies screen), if it is not.

Until that is settled the dashboard takes the instruction as given - the flag
bypasses UI gates - but a super admin will meet 403s on most pages.

## Contract

| Verb | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{ email, password }`; password >= 8 chars; extra keys ignored |
| GET | `/auth/me` | Returns `isSuperAdmin`, `branchId`, `branch`, `status`, `permissions` |
| POST | `/auth/refresh` | Cookie-based; see `src/lib/axios.ts` for the concurrent-401 queue |
| POST | `/auth/logout` | Clears both cookies |
