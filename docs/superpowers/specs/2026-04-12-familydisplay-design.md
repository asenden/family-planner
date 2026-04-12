# FamilyDisplay – Design Spec

## Overview

FamilyDisplay is an open-source family organization dashboard. It runs as a web app on a wall-mounted tablet (kiosk mode) and pairs with a native iOS companion app. Families self-host it via Docker Compose on a VPS.

**Target audience:** Friends, family, and the open-source community. Non-technical users should be able to set it up with minimal effort (one `docker compose up` + a setup wizard).

## Architecture

### Stack

| Component | Technology |
|-----------|-----------|
| Frontend (Display) | Next.js 15 (App Router), React, TypeScript |
| Backend / API | Next.js API Routes |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | NextAuth.js |
| Realtime | Server-Sent Events (SSE) |
| AI | Claude API (Anthropic) |
| Calendar Sync | Google Calendar API (bidirectional) |
| i18n | next-intl |
| Companion App | Native Swift / iOS |
| Deployment | Docker Compose |

### System Diagram

```
┌─────────────────────────────────────────────┐
│              VPS (Docker Compose)            │
│                                              │
│  ┌──────────────────┐  ┌──────────────────┐ │
│  │   Next.js App     │  │   PostgreSQL     │ │
│  │                    │  │                  │ │
│  │  - Web Dashboard   │──│  - Families      │ │
│  │  - API Routes      │  │  - Calendar      │ │
│  │  - Auth (NextAuth) │  │  - Routines      │ │
│  │  - Claude API      │  │  - Meals         │ │
│  │  - Cron Jobs       │  │  - Photos        │ │
│  └──────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────┘
        │                    │
   ┌────┴────┐         ┌────┴────┐
   │ Tablet  │         │  iOS    │
   │ Browser │         │  App    │
   │ (Kiosk) │         │(Swift)  │
   └─────────┘         └─────────┘
```

### Key Decisions

- **Monolith over microservices:** One codebase, one deployment unit. Simplest for self-hosters and contributors. Can be decomposed later if needed.
- **SSE over WebSockets:** Simpler, works through proxies, no extra server needed. Sufficient for dashboard update frequencies.
- **Next.js API Routes as the API:** The iOS companion app consumes the same API routes as the web frontend. No separate backend service.
- **VPS over local server:** Enables companion app access from anywhere without tunneling/DynDNS complexity.

## Features

### 1. Dashboard (Tablet Display)

