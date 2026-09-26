Mini It Project 2620 G04

## FastAPI backend

`main.py` is the deployment entrypoint. It exposes native FastAPI routes and mounts the existing Flask blueprints through a WSGI compatibility layer, so existing paths such as `/api/auth/...` and `/api/admin/...` remain unchanged while routes are migrated incrementally.

Set the database to the Supabase transaction pooler on port `6543`:

```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

The backend requires PostgreSQL through the Supabase transaction pooler. It does
not fall back to a local SQLite database when PostgreSQL is unavailable; a
connection failure is logged and startup stops. Apply `supabase_for_you_feed.sql`
in the Supabase SQL editor when deploying hashtag search and personalized tag ranking.

The backend uses `pool_pre_ping=true`, `pool_recycle=280`, and `pool_size=10` for PostgreSQL. Start it locally with `uvicorn main:app --host 0.0.0.0 --port 8000`, or deploy with the included `Procfile` command: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000`.

## Next.js frontend

The frontend is now available as a Next.js App Router application with Tailwind CSS. The original Flask API and legacy static pages remain in place while the new frontend is migrated incrementally.

### Run locally

1. Install Node.js 18.17+ (Node.js 20 LTS recommended).
2. Copy `.env.local.example` to `.env.local` and adjust the API origin if needed.
3. Run `npm install` to install `@supabase/supabase-js` and the Next.js dependencies.
4. Run `npm run dev` and open `http://localhost:3000`.

The Following feed uses the browser Supabase client from `lib/supabaseClient.js`; For You requests the backend's `/api/posts` hybrid recommendation ranking. Configure Supabase RLS policies to allow the intended anon `select` access for `posts`, `users`, and `follows`; missing configuration, denied reads, and empty results render the normal empty states instead of interrupting the page.

The main Feed is at `/` and the Admin Dashboard is at `/admin`. Authentication, post loading, search, and post creation reuse the existing `/api` contract and browser keys (`aero_token` and `aero_user`).
