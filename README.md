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