The main view is a widget-based dashboard optimized for a landscape tablet mounted on a wall.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  ☀️ 18°C    Montag, 14. April 2026    14:32 │  ← Top-Bar
├─────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Calendar  │ │ Routines │ │ Pinboard │    │  ← Row 1
│  └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │   Meal   │ │ Feelings │ │  Photos  │    │  ← Row 2
│  └──────────┘ └──────────┘ └──────────┘    │
└─────────────────────────────────────────────┘
```

- **Top-Bar:** Always visible. Shows current weather, date, and time.
- **Widget Grid:** 3x2 equally-sized widgets. Each widget shows a compact summary.
- **Tap interaction:** Tapping a widget opens its full-screen view with full interactivity (creating events, checking off tasks, writing messages, etc.).
- **Back navigation:** Swipe from edge or back button returns to dashboard.
- **Idle behavior:** After 5 minutes of no interaction, the display switches to a full-screen photo gallery screensaver. Any tap returns to the dashboard.

**Widget compact contents:**

| Widget | Shows |
|--------|-------|
| Calendar | Next 3-4 events with family member color + avatar photo |
| Routines | Per child: name, progress bar, points balance |
| Pinboard | Last 3 messages |
| Meal | Today's dinner + "Tap for recipe" |
| Feelings | Emoji picker, shows who already checked in today |
| Photos | Rotating photo from the gallery |

### 2. Family Calendar

- Syncs bidirectionally with Google Calendar (Outlook and Apple Calendar planned for later).
- Each family member can connect their own calendar via OAuth2.
- Events show the assigned family member's color and avatar photo.
- Sync runs as a cron job every 5 minutes. Changes are pushed to clients via SSE immediately.
- Conflict detection via `externalId` + `lastSyncedAt` timestamp.
- Full-screen view: day/week view with event creation and editing.

### 3. Routines + Reward System

- Parents create visual routines (step-by-step task lists) for children.
- Each routine has a schedule: daily, weekdays, or custom days.
- Children tap to check off tasks on the display or companion app.
- Completed tasks earn points.
- Parents define rewards with point costs (e.g., "30 min extra screen time = 50 points").
- Children can redeem rewards when they have enough points.
- Full-screen view: all routines for the day, progress tracking, reward shop.

### 4. AI Meal Planner

- Uses Claude API to generate weekly meal plans.
- Input: family size, dietary preferences, allergies, budget level.
- Claude receives context about past meals to avoid repetition.
- Output: structured JSON with meals and grocery list items.
- Users can regenerate individual meals or the full week.
- Grocery list is auto-generated from the meal plan.
- Grocery items can be manually added and checked off.
- Uses Claude API tool use for structured JSON responses.
- Future: delivery service integration (e.g., REWE, requires reverse-engineered or third-party API).

### 5. Feelings Check-in

- Each family member can select an emoji representing their current mood.
- Available moods: happy, neutral, sad, angry, excited (extensible).
- Optional: add a short note.
- Dashboard widget shows who has checked in today.
- Full-screen view: today's check-ins for all members, weekly history.

### 6. Photo Gallery

- Family members upload photos via the companion app.
- Photos rotate in the dashboard widget.
- Full-screen gallery view with swipe navigation.
- Serves as the idle screensaver after 5 minutes.
- Photos stored on the server filesystem, metadata in the database.

### 7. Family Pinboard

- Short text messages between family members.
- Messages show author avatar and timestamp.
- Optional expiry date (e.g., "pick up milk" expires end of day).
- Full-screen view: all messages, compose new message.

### 8. Weather + Time (Top-Bar)

- Current weather conditions and temperature.
- Uses a free weather API (e.g., Open-Meteo, no API key required).
- Current date (localized) and time.
- Always visible, including in full-screen widget views.

## Data Model

```
Family
├── id, name, inviteCode (6-digit), theme, locale
│
├── FamilyMember
│   ├── id, name, avatar (photo URL), color, pin (for companion app)
│   ├── role: "parent" | "child"
│   └── email (optional, for auth)
│
├── CalendarEvent
│   ├── id, title, description, start, end, allDay
│   ├── assignedTo → FamilyMember[]
│   ├── externalId, lastSyncedAt
│   └── source: "local" | "google" | "outlook" | "apple"
│
├── Routine
│   ├── id, title, icon, assignedTo → FamilyMember
│   ├── schedule: "daily" | "weekdays" | "custom"
│   ├── customDays: number[] (0-6, if custom)
│   └── RoutineTask[]
│       ├── id, title, icon, order, points
│       └── RoutineCompletion[] (date, completedAt)
│
├── Reward
│   ├── id, title, icon, cost (points)
│   └── RewardRedemption[] (memberId, redeemedAt)
│
├── Meal
│   ├── id, date, type: "breakfast" | "lunch" | "dinner"
│   ├── title, recipe (JSON), servings
│   └── generatedBy: "ai" | "manual"
│
├── GroceryList
│   ├── id, weekOf
│   └── GroceryItem[] (name, quantity, unit, checked, source → Meal?)
│
├── FeelingCheckin
│   ├── id, memberId → FamilyMember, date
│   ├── feeling: "happy" | "neutral" | "sad" | "angry" | "excited"
│   └── note (optional)
│
├── PinboardMessage
│   ├── id, authorId → FamilyMember
│   ├── content, createdAt
│   └── expiresAt (optional)
│
└── Photo
    ├── id, filePath, uploadedBy → FamilyMember
    ├── caption (optional)
    └── showInGallery: boolean
