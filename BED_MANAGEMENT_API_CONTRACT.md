# Bed Management API Contract

Derived from `BED MANAGEMENT_MOB.pdf`, then aligned with the backend as built.
Hierarchy is block → floor → ward (a care unit) → room → bed.

Base URLs: staging `https://api.helixhealth.app/api/v1`, prod `https://api-prod.helixhealth.app/api/v1`.

## 1. Hierarchy

```
Facility
└── Block            (building / block)
    └── Floor
        └── Ward     (ward / unit)
            └── Room (room / cubicle)
                └── Bed
```

Every level is addressable on its own, because the spec has a page per level: a block page
lists floors, a floor page lists wards, a ward page lists rooms (the main table), and a room
page lists beds.

## 2. What stayed on purpose

**Hierarchy wards are units.** `GET/PUT/DELETE /units/{id}` is the hierarchy ward.
`/wards/{id}` stays the old department-ward API and is not part of this tree.
Listing and creating wards on a floor uses the alias `GET/POST /floors/{id}/wards`.
Rooms hang off the unit: `GET/POST /units/{id}/rooms`.

**Beds keep `department_id`.** Placement is `room_id`, and the staff board
`GET /departments/{id}/beds` still works. Put `department_id` on the unit before adding
beds. The admin sends that on the unit, then includes the same `department_id` on each bed.

**Bed status stays** `available` | `occupied` | `blocked`.

**Unassigned backfill is visible and renameable.** The admin does not hide those rows.

**Unit `type` is an open string.** The form offers common values and also sends whatever
was typed.

## 3. Conventions

- Facility comes from the JWT. Multi-facility and internal admins pass `facility_id` as a
  query param or `X-Facility-Id` as a header, same as `/units` today.
- Nurses and doctors are read-only on every endpoint below. Admins can write.
- Errors use the existing envelope: `{ "status": <int>, "message": <string>, "code": <string> }`.
- Names are unique per parent scope, compared case-sensitively after trimming, and return
  `409` on collision with a human message (e.g. `A room with this number already exists in this ward`).
- Every resource returns `id`, `sort_order`, `created_at`, `updated_at`.
- Reordering is a `PUT` with a new `sort_order`.

## 4. Resources

### 4.1 Block

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `facility_id` | string | |
| `name` | string | **required**, unique per facility |
| `sort_order` | int | |
| `floors` | Floor[] | embedded on GET |
| `floor_count` | int | |

```
GET    /blocks
POST   /blocks
GET    /blocks/{id}
PUT    /blocks/{id}
DELETE /blocks/{id}
GET    /blocks/{id}/floors
POST   /blocks/{id}/floors
```

### 4.2 Floor

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `block_id` | string | |
| `block_name` | string | read-only, for breadcrumbs |
| `name` | string | optional per the spec; the UI offers 1–10 plus free text |
| `sort_order` | int | |
| `wards` | Ward[] | embedded on GET |
| `ward_count` | int | |

```
GET    /floors/{id}
PUT    /floors/{id}
DELETE /floors/{id}
GET    /floors/{id}/wards
POST   /floors/{id}/wards
```

Floor names may repeat across blocks (two blocks can each have a "Floor 2") but must be
unique within a block.

### 4.3 Ward / Unit

Extends the existing care unit. New fields are `floor_id`, `code`, `type`, and
`gender_restriction`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `floor_id` | string | **required** on create |
| `floor_name`, `block_id`, `block_name` | string | read-only, for breadcrumbs |
| `name` | string | **required** |
| `code` | string | optional |
| `department_id` | string | required before beds are added |
| `type` | string | open string; common values are suggestions only |
| `gender_restriction` | enum | `male` \| `female` \| `mixed` |
| `rooms` | Room[] | embedded on GET |
| `room_count` | int | |

```
GET    /floors/{id}/wards
POST   /floors/{id}/wards
GET    /units/{id}
PUT    /units/{id}
DELETE /units/{id}
GET    /units/{id}/rooms
POST   /units/{id}/rooms
```

`/wards/{id}` is the old department-ward API. Do not use it for this hierarchy.

### 4.4 Room / Cubicle

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `ward_id` | string | |
| `ward_name`, `floor_name`, `block_name` | string | read-only, for breadcrumbs |
| `number` | string | **required**, unique per ward |
| `name` | string | optional |
| `sort_order` | int | |
| `bed_count` | int | aggregate |
| `available_count` | int | aggregate |
| `occupied_count` | int | aggregate |
| `blocked_count` | int | aggregate |
| `updated_at` | timestamp | drives the table's "Modified" column |

