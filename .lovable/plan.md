# Reorder the mission seed

## Changes
- Set M3’s program to `Project Ignition, lunar surface power (fictional element)` and priority to 1.
- Preserve the other missions’ relative order by assigning M1, M2, M4, and M5 priorities 2 through 5.
- Reload only the five mission rows into the connected backend; do not reset or modify any other data.
- Verify M3 is the first Mission Clock row and still displays its computed mission-date margin.

## Technical details
- Update `t-minus-seed/missions.json`, which is also the source used by Reset demo.
- Upsert the same five mission records by `mission_id` so existing acquisition links remain intact.
