# User Management — Registration, Activation & Admin Panel

## Top-Level Overview

The app already has a full registration form (signup.html) and a `user_profiles` table with an
`account_status` field defaulting to `'pending'`. However:

- The `users` table has no `is_active` column.
- Login has no account-status check — any row in `users` can log in.
- There is no admin UI to approve, reject, enable, disable, or change roles.

This plan adds all three missing pieces:

1. **Schema upgrade** — add `is_active` to `users`; surface `account_status` for admin reads.
2. **Login gate** — block `pending` / `rejected` / `disabled` accounts with a clear message.
3. **Admin User Management tab** in `dashboard.html` — approve, reject, enable/disable, change role.

No email infrastructure is required. Activation is admin-only.

---

## Sub-Tasks

---

### Sub-Task 1 — Schema: add `is_active` to `users` and wiring in signup

**Status:** `[x] done`

**Intent**
The `users` table needs an `is_active INTEGER DEFAULT 0` column. New registrations
must insert a `users` row with `is_active = 0` (inactive until admin approves). Approving
a registration flips it to `is_active = 1`.

**Expected Outcomes**
- `CREATE TABLE users` in `js/db.js` includes `is_active INTEGER DEFAULT 0`.
- A DB migration helper runs `ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 0`
  if the column does not already exist (to handle existing installed databases without
  wiping them).
- `insertUserProfile` (and its calling code in `signup.html handleSubmit`) creates the
  `users` row with `is_active = 0`.
- `seedDefaultData` creates the seeded `admin` user with `is_active = 1` (admin must be
  able to log in right away).

**Todo List**
- [ ] In `js/db.js` → `createSchema()`: add `is_active INTEGER DEFAULT 0` to the
      `CREATE TABLE users` statement.
- [ ] In `js/db.js` → `initDB()`: after schema creation / DB recovery, run a one-time
      migration that does `ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 0` wrapped
      in a try/catch (SQLite silently errors if column already exists — ignore that error).
- [ ] In `js/db.js` → `seedDefaultData()`: ensure the seeded `admin` insert sets
      `is_active = 1`.
- [ ] In `signup.html` → `handleSubmit()`: change the `INSERT INTO users` statement to
      explicitly set `is_active = 0`.
- [ ] In `js/db.js` → add helper `setUserActive(userId, isActive)` — updates
      `users.is_active` by id.
- [ ] In `js/db.js` → add helper `setUserStatus(userId, status)` — updates
      `user_profiles.account_status` by `user_id`.
- [ ] In `js/db.js` → add helper `setUserRole(userId, role)` — updates `users.role` by id.
- [ ] In `js/db.js` → add helper `getAllUserProfiles()` — returns a JOIN of
      `user_profiles` + `users` ordered by `created_at DESC`, including: `user_id`,
      `username`, `role`, `is_active`, `account_status`, `first_name`, `last_name`, `email`,
      `org_name`, `org_type`, `org_rank`, `created_at`.
- [ ] Export all new helpers from `js/db.js`.

**Relevant Context**
- `js/db.js` — `createSchema()`, `seedDefaultData()`, `insertUserProfile()`
- `signup.html` — `handleSubmit()` around line 1044

---

### Sub-Task 2 — Login gate: block non-active / non-approved accounts

**Status:** `[x] done`

**Intent**
After successful password verification, `login()` in `js/auth.js` must also check:
- `users.is_active = 1` (not disabled / not yet approved)
- `user_profiles.account_status = 'approved'`

If either check fails, login is rejected with an appropriate message.

The seeded `admin` account has no `user_profiles` row — so the check must gracefully
handle missing profile rows (admin bypasses the profile status check, or the check
is only applied when a profile row exists).

**Expected Outcomes**
- Pending users see: *"Your account is pending admin approval."*
- Rejected users see: *"Your registration was not approved. Please contact the administrator."*
- Disabled users see: *"Your account has been disabled. Please contact the administrator."*
- Admin user (no profile row) logs in normally.
- Approved + active users log in normally.

