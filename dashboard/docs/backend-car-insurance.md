# Backend: `/api/v1/car-insurance`

Findings from probing the live API on 2026-09-12. The dashboard works around
all of these, but each is worth fixing server-side.

## 1. LIST returns a different shape from GET-by-id

`GET /api/v1/car-insurance` groups policies under their car, using a
capitalised model name as the key, and omits `carId`:

```json
{ "data": [ { "CarInsurance": [
      { "id": "...", "name": "Comprehensive Insurance",
        "status": "active", "validFrom": "...", "validTo": "..." } ] } ],
  "meta": { "page": 1, "limit": 50, "total": 1, "totalPages": 1 } }
```

`GET /api/v1/car-insurance/{id}` returns a flat policy that *does* include
`carId` and `companyId`:

```json
{ "data": { "id": "...", "carId": "...", "name": "...", "validFrom": "...",
            "validTo": "...", "status": "active", "companyId": "...",
            "createdAt": "..." } }
```

**Impact.** The two reads disagree, so a list row cannot be edited directly.
**Suggested fix:** return flat rows with `carId`, like `/baggage` does.

## 2. `meta.total` counts cars, not policies

With 4 policies on 1 car, `meta.total` is `1`. Paging is therefore per-car:
`?page=2&limit=2` returns the same single group rather than the next policies.

**Impact.** Server-side pagination is unusable; the dashboard fetches
`limit=100` and pages client-side.

## 3. PATCH requires `carId` on every call

Unlike `/baggage` (which *rejects* `carId` as an unrecognised key), every
PATCH here fails without it — even when only the name is changing:

```
PATCH {"name":"X"}                  -> 400 carId: expected string, received undefined
PATCH {"status":"expired"}          -> 400 carId: ... (+ status enum error)
PATCH {}                            -> 400 carId: ...
PATCH {"carId":"<id>","name":"X"}   -> 200
```

**Impact.** Editing needs a GET-by-id first, purely to recover the `carId`
that item 1 stripped from the list. Two round-trips for one edit.

## 4. Status enum is `active` | `expired`

Not the `active` | `inactive` used by every other resource. `"inactive"` is
rejected on both POST and PATCH:

```
Invalid option: expected one of "active"|"expired"
```

This is probably intentional for insurance, but it is worth confirming — the
inconsistency is easy to trip over.

## 5. Query filters are accepted but ignored

- `?status=expired` returns **nothing**, though expired rows exist.
- `?status=active` returns expired rows too.
- `?carId=zzzzzzzz` (nonexistent) still returns **every** row.

**Impact.** Neither filter can be trusted; the dashboard filters client-side.

## 6. `?search=` returns 500

`GET /api/v1/car-insurance?search=Comprehensive` →
`{"code":"INTERNAL_ERROR","message":"Internal server error"}`.

## 7. Misleading error for a nonexistent `carId`

POSTing a `carId` that does not exist returns:

```
409 BUSINESS_RULE_VIOLATION "The resource is still referenced by other records"
```

That message describes a *delete* conflict. A missing foreign key should be
`404` or a validation error naming `carId`.

## Contract as it stands

| Verb | Path | Notes |
|---|---|---|
| GET | `/car-insurance` | Grouped by car; `meta.total` counts cars; no `carId` |
| GET | `/car-insurance/{id}` | Flat, includes `carId` |
| POST | `/car-insurance` | Requires `carId`, `name`, `validFrom`, `validTo`; `status` defaults to `active` |
| PATCH | `/car-insurance/{id}` | **Requires `carId`**; unknown keys ignored |
| DELETE | `/car-insurance/{id}` | `204 No Content` |
