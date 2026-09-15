# Multi-role accounts and administrator access

## Goal
Allow each signed-in person to hold multiple roles. Add an Administrator role that satisfies every permission check, assign it to `joshuataggart7`, show all assigned roles beside the account name, and make every role-based refusal state the role required.

## Implementation

1. **Add secure multi-role storage**
   - Add a dedicated role enum and `user_roles` table linked to authenticated accounts.
   - Backfill each existing profile’s current role into the new table without removing compatibility fields used by older data.
   - Add security-definer helpers for “has this role?” and “has any of these roles?”; Administrator returns true for every application permission.
   - Update role-dependent row security policies and helper functions to use the role table rather than a single profile value.
   - Grant role-table access only to signed-in users and privileged system operations, with row security enabled.
   - Assign Administrator to the account whose username/email identity is `joshuataggart7`.

2. **Use all assigned roles in the app**
   - Load an account’s complete role list into the shared account context.
   - Add shared `hasRole` and `hasAnyRole` checks and replace single-role comparisons across pages, actions, navigation, server functions, document editing, voting, configuration, and scrub.
   - Preserve anonymous demo persona switching; demo personas continue to act as one selected role.
   - Administrator receives contracting, reviewer, HQ, requester, executive visibility, Center configuration, and scrub permissions without needing to switch personas.

3. **Update account and role management displays**
   - Show each assigned role as a compact chip beside the signed-in account name in the header.
   - Change Center configuration from a single role selector to multi-role controls, including Administrator.
   - Keep role assignment changes audited under the acting account’s name.

4. **Make refusals actionable**
   - Replace generic or dead-end role denials with messages naming the accepted role or roles, such as “This action requires Contracting or HQ.”
   - Keep non-role failures unchanged.

5. **Verify**
   - Confirm `joshuataggart7` displays an Administrator chip and can access contracting actions, reviewer voting, HQ posting, requester functions, Center configuration, and scrub.
   - Confirm a non-administrator with multiple roles receives the union of those permissions.
   - Confirm audit entries continue to record the account name, not a role.
   - Confirm role denials name the required role and anonymous demo switching still works.

## Technical details

- Role membership lives in a separate table; it is not stored as an editable array on profiles.
- Database policies remain the final authorization layer; frontend checks only control presentation and provide clearer messages.
- Administrator is a super-role in both database helpers and shared application permission helpers, preventing frontend/backend disagreement.
