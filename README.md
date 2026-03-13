# Daily Todo Organizer

This app uses Supabase for auth and task storage, so the same list can be used on multiple devices when you sign in with the same email.

## Use

Open the site, enter your email address, and use the magic link Supabase sends you. After signing in, tasks are stored in Supabase and follow your account across devices.

New tasks are automatically labeled as `work` or `personal` using a simple text-based classifier in the frontend.

## Files

- [index.html](/Users/maria.tikhanovskaya/productivity/index.html) renders the app and auth UI.
- [app.js](/Users/maria.tikhanovskaya/productivity/app.js) handles Supabase auth and task CRUD.
- [config.js](/Users/maria.tikhanovskaya/productivity/config.js) holds your public project URL and anon key.
- [supabase.sql](/Users/maria.tikhanovskaya/productivity/supabase.sql) creates the `tasks` table and row-level security policies.