```

**Design decisions:**
- Each family member has a unique **color** used consistently across calendar, routines, and avatars.
- **Points** are per-task, not per-routine. Different tasks can have different point values.
- **GroceryItem** optionally links back to a Meal for traceability.
- **Photo** stores `filePath` (server filesystem), not a URL. Served via a Next.js API route.

## Authentication

### Display (Tablet)

1. First-time setup: enter a 6-digit family invite code.
2. Session persists permanently (no re-login).
3. Family member selection via tap on avatar (for personalized actions like feelings check-in, routine completion).
4. No password required at the display.

### Companion App (iOS)

1. Login with email + password or magic link.
2. JWT token stored securely on device.
3. User is linked to a family and a family member profile.
4. Full feature access: all CRUD operations, photo upload, settings.

### Family Creation

1. First user creates a family via the setup wizard or companion app.
2. A 6-digit invite code is generated.
3. Other members join using the invite code.
4. Parents can manage members and regenerate the invite code.

## Theming

Themes are TypeScript objects defining colors, typography, border radius, and icon style.

```typescript
interface Theme {
  name: string;
  colors: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    textMuted: string;
  };
  borderRadius: string;
  fontFamily: string;
  iconStyle: "emoji" | "outline" | "filled";
}
```

- **Default theme:** "Playful" – colorful, rounded corners, emoji icons, Nunito font.
- Applied via CSS Custom Properties (`var(--color-primary)`, etc.).
- Theme selected per family in settings.
- Community can contribute themes as JSON files.

## Internationalization

- All UI strings in locale files via `next-intl`.
- English keys in code, German as first translation.
- Locale selectable per family.
- Date/time formatting respects locale.
- AI meal planner prompts adapt to the selected locale.

## Deployment

### Docker Compose

```yaml
services:
  app:
    image: familydisplay/app:latest
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=postgresql://fd:fd@db:5432/familydisplay
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    depends_on: [db]
  db:
    image: postgres:16-alpine
    volumes: ["pgdata:/var/lib/postgresql/data"]
    environment:
      - POSTGRES_USER=fd
      - POSTGRES_PASSWORD=fd
      - POSTGRES_DB=familydisplay
volumes:
  pgdata:
```

### Setup Flow

1. User runs `docker compose up` on their VPS.
2. Opens `http://<vps-ip>:3000` in a browser.
3. Setup wizard: create family name, first parent account, choose theme and locale.
4. Wizard generates the family invite code.
5. Tablet: open the URL, enter the invite code → dashboard appears.
6. Companion app: download, login, enter invite code → linked.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CLAUDE_API_KEY` | Yes | Anthropic API key for meal planner |
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `GOOGLE_CLIENT_ID` | No | For Google Calendar sync |
| `GOOGLE_CLIENT_SECRET` | No | For Google Calendar sync |

## Companion App (iOS)

Native Swift app communicating with the Next.js API.

### Screens

| Screen | Purpose |
|--------|---------|
| Login | Email + password or magic link |
| Dashboard | Same widgets as tablet, mobile-optimized (single column) |
| Calendar | Full month/week view, create and edit events |
| Routines | Check off tasks, view progress, redeem rewards |
| Meal Planner | Weekly plan, AI suggestions, grocery list |
| Pinboard | Read and write messages |
| Photos | Upload photos, manage gallery |
| Feelings | Check in, view family history |
| Settings | Family management, members, theme, calendar sync, locale |

### API Communication

- REST API via Next.js API Routes.
- Auth: JWT bearer token in Authorization header.
- Realtime: SSE connection for live updates.
- Photo upload: multipart form data to a dedicated upload endpoint.

## Non-Goals (explicitly out of scope for MVP)

- Android companion app (web app works on Android browsers)
- Delivery service integration (REWE etc.) – planned for post-MVP
- Video/audio messages on pinboard
- Multi-family support per user
- Push notifications on iOS (planned for post-MVP)
- Apple Calendar / Outlook sync (Google Calendar only for MVP)
- Offline mode for companion app
