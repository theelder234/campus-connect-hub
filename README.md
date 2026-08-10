# CampusLink — Smart Campus Interaction Platform

CampusLink brings real-time campus communication, shared academic resources, and AI-powered study support into one app. Built with [Lovable](https://lovable.dev).

## Features

### Real-time communication
- Group, course, and direct channels with live message delivery
- Campus announcements broadcast by faculty and admins, streamed in real time

### Resource sharing
- Secure private file repository for lecture notes, slides, and papers
- Course codes and tags with instant search, signed-URL downloads
- Faculty and admins can mark resources as official

### AI academic support
- **AI Tutor** — 24/7 Socratic tutor that guides students to answers instead of handing them over
- **Study Notes & Flashcards** — turn an uploaded PDF, slide deck, or pasted transcript into a summary, key points, and exam-style flashcards you can flip through

### Administration
- Role-based access control (`student`, `faculty`, `admin`) stored in a dedicated roles table
- Admin panel for granting or removing faculty/admin permissions

## Backend

Powered by Lovable Cloud (database, auth, storage, and AI):
- Email/password and Google sign-in, with row-level security on every table
- Private `resources` storage bucket
- AI features run server-side through the Lovable AI Gateway — no API keys in the browser

## Live site

https://campus-networkk.lovable.app — all outgoing emails now link to this URL (the old
`campusLink.mau.edu.ng` address has been removed from templates and the default sender).

## Authentication

### Email + password
Signup sends a 6-digit OTP by email (nodemailer over SMTP). Entering the code confirms the
account and signs the user straight in. A one-time welcome email follows, linking to
https://campus-networkk.lovable.app.

### Google sign-in — verified working
Google uses the managed Lovable OAuth broker (`lovable.auth.signInWithOAuth("google")`),
not a direct Supabase provider call. Tested against the published site:

| Step | Result |
| --- | --- |
| `GET https://campus-networkk.lovable.app/auth` | `200` — sign-in page with "Continue with Google" |
| `GET /~oauth/initiate?provider=google` | `302` → `oauth.lovable.app/initiate` |
| broker initiate | `302` → `accounts.google.com/o/oauth2/v2/auth` (PKCE `S256`, scope `openid email profile`) |

So the Google flow reaches Google's consent screen and returns to the app, where the session
is set and the welcome email is sent. Note: calling the Supabase
`/auth/v1/authorize?provider=google` endpoint directly returns
`Unsupported provider: missing OAuth secret` — that is expected, because credentials live with
the broker, not the Supabase project.

### Welcome emails for Google (and any missed) signups

Google users never enter the OTP flow, so a **watcher endpoint** backs up the in-app trigger:

`GET|POST /api/public/welcome-sweep` — finds up to 50 profiles with `welcome_email_sent = false`,
resolves each address through the auth admin API, sends the branded welcome email via nodemailer,
and flips the flag. Idempotent, so it can run on a schedule.

Auth: `Authorization: Bearer $WELCOME_SWEEP_SECRET` (or `?token=`). The secret is stored in the
backend environment; requests without it get `401`.

Tested:

| Call | Result |
| --- | --- |
| no token | `401 Unauthorized` |
| with token, 3 pending accounts | `{"checked":3,"sent":3,"failed":0}` — emails accepted by Gmail SMTP |
| immediate re-run | `{"checked":0,"sent":0,"failed":0}` — no duplicates |

Schedule it (e.g. every 15 minutes) against the stable URL
`https://project--92757af2-6a20-40fa-b6b3-a431754e3b94.lovable.app/api/public/welcome-sweep`.
Caveat unchanged: raw SMTP works in preview/dev; the published edge runtime may block the socket,
in which case only the transport needs swapping for an HTTP email API.

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Lovable Cloud (Postgres, auth, storage, realtime)
- Lovable AI (Gemini)
