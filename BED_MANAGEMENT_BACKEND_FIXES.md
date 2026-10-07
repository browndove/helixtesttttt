# Bed management — backend fixes

Staging: `https://api.helixhealth.app/api/v1`
Facility used below: `5c3a047f-132d-4cdc-b6d3-02d98e77275e`
Unit used below: `33a2759a-9b24-49a2-8458-1d6191cfd15d` (created with `POST /floors/115a21f0-b7a5-4776-9a33-e2afc4430328/wards`, which returned 201)

The admin panel follows `BED_MANAGEMENT_API_CONTRACT.md`. Blocks, floors, and units save. Rooms do not. The admin cannot work around this: both listing and creating rooms return HTTP 500 before any room row exists.

## 1. Room queries select `r.label`, and that column does not exist

Confirmed on staging, 7 Oct 2026:

```
GET /units/33a2759a-9b24-49a2-8458-1d6191cfd15d/rooms?facility_id=5c3a047f-132d-4cdc-b6d3-02d98e77275e
```

```
500
{
  "status": "error",
  "message": "Error listing rooms",
  "code": 500,
  "detail": "ERROR: column r.label does not exist (SQLSTATE 42703)"
}
```

The list query aliases the rooms table as `r` and reads `r.label`. Postgres has no such column (`SQLSTATE 42703`). An empty unit must return `200` and an empty list. This call fails with zero rooms, so the ward page cannot load.

The same list also failed as:

```
GET /rooms?ward_id=33a2759a-9b24-49a2-8458-1d6191cfd15d&facility_id=5c3a047f-132d-4cdc-b6d3-02d98e77275e
500
```

The response body of that second call was not captured. It is the same list, so it is the same select until proven otherwise.

**Fix.** Select the columns the contract already defines. There is no `label` field on a room.

| JSON field | Type | Notes |
|---|---|---|
| `number` | string | required, unique per ward. This is the room / cubicle number. |
| `name` | string | optional display name |
| `ward_id` | string | the hierarchy unit id |
| `sort_order` | int | |
| `bed_count`, `available_count`, `occupied_count`, `blocked_count` | int | required on the list, not only on the detail |
| `updated_at` | timestamp | |
| `ward_name`, `floor_name`, `block_name` | string | read-only breadcrumbs |

If an older query used `label` as the room number, point it at `number`. Do not add a `label` column to satisfy the query. The admin reads `number`, and falls back to `room_number` only. It does not read `label`.

## 2. Creating a room returns 500

The admin shows the banner **Error creating room**. That string is the API `message`. These calls failed on the same unit:

```
POST /units/33a2759a-9b24-49a2-8458-1d6191cfd15d/rooms?facility_id=5c3a047f-132d-4cdc-b6d3-02d98e77275e
POST /rooms?facility_id=5c3a047f-132d-4cdc-b6d3-02d98e77275e
```

`POST /rooms` body that failed:

```json
{
  "number": "1",
  "ward_id": "33a2759a-9b24-49a2-8458-1d6191cfd15d",
  "facility_id": "5c3a047f-132d-4cdc-b6d3-02d98e77275e"
}
```

`POST /units/{id}/rooms` body the admin sends now (the unit id is in the path; `facility_id` is added by the admin proxy):

```json
{
  "number": "1",
  "facility_id": "5c3a047f-132d-4cdc-b6d3-02d98e77275e"
}
```

`name` is included only when the user typed one. `beds` is included only when a bed number was typed:

```json
{
  "number": "1",
  "name": "Room 1",
  "beds": [
    { "bed_number": "1", "status": "available", "department_id": "<unit department>" }
  ],
  "facility_id": "5c3a047f-132d-4cdc-b6d3-02d98e77275e"
}
```

The failing submits were number `1` with no name and no beds. A missing optional field is not the cause. Validation problems should be `400`, and a duplicate number should be `409` with a message such as `A room with this number already exists in this ward`.

The create `detail` was not captured (the admin only stored `message` at the time). Create almost certainly runs the same select after insert, so `r.label` will turn a successful insert into `Error creating room` as well. Check the create handler for `r.label` before looking for a second bug.

**Done when**

- `GET /units/{id}/rooms` on a unit with no rooms returns `200` and `[]` (or `{ "rooms": [] }`).
- `POST /units/{id}/rooms` with `{ "number": "1" }` returns `201` and the room, including `id` and `number`.
- A second POST with the same number returns `409`, not `500`.
- `GET /rooms?ward_id={id}` returns the same room.
- The list includes `bed_count`, `available_count`, `occupied_count`, `blocked_count`, and `updated_at`.

## 3. What already works

These returned success on the same facility and do not need a change for this bug:

- `GET /blocks?depth=full`
- `POST /floors/{id}/wards` (the unit above)
- `GET /units`
- `GET /departments`

`/wards/{id}` is the old department-ward API. Room routes for this hierarchy are `/units/{id}/rooms` and `/rooms`.
