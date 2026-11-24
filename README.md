# Duty Track

Duty Track is a cleaning-duty dashboard for office teams. From the home page, admins can:

- View today's assigned team, upcoming duties, and duty completion progress.
- Manage staff profiles and activate or deactivate team members.
- Create, edit, and remove cleaning assignments in daily, weekly, or monthly views. Assignments require at least two active staff members and one or more cleaning tasks; new duties can repeat on selected weekdays between start and end dates (up to one year).
- Check off cleaning tasks for a selected duty date.
- Send each assigned staff member a private duty reminder at an administrator-configured time.

## Run locally

1. Start MySQL or MariaDB in Laragon.
2. Ensure the database contains the existing `profiles`, `roles`, `sessions`, and `cleaning_tasks` tables. Run [`database/migrate-profiles-auth.sql`](./database/migrate-profiles-auth.sql) once in phpMyAdmin or HeidiSQL to connect sessions to profiles, then run [`database/migrate-duty-tasks.sql`](./database/migrate-duty-tasks.sql) to create or repair the `duties` table, including its auto-incrementing integer ID and per-duty task assignments.
3. Add `DATABASE_URL` from `.env.example` to `.env.local` and set it to your Laragon database credentials. Preserve any other local environment settings you still need. URL-encode special characters in the username or password.
4. Install dependencies and run the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000/setup](http://localhost:3000/setup) once to create the first administrator. After that, sign in at [http://localhost:3000/login](http://localhost:3000/login). The initial administrator setup is disabled once an admin account exists.

Staff accounts, cleaning tasks, schedules, checklist progress, and login sessions are stored in the configured local MySQL/MariaDB database. Supabase is no longer used. Existing Supabase records and passwords are not copied automatically; create accounts and re-enter data in the local database.

## Automatic duty reminders

The reminder job uses Resend and the Windows Task Scheduler. It sends one email per active staff member assigned to that day's duty, with only that duty's active cleaning tasks. Admins can choose the daily send time in **Admin → Reminders** (Malaysia time; defaults to 8:00 AM). A delivery table prevents duplicate emails and records failures for retry.

1. Add these values to `.env.local`. `RESEND_FROM_EMAIL` must be a sender address verified in your Resend account. `RESEND_TEST_RECIPIENT` is only used by the manual test-email page.

   ```env
   RESEND_API_KEY=your_resend_api_key
   RESEND_FROM_EMAIL=reminders@your-verified-domain.com
   REMINDER_TIMEZONE=Asia/Kuala_Lumpur
   ```

2. Run [`database/migrate-duty-reminders.sql`](./database/migrate-duty-reminders.sql) once in phpMyAdmin or HeidiSQL.
3. Keep Windows and Laragon MySQL available, then register the reminder task from the project directory. It checks the configured time once per minute:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\install-duty-reminder-task.ps1
   ```

4. Confirm the database query without sending an email:

   ```powershell
   node .\scripts\send-duty-reminders.mjs --dry-run
   ```

The registered task runs as the current Windows user and requires that user to be signed in at the configured reminder time. Resend failures and successful deliveries are recorded in `duty_reminder_deliveries`.

## Send a test email

For local testing, add these values to `.env.local` (never commit the Resend API key):

```env
RESEND_API_KEY=your_resend_api_key
RESEND_TEST_RECIPIENT=your_test_address@example.com
# Optional; use a sender verified in Resend for your account.
# Use a sender address verified in Resend for your account.
RESEND_FROM_EMAIL=reminders@your-verified-domain.com
```

Restart the dev server, open `/admin/user/resend`, and click **Send one test email**. The test only sends after the button is submitted, only to `RESEND_TEST_RECIPIENT`, and is disabled in production. It sends immediately and does not create or schedule a cleaning duty.
