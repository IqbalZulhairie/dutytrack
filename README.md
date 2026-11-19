# Duty Track

Duty Track is a cleaning-duty dashboard for office teams. From the home page, admins can:

- View today's assigned team, upcoming duties, and duty completion progress.
- Manage staff profiles and activate or deactivate team members.
- Create, edit, and remove cleaning assignments in daily, weekly, or monthly views. Each assignment requires at least two active staff members.
- Check off cleaning tasks for a selected duty date.
- Preview the planned 8:00 AM duty reminder email.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current prototype limitations

Staff, schedules, and checklist progress are stored in the browser's local storage. The app does not yet synchronize data across users or devices. The reminder page is a preview only: actual email delivery, an email provider, and a server-side scheduler must be configured before automatic notifications can be sent.

## Send a test email

For local testing, add these values to `.env.local` (never commit the Resend API key):

```env
RESEND_API_KEY=your_resend_api_key
RESEND_TEST_RECIPIENT=your_test_address@example.com
# Optional; use a sender verified in Resend for your account.
RESEND_FROM_EMAIL=onboarding@resend.dev
```

Restart the dev server, open `/admin/user/resend`, and click **Send one test email**. The test only sends after the button is submitted, only to `RESEND_TEST_RECIPIENT`, and is disabled in production. It sends immediately and does not create or schedule a cleaning duty.

## Configure sign-in and user registration

The login and registration pages use Supabase Auth. User registration also creates a matching row in `profiles`; if that insert fails, the newly created Auth user is removed.

Add the Supabase service-role key to the server environment (do not use a `NEXT_PUBLIC_` prefix and never expose this key in browser code):

```env
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Before registration can be used, create the first Auth user in the Supabase dashboard so someone can sign in. No profile is required for that initial account. Any signed-in user can use the registration form, but the server only permits creating accounts with the `staff` role. Restart the app after changing environment variables.
