# B5 — SAM.gov entity checks

## Build
- Add the requested JOFOC badge line and an accessible tooltip listing the three citation corrections, without changing other template content.
- Add an authenticated server function for SAM.gov Entity Management API v3 lookups. It will request entity registration, core data, assertions, representations and certifications, and integrity information; save the raw response and timestamp to `sam_checks`; and write an audit entry.
- Keep the external API key server-only as `SAM_GOV_API_KEY`. The app will never expose it to the browser.
- For seeded fictional vendors, bypass the network and persist a clearly labeled fictional sample response so the demo is dependable.
- If a live lookup fails, return the latest saved response for that UEI with a `cached` label. If no saved response exists, show a specific retry message.
- Replace the Checks placeholder with two modes: **Record vendor** and **Look up any UEI**. Display legal name, CAGE, registration status and expiration, exclusion status/link, NAICS-specific small-business status, reps and certs summary, integrity count, timestamp, and sample/live/cached provenance.

## Technical details
- Use TanStack Start `createServerFn` with existing authentication middleware rather than a separate Edge Function, matching this app’s runtime and security boundary.
- Validate UEIs and acquisition IDs before requests. Authorize checks to the existing specialist, reviewer, and HQ roles.
- Store provider payloads as JSON in the existing `sam_checks` table and use the existing audit table.
- Preserve reset behavior: Reset demo continues clearing `sam_checks` and related audit activity.

## Verification
- Confirm A-2027-0102 produces the labeled fictional sample panel and persists both check and audit rows.
- Confirm live UEI `G1THVER8BNL4` shows the University of Mississippi registration and exclusion result once `SAM_GOV_API_KEY` is saved.
- Simulate provider failure after a successful lookup and confirm the last saved response is shown as cached.
- Verify the JOFOC badge text and tooltip, keyboard focus, type safety, and browser console.
