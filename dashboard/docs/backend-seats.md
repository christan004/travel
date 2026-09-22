# Backend: `/api/v1/seats`

Findings from probing the live API, updated 2026-09-18.

## `letter` groups seats into rows

Each seat now carries a `letter` - its ROW in the vehicle:

```json
{ "number": 1, "letter": "A", "id": "cmu77hwya0006ly4yi0exgwl7", "status": "active" }
```

Seats sharing a letter are one row, and the row widths describe the real
layout. A 29-seater came back as:

```
row A -> 1,2          (2 seats - driver's row)
row B -> 3,4,5,6      (4)
row C -> 7,8,9        (3 - door)
row D -> 10..13       (4)
row E -> 14..17       (4)
row F -> 18..21       (4)
row G -> 22..25       (4)
row H -> 26..29       (4)
```

The dashboard draws one row per letter at its true width, so short rows leave
a gap rather than stretching - the grid then matches the vehicle's shape.

### `letter` is null on older vehicles

The 12-seater seeded earlier has `letter: null` on every seat. Those render as
a single flat block with no row labels, and the summary omits the row count
rather than claiming "1 row".

## `limit` matters: the list paginates by SEAT

`meta.total` counts SEATS (41 across two cars), not cars, so `?limit=20`
truncates a 29-seat car to 20 seats with no indication that it did. The
dashboard requests `limit=100`.

This is the same quirk noted before: a car can appear on more than one page,
its seats split between them.

## PATCH accepts only `status`

```
PATCH {"status":"inactive"}  -> 200
PATCH {"letter":"Z"}         -> 400 Unrecognized key + status required
PATCH {"number":99}          -> 400 Unrecognized key + status required
```

`status` is also REQUIRED, not merely allowed - a body without it fails even
when another key is present. So rows and seat numbers are fixed at creation;
only availability is editable.

### Status enum

`active` | `inactive`.