```
GET    /rooms            ?ward_id=
POST   /rooms
GET    /rooms/{id}
PUT    /rooms/{id}
DELETE /rooms/{id}
GET    /rooms/{id}/beds
POST   /rooms/{id}/beds
```

The four aggregate counts must be on the **list** response, not just the detail response.
The ward page's main table is one row per room showing exactly these columns: room/cubicle,
total beds, available, occupied, action, modified. Without them the admin panel would have
to fetch every room's beds to render one table.

### 4.5 Bed

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `room_id` | string | where the bed sits in the hierarchy |
| `department_id` | string | kept so `GET /departments/{id}/beds` still works |
| `bed_number` | string | **required**, unique per room |
| `bed_code` | string | optional, new ("Bed Code/Name" in the spec) |
| `status` | enum | `available` \| `occupied` \| `blocked` |
| `occupied_patient_id` | string? | unchanged |
| `sort_order` | int | |
| `updated_by` | object | unchanged |

```
GET    /beds/{id}
PATCH  /beds/{id}          # status change and bed_number/bed_code edits
DELETE /beds/{id}
```

`POST /rooms/{id}/beds` takes a batch, because the spec's "Add Bed" form can submit several
rows at once:

```json
{ "beds": [{ "bed_number": "01", "bed_code": "Telemetry", "status": "available", "department_id": "…" }] }
```

Status is only `available`, `occupied`, or `blocked`. The unit's `department_id` is set
before this call, and each bed keeps that same `department_id`.

## 5. Nested create

Every "Add" form in the spec can create a parent and some children in one submit. The admin
panel needs these to be atomic — a partial create leaves a block with no floors and no way
for the user to tell what succeeded.

| Endpoint | May embed | Max children |
|---|---|---|
| `POST /blocks` | `floors[]` | 5 |
| `POST /blocks/{id}/floors` | `wards[]` | 3 |
| `POST /floors/{id}/wards` | `rooms[]` | 6 |
| `POST /units/{id}/rooms` and `POST /rooms/{id}/beds` | `beds[]` | 50 |

Example:

```json
POST /blocks
{
  "name": "Maternity Block",
  "floors": [
    { "name": "1" },
    {
      "name": "2",
      "wards": [
        {
          "name": "Labour & Delivery Unit",
          "code": "LDU",
          "type": "labour",
          "gender_restriction": "female",
          "rooms": [
            { "number": "1", "name": "Room 1", "beds": [{ "bed_number": "1", "status": "available" }] }
          ]
        }
      ]
    }
  ]
}
```

On any validation failure the whole request should roll back and return `400` naming the
offending path, e.g. `floors[1].wards[0].rooms[0].number is required`.

Exceeding a limit should return `400`, not silently truncate. The admin panel enforces the
same limits in the form, so this is a backstop.

This is the one requirement that conflicts with the current floors API, which explicitly
rejects floors inside `POST /units` and requires a create-then-attach sequence. If atomic
nested create isn't feasible, say so and we'll do sequential calls with client-side
rollback, but the failure modes get noticeably worse.

## 6. Aggregates and the landing page

The bed management homepage needs a facility rollup without walking the tree:

```
GET /beds/summary
```

It returns facility totals plus `blocks[]` (each block by floor, each floor by ward) and the
existing `departments[]` rollup. The staff board keeps reading `departments[]`.

`GET /blocks` returns floors. `GET /blocks?depth=full` adds `wards[]` and `rooms[]`, plus
room number, list counts, and breadcrumb names (`block_name`, `floor_name`, `ward_name`).
Per-level fallbacks are `GET /blocks/{id}/floors`, `GET /floors/{id}/wards`, and
`GET /units/{id}/rooms`.

## 7. Delete semantics

- Success is `200` with `{ "message": "… deleted" }`.
- `409` when the resource still has children, or when a bed is occupied.
- There is no cascade flag. The admin shows the `message` from a `409` and leaves the tree
  in place.

## 8. Settled

1. The unit carries `department_id`. Set it before adding beds. Beds keep `department_id` too.
2. `type` is an open string.
3. Nested bed cap is 50.
4. The admin always sends a floor name. A missing name is shown as "Unnamed floor".
5. Unassigned backfill rows are visible and can be renamed.
6. Bed status stays `available` / `occupied` / `blocked`.