**Todo List**
- [ ] In `js/auth.js` → `login()`: after password match, query `users.is_active` for the
      matching user; if `is_active = 0`, determine reason:
      - Query `user_profiles` for `account_status` by `user_id`.
      - If no profile row exists (seeded admin) → allow login.
      - If `account_status = 'pending'` → throw/return error "pending".
      - If `account_status = 'rejected'` → throw/return error "rejected".
      - Otherwise (disabled after approval) → throw/return error "disabled".
- [ ] In `login.html`: map the three error codes to display messages shown under the form.
- [ ] In `js/db.js`: add helper `getUserProfileByUserId(userId)` to support the status lookup
      in auth.js.

**Relevant Context**
- `js/auth.js` — `login()` function
- `login.html` — error display area
- `js/db.js` — `getUserByUsername()`, new `getUserProfileByUserId()`

---

### Sub-Task 3 — Admin User Management tab in dashboard.html

**Status:** `[x] done`

**Intent**
Add a "Users" navigation tab to `dashboard.html`, visible and accessible only when the
logged-in user has `role = 'admin'`. The tab shows two sections:

1. **Pending Registrations** — accounts awaiting approval (`account_status = 'pending'`).
   Admin can Approve or Reject each.
2. **All Users** — every registered account (including approved, rejected, disabled). Admin
   can Enable/Disable and change role (ranger ↔ admin) per row.

All mutations go through the db.js helpers added in Sub-Task 1, followed by `persistDB()`.

**Expected Outcomes**
- The "Users" nav link is hidden for ranger-role sessions.
- Pending section shows: Name, Email, Organization, Role, Registered date + Approve / Reject buttons.
- All Users section shows: Username, Name, Email, Role (editable), Status (is_active toggle), Account status + Enable/Disable button.
- After each action the table refreshes automatically.
- No page reload required — all updates happen in-place via JS.

**Todo List**
- [ ] In `dashboard.html` nav: add a "👥 Users" link, rendered only if `currentUser().role === 'admin'`.
- [ ] Add a `<section id="section-users">` panel (same pattern as other dashboard panels)
      that is hidden by default and shown when the Users nav item is clicked.
- [ ] Inside the section add two sub-panels:
      - `#pending-users-panel` — heading "Pending Registrations" + `<table id="pending-users-table">`.
      - `#all-users-panel` — heading "All Users" + `<table id="all-users-table">`.
- [ ] Write `loadPendingUsers()` JS function: queries `getAllUserProfiles()` filtered to
      `account_status = 'pending'`, renders rows, attaches Approve / Reject click handlers
      that call `setUserStatus()` + `setUserActive()` (approve sets both status='approved'
      and is_active=1; reject sets status='rejected', is_active stays 0), then `persistDB()`,
      then reloads both tables.
- [ ] Write `loadAllUsers()` JS function: queries `getAllUserProfiles()`, renders all rows,
      attaches:
      - Enable/Disable toggle: calls `setUserActive()` + updates `account_status` to
        `'approved'`/`'disabled'` accordingly, then `persistDB()`.
      - Role change (ranger ↔ admin): calls `setUserRole()` then `persistDB()`.
- [ ] Both table renders must handle the empty-state gracefully (show "No records" message).
- [ ] Style the tables using existing `components.css` table classes; action buttons use
      existing `btn btn-accent` / `btn btn-secondary` / `btn btn-danger` classes.
- [ ] In the module script of `dashboard.html`: call `loadPendingUsers()` and `loadAllUsers()`
      when the Users nav section is activated.

**Relevant Context**
- `dashboard.html` — existing nav pattern, section panels, module script
- `js/db.js` — `getAllUserProfiles()`, `setUserActive()`, `setUserStatus()`, `setUserRole()`,
  `persistDB()`
- `js/auth.js` — `currentUser()`, `requireAuth()`
- `css/components.css` — table styles, button classes

---

## Implementation Notes

- **No migrations affect existing survey/biomass/coral data** — only `users` table is altered.
- **Seeded admin account** is unaffected: `is_active = 1`, no profile row → bypasses
  profile-status check in login.
- **Offline-first**: all changes are local SQLite; `persistDB()` after every mutation keeps
  IndexedDB in sync.
- **No email infrastructure** is needed at any stage.
