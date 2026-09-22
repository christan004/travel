# Backend: `/api/v1/companies`

Findings from probing the live API on 2026-09-22.

## Two audiences, two paths

| | company admin | super admin |
|---|---|---|
| `GET /companies` | **403** | 200 (all companies) |
| `POST /companies` | **403** | 201 |
| `GET /companies/current` | 200 | 200 |
| `PATCH /companies/current` | 200 | 200 |
| `PATCH /companies/{id}` | **403** | **404** |
| `DELETE /companies/{id}` | not probed | 204 (but see below) |

So a company edits **itself** through `/companies/current`; the platform
manages **others** through `/companies`. There is no path that lets a company
admin create a company.

### Paths that do not exist

```
POST  /companies/current  -> 404
PUT   /companies/current  -> 404
PATCH /companies          -> 404
PUT   /companies/{id}     -> 404
```

## `PATCH /companies/current` takes seven fields

`name`, `email`, `phone`, `supportingPhone`, `tinNumber`, `address`,
`logoUrl` - all optional, but at least one required (`{}` fails).

**`status` is not among them.** Sending `{"status":"inactive"}` alone fails as
an empty body, and sending it alongside a real field is **silently dropped** -
the company stayed `active`. Companies cannot deactivate themselves, so the
Settings form omits the field rather than offering a control that does
nothing.

`email` and `logoUrl` are validated: a bad address gives
`Invalid email address`, a non-URL gives `Invalid URL`. `logoUrl` accepts
`null` to clear, but **rejects `''`**, so a blank input must be sent as null.

## `POST /companies` also provisions a branch and an admin

The request fails without an `admin` object:

```json
{ "name": "...", "email": "...", "phone": "...", "tinNumber": "...",
  "address": "...",
  "admin": { "firstName": "...", "lastName": "...", "email": "...",
             "phone": "...", "password": "..." } }
```

and returns all three things it created:

```json
{ "company": { ..., "_count": { "users": 1, "branches": 1, "trips": 0 } },
  "mainBranch": { "id": "...", "name": "...", "type": "main" },
  "admin": { "id": "...", "email": "...", ... } }
```

Worth knowing: one call creates a company, a main branch **and** a user
account with a password. That is not obvious from the endpoint name.

## The logo is uploaded, not linked

`PATCH /companies/current` also accepts **multipart/form-data**, with the
image in a field named **`logo`**. The API stores it and returns the served
path as `logoUrl`:

```
PATCH /companies/current   (multipart)
  logo=@logo.png           -> "logoUrl": "/uploads/logos/<uuid>.png"
```

That path is publicly served (`200 image/png`), and is server-relative, so
clients must resolve it against the API origin.

Constraints, all discovered by probing:

| Rule | Response when broken |
|---|---|
| Field must be named `logo` | `Unexpected file field "file"` |
| PNG, JPEG or WebP only | `Logo must be a PNG, JPEG or WebP image` |
| Under 2MB (1MB ok, 2MB not) | `request file too large` |
| Must send >= 1 text field too | `At least one field is required` |

The last one is the awkward one: a logo **on its own** is rejected, so the
upload has to ride along with the other company fields. The dashboard sends
the whole form each time.

There is **no dedicated upload endpoint** - `/uploads`, `/files`, `/media`,
`/companies/current/logo` and several others all 404. This endpoint is it.

`logoUrl` as JSON still works for clearing (`null`) and, oddly, accepts a
`data:` URI, which gets stored verbatim. The dashboard does not use either
beyond `null`.

`POST /companies` parses multipart too - `admin[firstName]` was read
correctly - so a logo could be set at creation with bracket-notation nesting
for the admin object.

## Two bugs

**1. `DELETE /companies/{id}` can return 500 on a successful delete.**
Deleting a freshly created company answered
`500 DATABASE_ERROR "Database operation failed"` - but the company was gone.
A later delete of a similar company returned a clean 204. Likely a
foreign-key cleanup that throws after committing. A client cannot distinguish
this from a real failure.

**2. `PATCH /companies/{id}` returns 404 for a super admin**, even for a
company that demonstrably exists and appears in `GET /companies`. If a
platform admin is meant to edit tenants, that path is broken; if not, 403
would be the honest answer. The dashboard offers no edit on this page as a
result.
