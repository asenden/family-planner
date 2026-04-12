# FamilyDisplay

An open-source family organization dashboard designed for a wall-mounted tablet. Built with Next.js, PostgreSQL, and a dark glass-morphism UI.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![License](https://img.shields.io/badge/License-MIT-green)

## What is this?

FamilyDisplay turns any tablet into a smart family hub. Mount it on your wall and get a shared dashboard with calendars, routines, meal planning, and more - all synced across devices.

Think of it as an open-source alternative to [HearthDisplay](https://hearthdisplay.com), [Skylight](https://myskylight.com), or [Cozyla](https://www.cozyla.com) - without the proprietary hardware or subscription fees.

### Key Features

- **Calendar** with CalDAV sync (iCloud, Google Calendar, Nextcloud, any CalDAV server)
- **Recurring events** with RRULE support
- **Weather** with 7-day forecast via Open-Meteo (no API key needed)
- **Family code** system for easy onboarding
- **Dark glass-morphism UI** with Lucide icons and ambient animations
- **Multi-language** (English + German, extensible via next-intl)
- **Theme system** with CSS custom properties
- **Self-hosted** via Docker Compose on any VPS

### Planned Features

- Routines + reward system for kids
- AI-powered meal planner with grocery lists (Claude API)
- Feelings check-in
- Photo gallery / screensaver
- Family pinboard (messages)
- Native iOS companion app (Swift)
- Real-time sync via SSE

## Screenshots

The dashboard uses a dark gradient background with frosted glass cards, Lucide SVG icons, and staggered slide-up animations.

**Dashboard** - 6 widget cards in a 3x2 grid with a top bar showing weather, date, and time.

**Calendar** - Day, week, and month views. Column mode shows events per family member. Click events to edit/delete.

**Settings** - Gear icon in the top bar opens a modal for managing family members, CalDAV calendar connections, location, and sharing the family code.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL 16 + Prisma 7 |
| Styling | Tailwind CSS 4 + CSS Custom Properties |
| Icons | Lucide React |
| Auth | Cookie-based family code |
| Calendar Sync | tsdav (CalDAV) + ical.js |
| Weather | Open-Meteo API (free, no key) |
| i18n | next-intl |
| Deployment | Docker Compose |

## Quick Start

### Prerequisites

- A VPS or server with Docker installed (e.g., [Hetzner CX22](https://www.hetzner.com/cloud/), ~4/mo)
- A domain pointing to your server (optional but recommended for HTTPS)

### 1. Clone

```bash
git clone https://github.com/asenden/family-planner.git
cd family-planner
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
DATABASE_URL=postgresql://fd:fd@db:5432/familydisplay
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
CLAUDE_API_KEY=            # optional, for future meal planner
CRON_SECRET=               # optional, for securing sync endpoint
```

### 3. Deploy

```bash
docker compose up -d --build
```

The app starts on port 3000. If using Nginx as a reverse proxy:

```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Add HTTPS with: `certbot --nginx -d your-domain.com`

### 4. Initial Setup

1. Open `https://your-domain.com` in a browser
2. Click **"Create a new Family"**
3. Enter family name, your name, email, password, and pick a color
4. You'll receive a **6-digit family code** - share it with family members
5. Set your location in Settings (gear icon) for weather

### 5. Connect Calendars

1. Click the gear icon in the top bar
2. Go to **Calendar Connectors**
3. Click **Add Calendar**
4. Choose your provider (iCloud, Google, or other CalDAV)
5. Enter credentials (for iCloud: use an [app-specific password](https://support.apple.com/en-us/102654))
6. Select which calendars to sync
7. Events appear on the dashboard immediately

## Development

### Local Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker compose up db -d

# Run migrations
npx prisma migrate dev

# Start dev server
npm run dev
```

Open `http://localhost:3000`.

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

### Project Structure

```
src/
  app/
    [locale]/
      dashboard/          # Main dashboard with widgets
        _components/
          TopBar.tsx       # Weather, date, time, settings gear
          WidgetGrid.tsx   # 3x2 widget layout
          CalendarWidget.tsx
          CalendarFullView.tsx
          SettingsModal.tsx
          WeatherModal.tsx
          DashboardClient.tsx
      setup/              # Family creation wizard
      join/               # Join family with code
      settings/
        calendar/         # CalDAV account management
    api/
      auth/               # Family code cookie auth
      families/           # Family CRUD
      geocode/            # Location search (Open-Meteo)
      cron/               # Calendar sync endpoint
  lib/
    caldav/
      client.ts           # CalDAV connection (tsdav)
      parser.ts           # ICS <-> event conversion
      sync.ts             # Bidirectional sync engine
    calendar/
      expand-recurring.ts # RRULE expansion
    weather.ts            # Open-Meteo integration
    db.ts                 # Prisma client singleton
    auth.ts               # NextAuth config
  theme/                  # Theme system (playful, minimal)
  i18n/                   # Internationalization config
messages/
  en.json                 # English translations
  de.json                 # German translations
prisma/
  schema.prisma           # Database schema (14 models)
```

### Database Schema

The app uses 15 Prisma models:

- **Family** - name, invite code, theme, locale, location
- **FamilyMember** - name, avatar, color, role (parent/child)
- **CalendarEvent** - title, start/end, recurrence (RRULE), assigned members
- **CalendarAccount** - CalDAV credentials, calendar selection, sync state
- **Routine / RoutineTask / RoutineCompletion** - chore tracking (planned)
- **Reward / RewardRedemption** - reward system (planned)
- **Meal / GroceryList / GroceryItem** - meal planning (planned)
- **FeelingCheckin** - mood tracking (planned)
- **PinboardMessage** - family messages (planned)
- **Photo** - family photo gallery (planned)

### Adding a New Language

1. Create `messages/xx.json` (copy from `en.json`)
2. Translate all strings
3. Add `"xx"` to the `locales` array in `src/i18n/config.ts`

### Adding a New Theme

Create a file in `src/theme/`:

```typescript
import type { Theme } from "./types";

export const myTheme: Theme = {
  name: "My Theme",
  colors: {
    background: "#...",
    surface: "...",
    primary: "#...",
    secondary: "#...",
    accent: "#...",
    text: "#...",
    textMuted: "...",
  },
  borderRadius: "16px",
  fontFamily: "'Your Font', sans-serif",
  iconStyle: "emoji",
};
```

Register it in `src/theme/index.ts`.

## CalDAV Sync

FamilyDisplay uses the CalDAV protocol for calendar sync, which means it works with:

- **Apple iCloud** (requires app-specific password)
- **Google Calendar** (via CalDAV endpoint)
- **Nextcloud**
- **Synology Calendar**
- **Any CalDAV-compatible server**

Sync runs automatically every 5 minutes when the dashboard is loaded. Events are reconciled bidirectionally - remote changes are imported, and the sync tracks which account each event belongs to so calendars can be toggled independently.

## Contributing

Contributions are welcome! The project uses:

- **TDD** - tests first, then implementation
- **Vitest** for testing
- **Conventional commits** (`feat:`, `fix:`, `chore:`)

## License

MIT
