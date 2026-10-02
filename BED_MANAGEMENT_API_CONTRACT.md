# Bed Management API Contract (requested)

Derived from `BED MANAGEMENT_MOB.pdf`. This is what the admin panel needs from the backend
to build the bed management screens in that spec. Nothing here exists yet except `/units`
and unit-scoped floors, both of which need to change (see **Migration**).

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

## 2. Migration from what exists today

Three breaking changes. We need these resolved before any UI work starts.

**Floors move from units to blocks.** Today a floor is created with
`POST /units/{id}/floors` and carries `unit_id`. In the spec a floor belongs to a block and
*contains* wards. So `floor.unit_id` becomes `floor.block_id`, and the unit gains
`floor_id`. The admin panel's current unit-floors editor is built on the old shape and will
be rewritten.

**Beds move from departments to rooms.** Today beds are created with
`POST /departments/{id}/beds` and carry `department_id` plus an optional `floor_id` and
`ward_id`. In the spec a bed always belongs to a room, and "Add bed" is only ever initiated
from a room. `bed.department_id` should become `bed.room_id`.

**Department has no place in the spec's hierarchy.** If departments must stay (they drive
roles, staff, and escalation), we need to know whether a ward keeps a `department_id`
pointer for those features, or whether bed occupancy stops being reportable per department.

For existing facility data, we suggest the backend backfills a single `Unassigned` block
with one `Unassigned` floor per facility, attaches every existing unit to it, and creates one
`Unassigned` room per ward to hold that ward's existing beds. Confirm whether you want the
admin panel to surface those placeholder rows or hide them.

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
| `type` | enum | see below, plus free text |
| `gender_restriction` | enum | `male` \| `female` \| `mixed` |
| `rooms` | Room[] | embedded on GET |
| `room_count` | int | |

`type` values: `general`, `emergency`, `icu`, `maternity`, `labour`, `nicu`, `paediatric`,
`isolation`, `recovery`, `private`, `psychiatric`, `surgical`. The spec allows typing a
value that isn't in the list, so either accept arbitrary strings or add a `type_other`
free-text field — tell us which.

```
GET    /wards            ?floor_id= &block_id=
POST   /wards
GET    /wards/{id}
PUT    /wards/{id}
DELETE /wards/{id}
GET    /wards/{id}/rooms
POST   /wards/{id}/rooms
```

If `/units` is kept as the route name instead of `/wards`, that's fine — we just need one
canonical name and the new fields.

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
| `room_id` | string | replaces `department_id` |
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
{ "beds": [{ "bed_number": "01", "bed_code": "Telemetry", "status": "available" }] }
```

The spec's bed status dropdown is the only place a status is set; confirm the three existing
values cover it, since the mock for the mobile view also showed a "turnover"-style state.

## 5. Nested create

Every "Add" form in the spec can create a parent and some children in one submit. The admin
panel needs these to be atomic — a partial create leaves a block with no floors and no way
for the user to tell what succeeded.

| Endpoint | May embed | Max children |
|---|---|---|
| `POST /blocks` | `floors[]` | 5 |
| `POST /blocks/{id}/floors` | `wards[]` | 3 |
| `POST /wards` | `rooms[]` | 6 |
| `POST /rooms` | `beds[]` | see open questions |

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

It should return facility totals (total, available, occupied, blocked, occupancy percent,
`last_updated_at`) and a breakdown by block, each block by floor, each floor by ward. The
existing `/beds/summary` returns a per-department breakdown, which no longer matches the
hierarchy.

Also needed: the homepage lets a user run any "Add" action with no context selected, so the
cascading selects need the whole tree cheaply. The admin panel calls
`GET /blocks?depth=full` and expects blocks with `floors[]`, each floor with `wards[]`, and
each ward with `rooms[]`. Without `depth`, it should return blocks with floors only, and the
UI will fall back to `GET /blocks/{id}/floors`, `GET /floors/{id}/wards`, and
`GET /wards/{id}/rooms` per level.

## 7. Delete semantics

Please confirm. Our assumption:

- Deleting a parent with children returns `409` with a message naming the blocker, unless
  `?cascade=true` is passed.
- Deleting a room or bed whose bed is `occupied` returns `409` regardless of cascade.
- Delete returns `{ "message": "<Resource> deleted" }` with `200`, matching the current
  floors endpoint.

## 8. Open questions

1. Does a ward still carry `department_id` so roles, staff, and escalation keep working?
2. Is `type` an open string or a fixed enum plus a separate free-text field?
3. Is there a cap on beds embedded in `POST /rooms`? The spec caps floors, wards, and rooms
   but is silent on beds. We suggest 50.
4. Is a floor name really optional? If two unnamed floors can exist in one block, the UI
   needs something to label them with.
5. How should the backfilled `Unassigned` block, floor, and room appear to admins — visible
   and renameable, or hidden until data is reorganised?
6. Is the bed status list staying at three values?
