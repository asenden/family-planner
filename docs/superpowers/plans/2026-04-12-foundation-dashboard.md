# Foundation + Dashboard Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the FamilyDisplay project with a working dashboard shell — project scaffolding, database, auth, theming, i18n, and an interactive widget grid on a top-bar dashboard layout.

**Architecture:** Next.js 15 monolith (App Router) with PostgreSQL via Prisma. NextAuth for authentication. next-intl for i18n. CSS custom properties for theming. Docker Compose for deployment.

**Tech Stack:** Next.js 15, TypeScript, PostgreSQL 16, Prisma, NextAuth.js v5, next-intl, Tailwind CSS, Vitest, React Testing Library, Docker

---

## File Structure

```
FamilyDisplay/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .env.local                          (gitignored)
├── package.json
├── tsconfig.json
├── next.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx                  (root layout — html/body + theme vars)
│   │   ├── page.tsx                    (redirect → /[locale]/dashboard)
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── families/route.ts       (POST create family)
│   │   │   ├── families/[familyId]/members/route.ts  (GET list, POST create)
│   │   │   └── families/join/route.ts  (POST join with invite code)
│   │   └── [locale]/
│   │       ├── layout.tsx              (NextIntlClientProvider)
│   │       ├── setup/
│   │       │   └── page.tsx            (setup wizard)
│   │       ├── join/
│   │       │   └── page.tsx            (join family screen)
│   │       └── dashboard/
│   │           ├── page.tsx
│   │           └── _components/
│   │               ├── TopBar.tsx
│   │               ├── WidgetGrid.tsx
│   │               ├── WidgetCard.tsx
│   │               └── IdleScreensaver.tsx
│   ├── lib/
│   │   ├── db.ts                       (Prisma singleton)
│   │   ├── auth.ts                     (NextAuth config)
│   │   └── invite-code.ts             (generate/validate codes)
│   ├── theme/
│   │   ├── types.ts                    (Theme interface)
│   │   ├── playful.ts                  (default theme)
│   │   ├── minimal.ts                  (second theme)
│   │   ├── provider.tsx                (ThemeProvider component)
│   │   └── index.ts                    (barrel export)
│   └── i18n/
│       ├── config.ts                   (locales, defaultLocale)
│       ├── request.ts                  (getRequestConfig)
│       └── routing.ts                  (defineRouting)
├── messages/
│   ├── en.json
│   └── de.json
└── tests/
    ├── setup.ts
    ├── lib/
    │   └── invite-code.test.ts
    ├── theme/
    │   └── themes.test.ts
    ├── api/
    │   ├── families.test.ts
    │   └── members.test.ts
    └── components/
        ├── TopBar.test.tsx
        ├── WidgetGrid.test.tsx
        └── WidgetCard.test.tsx
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Initialize Next.js project**

Run:
```bash
cd /Users/asenden/Projekte/FamilyDisplay
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

When prompted about Turbopack, answer Yes.

Expected: Project files created, `node_modules` installed.

- [ ] **Step 2: Install additional dependencies**

Run:
```bash
npm install prisma @prisma/client next-auth@beta next-intl @anthropic-ai/sdk
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create `tests/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add test script to package.json**

Add to `scripts` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verify setup works**

Run:
```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Update .gitignore and commit**

Append to `.gitignore`:

```
# dependencies
node_modules/

# next
.next/
out/

# env
.env
.env.local
.env*.local

# misc
.DS_Store
*.pem

# debug
npm-debug.log*

# typescript
*.tsbuildinfo
next-env.d.ts
```

Run:
```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project with TypeScript, Tailwind, Vitest"
```

---

### Task 2: Docker Setup

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.env.example`

- [ ] **Step 1: Create Dockerfile**

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

- [ ] **Step 2: Add standalone output to next.config.ts**

Replace `next.config.ts` content:

```typescript
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 3: Create docker-compose.yml**

Create `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://fd:fd@db:5432/familydisplay
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=fd
      - POSTGRES_PASSWORD=fd
      - POSTGRES_DB=familydisplay
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fd -d familydisplay"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
```

- [ ] **Step 4: Create .env.example**

Create `.env.example`:

```env
# Database
DATABASE_URL="postgresql://fd:fd@localhost:5432/familydisplay"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-here"

# Claude API (for meal planner)
CLAUDE_API_KEY="sk-ant-..."

# Google Calendar (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

- [ ] **Step 5: Create local .env.local for development**

Run:
```bash
cp .env.example .env.local
```

Replace `NEXTAUTH_SECRET` with a generated value:

```bash
openssl rand -base64 32
```

Paste the output as the `NEXTAUTH_SECRET` value in `.env.local`.

- [ ] **Step 6: Commit**

Run:
```bash
git add Dockerfile docker-compose.yml .env.example next.config.ts
git commit -m "feat: add Docker setup with PostgreSQL"
```

---

### Task 3: Prisma Schema (Core Models)

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`

- [ ] **Step 1: Initialize Prisma**

Run:
```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and updates `.env` (we use `.env.local` instead).

- [ ] **Step 2: Write the schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Family {
  id         String   @id @default(cuid())
  name       String
  inviteCode String   @unique @db.VarChar(6)
  theme      String   @default("playful")
  locale     String   @default("de")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  members          FamilyMember[]
  calendarEvents   CalendarEvent[]
  routines         Routine[]
  rewards          Reward[]
  meals            Meal[]
  groceryLists     GroceryList[]
  pinboardMessages PinboardMessage[]
  photos           Photo[]
}

model FamilyMember {
  id       String @id @default(cuid())
  name     String
  avatar   String?
  color    String
  pin      String? @db.VarChar(4)
  role     Role
  email    String? @unique
  password String?

  familyId String
  family   Family @relation(fields: [familyId], references: [id], onDelete: Cascade)

  calendarEvents     CalendarEvent[] @relation("EventAssignees")
  routines           Routine[]
  routineCompletions RoutineCompletion[]
  rewardRedemptions  RewardRedemption[]
  feelingCheckins    FeelingCheckin[]
  pinboardMessages   PinboardMessage[]
  photos             Photo[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  parent
  child
}

model CalendarEvent {
  id           String   @id @default(cuid())
  title        String
  description  String?
  start        DateTime
  end          DateTime
  allDay       Boolean  @default(false)
  externalId   String?
  source       CalendarSource @default(local)
  lastSyncedAt DateTime?

  familyId   String
  family     Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  assignedTo FamilyMember[] @relation("EventAssignees")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([familyId, start])
  @@index([externalId])
}

enum CalendarSource {
  local
  google
  outlook
  apple
}

model Routine {
  id         String         @id @default(cuid())
  title      String
  icon       String
  schedule   RoutineSchedule
  customDays Int[]

  familyId   String
  family     Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  assignedTo String
  member     FamilyMember @relation(fields: [assignedTo], references: [id], onDelete: Cascade)
  tasks      RoutineTask[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum RoutineSchedule {
  daily
  weekdays
  custom
}

model RoutineTask {
  id     String @id @default(cuid())
  title  String
  icon   String
  order  Int
  points Int    @default(1)

  routineId   String
  routine     Routine @relation(fields: [routineId], references: [id], onDelete: Cascade)
  completions RoutineCompletion[]
}

model RoutineCompletion {
  id          String   @id @default(cuid())
  date        DateTime @db.Date
  completedAt DateTime @default(now())

  taskId   String
  task     RoutineTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  memberId String
  member   FamilyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([taskId, memberId, date])
}

model Reward {
  id   String @id @default(cuid())
  title String
  icon  String
  cost  Int

  familyId    String
  family      Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  redemptions RewardRedemption[]

  createdAt DateTime @default(now())
}

model RewardRedemption {
  id         String   @id @default(cuid())
  redeemedAt DateTime @default(now())

  rewardId String
  reward   Reward @relation(fields: [rewardId], references: [id], onDelete: Cascade)
  memberId String
  member   FamilyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
}

model Meal {
  id          String   @id @default(cuid())
  date        DateTime @db.Date
  type        MealType
  title       String
  recipe      Json?
  servings    Int      @default(4)
  generatedBy MealSource @default(manual)

  familyId String
  family   Family @relation(fields: [familyId], references: [id], onDelete: Cascade)

  groceryItems GroceryItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([familyId, date, type])
}

enum MealType {
  breakfast
  lunch
  dinner
}

enum MealSource {
  ai
  manual
}

model GroceryList {
  id     String   @id @default(cuid())
  weekOf DateTime @db.Date

  familyId String
  family   Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  items    GroceryItem[]

  createdAt DateTime @default(now())

  @@unique([familyId, weekOf])
}

model GroceryItem {
  id       String  @id @default(cuid())
  name     String
  quantity Float?
  unit     String?
  checked  Boolean @default(false)

  groceryListId String
  groceryList   GroceryList @relation(fields: [groceryListId], references: [id], onDelete: Cascade)
  mealId        String?
  meal          Meal? @relation(fields: [mealId], references: [id], onDelete: SetNull)
}

model FeelingCheckin {
  id      String  @id @default(cuid())
  date    DateTime @db.Date
  feeling Feeling
  note    String?

  memberId String
  member   FamilyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([memberId, date])
}

enum Feeling {
  happy
  neutral
  sad
  angry
  excited
}

model PinboardMessage {
  id        String    @id @default(cuid())
  content   String
  expiresAt DateTime?

  authorId String
  author   FamilyMember @relation(fields: [authorId], references: [id], onDelete: Cascade)
  familyId String
  family   Family @relation(fields: [familyId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
}

model Photo {
  id            String  @id @default(cuid())
  filePath      String
  caption       String?
  showInGallery Boolean @default(true)

  uploadedBy   String
  uploader     FamilyMember @relation(fields: [uploadedBy], references: [id], onDelete: Cascade)
  familyId     String

  createdAt DateTime @default(now())
}
```

- [ ] **Step 3: Create Prisma singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

- [ ] **Step 4: Start local PostgreSQL and run migration**

Start a local PostgreSQL for development (if not using Docker for dev):

```bash
docker compose up db -d
```

Run the migration:

```bash
npx prisma migrate dev --name init
```

Expected: Migration created, database tables created.

- [ ] **Step 5: Verify with Prisma Studio**

Run:
```bash
npx prisma studio
```

Expected: Browser opens showing all tables (empty). Close with Ctrl+C.

- [ ] **Step 6: Commit**

Run:
```bash
git add prisma/schema.prisma prisma/migrations src/lib/db.ts
git commit -m "feat: add Prisma schema with all core data models"
```

---

### Task 4: Theme System

**Files:**
- Create: `src/theme/types.ts`, `src/theme/playful.ts`, `src/theme/minimal.ts`, `src/theme/provider.tsx`, `src/theme/index.ts`
- Test: `tests/theme/themes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/theme/themes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { themes, getTheme, type Theme } from "@/theme";

describe("Theme system", () => {
  it("exports a playful theme as default", () => {
    const theme = getTheme("playful");
    expect(theme).toBeDefined();
    expect(theme.name).toBe("Playful");
    expect(theme.colors.primary).toBeDefined();
    expect(theme.colors.background).toBeDefined();
    expect(theme.borderRadius).toBeDefined();
    expect(theme.fontFamily).toBeDefined();
    expect(theme.iconStyle).toBe("emoji");
  });

  it("exports a minimal theme", () => {
    const theme = getTheme("minimal");
    expect(theme).toBeDefined();
    expect(theme.name).toBe("Minimal");
  });

  it("falls back to playful for unknown theme", () => {
    const theme = getTheme("nonexistent");
    expect(theme.name).toBe("Playful");
  });

  it("lists all available themes", () => {
    expect(Object.keys(themes).length).toBeGreaterThanOrEqual(2);
    expect(themes.playful).toBeDefined();
    expect(themes.minimal).toBeDefined();
  });

  it("all themes satisfy the Theme interface", () => {
    const requiredColors = [
      "background",
      "surface",
      "primary",
      "secondary",
      "accent",
      "text",
      "textMuted",
    ] as const;

    for (const [, theme] of Object.entries(themes)) {
      for (const color of requiredColors) {
        expect(theme.colors[color]).toBeDefined();
        expect(theme.colors[color]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/theme/themes.test.ts
```

Expected: FAIL — cannot find module `@/theme`.

- [ ] **Step 3: Implement theme types**

Create `src/theme/types.ts`:

```typescript
export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textMuted: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  borderRadius: string;
  fontFamily: string;
  iconStyle: "emoji" | "outline" | "filled";
}
```

- [ ] **Step 4: Implement playful theme**

Create `src/theme/playful.ts`:

```typescript
import type { Theme } from "./types";

export const playful: Theme = {
  name: "Playful",
  colors: {
    background: "#FFF5E6",
    surface: "#FFFFFF",
    primary: "#FF6B6B",
    secondary: "#4ECDC4",
    accent: "#FFE66D",
    text: "#2D3436",
    textMuted: "#636E72",
  },
  borderRadius: "16px",
  fontFamily: "'Nunito', sans-serif",
  iconStyle: "emoji",
};
```

- [ ] **Step 5: Implement minimal theme**

Create `src/theme/minimal.ts`:

```typescript
import type { Theme } from "./types";

export const minimal: Theme = {
  name: "Minimal",
  colors: {
    background: "#F8F9FA",
    surface: "#FFFFFF",
    primary: "#212529",
    secondary: "#6C757D",
    accent: "#0D6EFD",
    text: "#212529",
    textMuted: "#6C757D",
  },
  borderRadius: "8px",
  fontFamily: "'Inter', sans-serif",
  iconStyle: "outline",
};
```

- [ ] **Step 6: Implement barrel export with getTheme**

Create `src/theme/index.ts`:

```typescript
export type { Theme, ThemeColors } from "./types";
import { playful } from "./playful";
import { minimal } from "./minimal";
import type { Theme } from "./types";

export const themes: Record<string, Theme> = {
  playful,
  minimal,
};

export function getTheme(id: string): Theme {
  return themes[id] ?? themes.playful;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/theme/themes.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 8: Implement ThemeProvider**

Create `src/theme/provider.tsx`:

```tsx
"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getTheme, type Theme } from "./index";

const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used within ThemeProvider");
  return theme;
}

export function ThemeProvider({
  themeId,
  children,
}: {
  themeId: string;
  children: ReactNode;
}) {
  const theme = useMemo(() => getTheme(themeId), [themeId]);

  const cssVars = useMemo(
    () =>
      ({
        "--color-background": theme.colors.background,
        "--color-surface": theme.colors.surface,
        "--color-primary": theme.colors.primary,
        "--color-secondary": theme.colors.secondary,
        "--color-accent": theme.colors.accent,
        "--color-text": theme.colors.text,
        "--color-text-muted": theme.colors.textMuted,
        "--border-radius": theme.borderRadius,
        "--font-family": theme.fontFamily,
      }) as React.CSSProperties,
    [theme]
  );

  return (
    <ThemeContext.Provider value={theme}>
      <div style={cssVars} className="contents">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 9: Commit**

Run:
```bash
git add src/theme tests/theme
git commit -m "feat: add theme system with playful and minimal themes"
```

---

### Task 5: i18n Setup

**Files:**
- Create: `src/i18n/config.ts`, `src/i18n/request.ts`, `src/i18n/routing.ts`, `messages/en.json`, `messages/de.json`, `src/middleware.ts`

- [ ] **Step 1: Create i18n config**

Create `src/i18n/config.ts`:

```typescript
export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "de";
```

- [ ] **Step 2: Create routing config**

Create `src/i18n/routing.ts`:

```typescript
import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
});
```

- [ ] **Step 3: Create request config**

Create `src/i18n/request.ts`:

```typescript
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as typeof routing.locales[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 4: Create middleware for locale routing**

Create `src/middleware.ts`:

```typescript
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

- [ ] **Step 5: Create message files**

Create `messages/en.json`:

```json
{
  "common": {
    "appName": "FamilyDisplay",
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "back": "Back",
    "next": "Next",
    "done": "Done"
  },
  "setup": {
    "title": "Welcome to FamilyDisplay",
    "familyName": "Family Name",
    "familyNamePlaceholder": "The Smith Family",
    "yourName": "Your Name",
    "yourNamePlaceholder": "Alex",
    "yourEmail": "Your Email",
    "yourEmailPlaceholder": "alex@example.com",
    "password": "Password",
    "chooseColor": "Choose your color",
    "create": "Create Family",
    "inviteCodeTitle": "Your Family Code",
    "inviteCodeDescription": "Share this code so others can join your family.",
    "goToDashboard": "Go to Dashboard"
  },
  "join": {
    "title": "Join a Family",
    "enterCode": "Enter the 6-digit family code",
    "codePlaceholder": "ABC123",
    "yourName": "Your Name",
    "yourRole": "Your Role",
    "roleParent": "Parent",
    "roleChild": "Child",
    "join": "Join Family"
  },
  "dashboard": {
    "greeting": "Hello, {name}!",
    "widgets": {
      "calendar": "Calendar",
      "routines": "Routines",
      "pinboard": "Pinboard",
      "meal": "Meal",
      "feelings": "Feelings",
      "photos": "Photos"
    },
    "noEvents": "No upcoming events",
    "noMessages": "No messages yet",
    "tapToOpen": "Tap to open"
  },
  "topbar": {
    "today": "Today"
  }
}
```

Create `messages/de.json`:

```json
{
  "common": {
    "appName": "FamilyDisplay",
    "loading": "Laden...",
    "save": "Speichern",
    "cancel": "Abbrechen",
    "back": "Zurück",
    "next": "Weiter",
    "done": "Fertig"
  },
  "setup": {
    "title": "Willkommen bei FamilyDisplay",
    "familyName": "Familienname",
    "familyNamePlaceholder": "Familie Müller",
    "yourName": "Dein Name",
    "yourNamePlaceholder": "Alex",
    "yourEmail": "Deine E-Mail",
    "yourEmailPlaceholder": "alex@beispiel.de",
    "password": "Passwort",
    "chooseColor": "Wähle deine Farbe",
    "create": "Familie erstellen",
    "inviteCodeTitle": "Dein Familien-Code",
    "inviteCodeDescription": "Teile diesen Code, damit andere deiner Familie beitreten können.",
    "goToDashboard": "Zum Dashboard"
  },
  "join": {
    "title": "Einer Familie beitreten",
    "enterCode": "Gib den 6-stelligen Familien-Code ein",
    "codePlaceholder": "ABC123",
    "yourName": "Dein Name",
    "yourRole": "Deine Rolle",
    "roleParent": "Elternteil",
    "roleChild": "Kind",
    "join": "Beitreten"
  },
  "dashboard": {
    "greeting": "Hallo, {name}!",
    "widgets": {
      "calendar": "Kalender",
      "routines": "Routinen",
      "pinboard": "Pinnwand",
      "meal": "Mahlzeit",
      "feelings": "Gefühle",
      "photos": "Fotos"
    },
    "noEvents": "Keine anstehenden Termine",
    "noMessages": "Noch keine Nachrichten",
    "tapToOpen": "Tippen zum Öffnen"
  },
  "topbar": {
    "today": "Heute"
  }
}
```

- [ ] **Step 6: Verify build works with i18n**

Run:
```bash
npm run build
```

Expected: Build succeeds. If there are errors related to the locale layout not existing yet, that's expected — we'll create it in the next steps.

- [ ] **Step 7: Commit**

Run:
```bash
git add src/i18n src/middleware.ts messages
git commit -m "feat: add i18n with next-intl (English + German)"
```

---

### Task 6: Auth (NextAuth v5)

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create NextAuth config**

Create `src/lib/auth.ts`:

```typescript
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const member = await db.familyMember.findUnique({
          where: { email: credentials.email as string },
          include: { family: true },
        });

        if (!member || !member.password) return null;

        // Simple password check — hash in production (see Task 8)
        if (member.password !== credentials.password) return null;

        return {
          id: member.id,
          name: member.name,
          email: member.email,
          familyId: member.familyId,
          role: member.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.familyId = (user as { familyId: string }).familyId;
        token.role = (user as { role: string }).role;
        token.memberId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.familyId = token.familyId as string;
        session.user.role = token.role as string;
        session.user.memberId = token.memberId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/setup",
  },
  session: {
    strategy: "jwt",
  },
});
```

- [ ] **Step 2: Create auth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Extend NextAuth types**

Create `src/types/next-auth.d.ts`:

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      familyId: string;
      role: string;
      memberId: string;
    };
  }

  interface User {
    familyId: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    familyId: string;
    role: string;
    memberId: string;
  }
}
```

- [ ] **Step 4: Commit**

Run:
```bash
git add src/lib/auth.ts src/app/api/auth src/types
git commit -m "feat: add NextAuth v5 with credentials provider"
```

---

### Task 7: Invite Code Utility

**Files:**
- Create: `src/lib/invite-code.ts`
- Test: `tests/lib/invite-code.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/invite-code.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateInviteCode, isValidInviteCode } from "@/lib/invite-code";

describe("generateInviteCode", () => {
  it("generates a 6-character string", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
  });

  it("uses only uppercase letters and digits", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe("isValidInviteCode", () => {
  it("accepts valid 6-char alphanumeric codes", () => {
    expect(isValidInviteCode("ABC123")).toBe(true);
    expect(isValidInviteCode("XYZW99")).toBe(true);
  });

  it("rejects invalid codes", () => {
    expect(isValidInviteCode("abc123")).toBe(false);
    expect(isValidInviteCode("AB12")).toBe(false);
    expect(isValidInviteCode("ABCDEFG")).toBe(false);
    expect(isValidInviteCode("ABC 12")).toBe(false);
    expect(isValidInviteCode("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/lib/invite-code.test.ts
```

Expected: FAIL — cannot find module `@/lib/invite-code`.

- [ ] **Step 3: Implement invite code utility**

Create `src/lib/invite-code.ts`:

```typescript
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
const CODE_LENGTH = 6;

export function generateInviteCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join("");
}

export function isValidInviteCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/lib/invite-code.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/lib/invite-code.ts tests/lib/invite-code.test.ts
git commit -m "feat: add invite code generation and validation"
```

---

### Task 8: API Routes (Families + Members)

**Files:**
- Create: `src/app/api/families/route.ts`, `src/app/api/families/[familyId]/members/route.ts`, `src/app/api/families/join/route.ts`
- Test: `tests/api/families.test.ts`, `tests/api/members.test.ts`

- [ ] **Step 1: Write failing test for family creation**

Create `tests/api/families.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  db: {
    family: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    familyMember: {
      create: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { POST } from "@/app/api/families/route";

describe("POST /api/families", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a family with the first parent member", async () => {
    const mockFamily = {
      id: "fam_1",
      name: "Test Family",
      inviteCode: "ABC123",
      theme: "playful",
      locale: "de",
    };

    const mockMember = {
      id: "mem_1",
      name: "Parent",
      email: "parent@test.com",
      role: "parent",
      color: "#FF6B6B",
      familyId: "fam_1",
    };

    vi.mocked(db.family.create).mockResolvedValue(mockFamily as never);
    vi.mocked(db.familyMember.create).mockResolvedValue(mockMember as never);

    const request = new Request("http://localhost/api/families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyName: "Test Family",
        memberName: "Parent",
        email: "parent@test.com",
        password: "secret123",
        color: "#FF6B6B",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.family.name).toBe("Test Family");
    expect(data.family.inviteCode).toBeDefined();
    expect(data.member.name).toBe("Parent");
    expect(db.family.create).toHaveBeenCalledOnce();
    expect(db.familyMember.create).toHaveBeenCalledOnce();
  });

  it("returns 400 if required fields are missing", async () => {
    const request = new Request("http://localhost/api/families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyName: "Test" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/api/families.test.ts
```

Expected: FAIL — cannot find module `@/app/api/families/route`.

- [ ] **Step 3: Implement POST /api/families**

Create `src/app/api/families/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateInviteCode } from "@/lib/invite-code";

export async function POST(request: Request) {
  const body = await request.json();
  const { familyName, memberName, email, password, color } = body;

  if (!familyName || !memberName || !email || !password || !color) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const inviteCode = generateInviteCode();

  const family = await db.family.create({
    data: {
      name: familyName,
      inviteCode,
    },
  });

  const member = await db.familyMember.create({
    data: {
      name: memberName,
      email,
      password,
      color,
      role: "parent",
      familyId: family.id,
    },
  });

  return NextResponse.json(
    {
      family: {
        id: family.id,
        name: family.name,
        inviteCode: family.inviteCode,
      },
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
      },
    },
    { status: 201 }
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/api/families.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Write failing test for join family**

Create `tests/api/join.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    family: {
      findUnique: vi.fn(),
    },
    familyMember: {
      create: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { POST } from "@/app/api/families/join/route";

describe("POST /api/families/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("joins an existing family with valid invite code", async () => {
    vi.mocked(db.family.findUnique).mockResolvedValue({
      id: "fam_1",
      name: "Test Family",
      inviteCode: "ABC123",
    } as never);

    vi.mocked(db.familyMember.create).mockResolvedValue({
      id: "mem_2",
      name: "Child",
      role: "child",
      color: "#4ECDC4",
      familyId: "fam_1",
    } as never);

    const request = new Request("http://localhost/api/families/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteCode: "ABC123",
        name: "Child",
        role: "child",
        color: "#4ECDC4",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.member.name).toBe("Child");
    expect(data.familyId).toBe("fam_1");
  });

  it("returns 404 for invalid invite code", async () => {
    vi.mocked(db.family.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost/api/families/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteCode: "XXXXXX",
        name: "Child",
        role: "child",
        color: "#4ECDC4",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 6: Implement POST /api/families/join**

Create `src/app/api/families/join/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { inviteCode, name, role, color, email, password } = body;

  if (!inviteCode || !name || !role || !color) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const family = await db.family.findUnique({
    where: { inviteCode },
  });

  if (!family) {
    return NextResponse.json(
      { error: "Invalid invite code" },
      { status: 404 }
    );
  }

  const member = await db.familyMember.create({
    data: {
      name,
      role,
      color,
      email: email || null,
      password: password || null,
      familyId: family.id,
    },
  });

  return NextResponse.json({
    familyId: family.id,
    familyName: family.name,
    member: {
      id: member.id,
      name: member.name,
      role: member.role,
    },
  });
}
```

- [ ] **Step 7: Write failing test for list members**

Create `tests/api/members.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    familyMember: {
      findMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { GET } from "@/app/api/families/[familyId]/members/route";

describe("GET /api/families/[familyId]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all members of a family", async () => {
    const mockMembers = [
      { id: "mem_1", name: "Parent", role: "parent", color: "#FF6B6B", avatar: null },
      { id: "mem_2", name: "Child", role: "child", color: "#4ECDC4", avatar: null },
    ];

    vi.mocked(db.familyMember.findMany).mockResolvedValue(mockMembers as never);

    const request = new Request("http://localhost/api/families/fam_1/members");

    const response = await GET(request, { params: Promise.resolve({ familyId: "fam_1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.members).toHaveLength(2);
    expect(data.members[0].name).toBe("Parent");
  });
});
```

- [ ] **Step 8: Implement GET /api/families/[familyId]/members**

Create `src/app/api/families/[familyId]/members/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ familyId: string }> }
) {
  const { familyId } = await params;

  const members = await db.familyMember.findMany({
    where: { familyId },
    select: {
      id: true,
      name: true,
      role: true,
      color: true,
      avatar: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ members });
}
```

- [ ] **Step 9: Run all API tests**

Run:
```bash
npx vitest run tests/api
```

Expected: All tests PASS.

- [ ] **Step 10: Commit**

Run:
```bash
git add src/app/api tests/api
git commit -m "feat: add API routes for family creation, join, and member listing"
```

---

### Task 9: App Layout + Setup Wizard

**Files:**
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/setup/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update globals.css with theme variables**

Replace `src/app/globals.css`:

```css
@import "tailwindcss";

@import url("https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap");

:root {
  --color-background: #fff5e6;
  --color-surface: #ffffff;
  --color-primary: #ff6b6b;
  --color-secondary: #4ecdc4;
  --color-accent: #ffe66d;
  --color-text: #2d3436;
  --color-text-muted: #636e72;
  --border-radius: 16px;
  --font-family: "Nunito", sans-serif;
}

body {
  font-family: var(--font-family);
  background-color: var(--color-background);
  color: var(--color-text);
}
```

- [ ] **Step 2: Create root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FamilyDisplay",
  description: "Family organization dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 3: Create root page (redirect)**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { defaultLocale } from "@/i18n/config";

export default function RootPage() {
  redirect(`/${defaultLocale}/dashboard`);
}
```

- [ ] **Step 4: Create locale layout**

Create `src/app/[locale]/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { locales } from "@/i18n/config";
import { ThemeProvider } from "@/theme/provider";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  // TODO: Load theme from family settings once auth is wired up
  const themeId = "playful";

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider themeId={themeId}>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create setup wizard page**

Create `src/app/[locale]/setup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const MEMBER_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#FFE66D",
  "#6C5CE7",
  "#A8E6CF",
  "#FF922B",
  "#74B9FF",
  "#FD79A8",
];

type Step = "family" | "invite";

export default function SetupPage() {
  const t = useTranslations("setup");
  const router = useRouter();
  const [step, setStep] = useState<Step>("family");
  const [familyName, setFamilyName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [color, setColor] = useState(MEMBER_COLORS[0]);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError("");
    setLoading(true);

    const res = await fetch("/api/families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyName,
        memberName,
        email,
        password,
        color,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    setInviteCode(data.family.inviteCode);
    setStep("invite");
  }

  if (step === "invite") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div
          className="w-full max-w-md p-8 text-center"
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--border-radius)",
          }}
        >
          <h1 className="text-2xl font-bold mb-2">{t("inviteCodeTitle")}</h1>
          <p className="mb-6" style={{ color: "var(--color-text-muted)" }}>
            {t("inviteCodeDescription")}
          </p>
          <div
            className="text-4xl font-extrabold tracking-[0.3em] py-4 mb-6"
            style={{
              color: "var(--color-primary)",
              backgroundColor: "var(--color-background)",
              borderRadius: "var(--border-radius)",
            }}
          >
            {inviteCode}
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-3 text-white font-bold cursor-pointer"
            style={{
              backgroundColor: "var(--color-primary)",
              borderRadius: "var(--border-radius)",
            }}
          >
            {t("goToDashboard")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-md p-8"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--border-radius)",
        }}
      >
        <h1 className="text-2xl font-bold mb-6 text-center">{t("title")}</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm">
            {error}
          </div>
        )}

        <label className="block mb-1 font-semibold text-sm">
          {t("familyName")}
        </label>
        <input
          type="text"
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
          placeholder={t("familyNamePlaceholder")}
          className="w-full mb-4 p-3 border border-gray-200 outline-none"
          style={{ borderRadius: "var(--border-radius)" }}
        />

        <label className="block mb-1 font-semibold text-sm">
          {t("yourName")}
        </label>
        <input
          type="text"
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          placeholder={t("yourNamePlaceholder")}
          className="w-full mb-4 p-3 border border-gray-200 outline-none"
          style={{ borderRadius: "var(--border-radius)" }}
        />

        <label className="block mb-1 font-semibold text-sm">
          {t("yourEmail")}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("yourEmailPlaceholder")}
          className="w-full mb-4 p-3 border border-gray-200 outline-none"
          style={{ borderRadius: "var(--border-radius)" }}
        />

        <label className="block mb-1 font-semibold text-sm">
          {t("password")}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 p-3 border border-gray-200 outline-none"
          style={{ borderRadius: "var(--border-radius)" }}
        />

        <label className="block mb-1 font-semibold text-sm">
          {t("chooseColor")}
        </label>
        <div className="flex gap-2 mb-6">
          {MEMBER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-10 h-10 rounded-full cursor-pointer transition-transform"
              style={{
                backgroundColor: c,
                transform: color === c ? "scale(1.2)" : "scale(1)",
                boxShadow:
                  color === c ? `0 0 0 3px var(--color-background), 0 0 0 5px ${c}` : "none",
              }}
            />
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !familyName || !memberName || !email || !password}
          className="w-full py-3 text-white font-bold disabled:opacity-50 cursor-pointer"
          style={{
            backgroundColor: "var(--color-primary)",
            borderRadius: "var(--border-radius)",
          }}
        >
          {loading ? "..." : t("create")}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify setup wizard renders**

Run:
```bash
npm run dev
```

Open `http://localhost:3000/de/setup` in a browser. You should see the setup form styled with the playful theme. Don't submit yet (no DB running for dev unless you started it).

- [ ] **Step 7: Commit**

Run:
```bash
git add src/app
git commit -m "feat: add app layouts, setup wizard, and root redirect"
```

---

### Task 10: Join Family Page

**Files:**
- Create: `src/app/[locale]/join/page.tsx`

- [ ] **Step 1: Create the join page**

Create `src/app/[locale]/join/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const MEMBER_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#FFE66D",
  "#6C5CE7",
  "#A8E6CF",
  "#FF922B",
  "#74B9FF",
  "#FD79A8",
];

export default function JoinPage() {
  const t = useTranslations("join");
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"parent" | "child">("parent");
  const [color, setColor] = useState(MEMBER_COLORS[1]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError("");
    setLoading(true);

    const res = await fetch("/api/families/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: inviteCode.toUpperCase(), name, role, color }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-md p-8"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--border-radius)",
        }}
      >
        <h1 className="text-2xl font-bold mb-6 text-center">{t("title")}</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm">
            {error}
          </div>
        )}

        <label className="block mb-1 font-semibold text-sm">
          {t("enterCode")}
        </label>
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder={t("codePlaceholder")}
          maxLength={6}
          className="w-full mb-4 p-3 border border-gray-200 outline-none text-center text-2xl tracking-[0.3em] font-bold uppercase"
          style={{ borderRadius: "var(--border-radius)" }}
        />

        <label className="block mb-1 font-semibold text-sm">
          {t("yourName")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 p-3 border border-gray-200 outline-none"
          style={{ borderRadius: "var(--border-radius)" }}
        />

        <label className="block mb-1 font-semibold text-sm">
          {t("yourRole")}
        </label>
        <div className="flex gap-3 mb-4">
          {(["parent", "child"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className="flex-1 py-2 font-semibold cursor-pointer transition-all"
              style={{
                borderRadius: "var(--border-radius)",
                backgroundColor:
                  role === r ? "var(--color-primary)" : "var(--color-background)",
                color: role === r ? "#fff" : "var(--color-text)",
              }}
            >
              {t(r === "parent" ? "roleParent" : "roleChild")}
            </button>
          ))}
        </div>

        <label className="block mb-1 font-semibold text-sm">
          {t("chooseColor" as never) || "Choose your color"}
        </label>
        <div className="flex gap-2 mb-6">
          {MEMBER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-10 h-10 rounded-full cursor-pointer transition-transform"
              style={{
                backgroundColor: c,
                transform: color === c ? "scale(1.2)" : "scale(1)",
                boxShadow:
                  color === c ? `0 0 0 3px var(--color-background), 0 0 0 5px ${c}` : "none",
              }}
            />
          ))}
        </div>

        <button
          onClick={handleJoin}
          disabled={loading || !inviteCode || !name}
          className="w-full py-3 text-white font-bold disabled:opacity-50 cursor-pointer"
          style={{
            backgroundColor: "var(--color-primary)",
            borderRadius: "var(--border-radius)",
          }}
        >
          {loading ? "..." : t("join")}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add missing i18n key for join page**

Add `"chooseColor": "Choose your color"` to `join` in `messages/en.json` and `"chooseColor": "Wähle deine Farbe"` to `join` in `messages/de.json`.

In `messages/en.json`, update the `join` section:

```json
"join": {
    "title": "Join a Family",
    "enterCode": "Enter the 6-digit family code",
    "codePlaceholder": "ABC123",
    "yourName": "Your Name",
    "yourRole": "Your Role",
    "roleParent": "Parent",
    "roleChild": "Child",
    "chooseColor": "Choose your color",
    "join": "Join Family"
}
```

In `messages/de.json`, update the `join` section:

```json
"join": {
    "title": "Einer Familie beitreten",
    "enterCode": "Gib den 6-stelligen Familien-Code ein",
    "codePlaceholder": "ABC123",
    "yourName": "Dein Name",
    "yourRole": "Deine Rolle",
    "roleParent": "Elternteil",
    "roleChild": "Kind",
    "chooseColor": "Wähle deine Farbe",
    "join": "Beitreten"
}
```

- [ ] **Step 3: Verify join page renders**

Run the dev server and open `http://localhost:3000/de/join`. You should see the join form with code input, name, role toggle, and color picker.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/app/\[locale\]/join messages
git commit -m "feat: add join family page with invite code entry"
```

---

### Task 11: Dashboard – TopBar Component

**Files:**
- Create: `src/app/[locale]/dashboard/_components/TopBar.tsx`
- Test: `tests/components/TopBar.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/TopBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "@/app/[locale]/dashboard/_components/TopBar";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "de",
}));

describe("TopBar", () => {
  it("renders date and time", () => {
    render(<TopBar />);
    // Should show current time (HH:MM format)
    const timeElement = screen.getByTestId("topbar-time");
    expect(timeElement).toBeInTheDocument();
    expect(timeElement.textContent).toMatch(/\d{1,2}:\d{2}/);
  });

  it("renders date", () => {
    render(<TopBar />);
    const dateElement = screen.getByTestId("topbar-date");
    expect(dateElement).toBeInTheDocument();
    expect(dateElement.textContent!.length).toBeGreaterThan(0);
  });

  it("renders weather placeholder", () => {
    render(<TopBar />);
    const weatherElement = screen.getByTestId("topbar-weather");
    expect(weatherElement).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/components/TopBar.test.tsx
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement TopBar**

Create `src/app/[locale]/dashboard/_components/TopBar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

export function TopBar() {
  const locale = useLocale();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const date = now.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="flex items-center justify-between px-6 py-3"
      style={{
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--border-radius)",
      }}
    >
      <div data-testid="topbar-weather" className="flex items-center gap-2 text-lg">
        <span>☀️</span>
        <span>--°C</span>
      </div>

      <div data-testid="topbar-date" className="text-lg font-semibold">
        {date}
      </div>

      <div data-testid="topbar-time" className="text-lg font-bold">
        {time}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/components/TopBar.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/app/\[locale\]/dashboard/_components/TopBar.tsx tests/components/TopBar.test.tsx
git commit -m "feat: add TopBar component with date, time, and weather placeholder"
```

---

### Task 12: Dashboard – WidgetCard Component

**Files:**
- Create: `src/app/[locale]/dashboard/_components/WidgetCard.tsx`
- Test: `tests/components/WidgetCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/WidgetCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WidgetCard } from "@/app/[locale]/dashboard/_components/WidgetCard";

describe("WidgetCard", () => {
  it("renders title and icon", () => {
    render(
      <WidgetCard title="Calendar" icon="📅" color="#FF6B6B">
        <p>Event content</p>
      </WidgetCard>
    );

    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("📅")).toBeInTheDocument();
    expect(screen.getByText("Event content")).toBeInTheDocument();
  });

  it("calls onTap when clicked", () => {
    const onTap = vi.fn();

    render(
      <WidgetCard title="Calendar" icon="📅" color="#FF6B6B" onTap={onTap}>
        <p>Content</p>
      </WidgetCard>
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onTap).toHaveBeenCalledOnce();
  });

  it("applies the accent color to the header", () => {
    render(
      <WidgetCard title="Calendar" icon="📅" color="#FF6B6B">
        <p>Content</p>
      </WidgetCard>
    );

    const title = screen.getByText("Calendar");
    expect(title).toHaveStyle({ color: "#FF6B6B" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/components/WidgetCard.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement WidgetCard**

Create `src/app/[locale]/dashboard/_components/WidgetCard.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

interface WidgetCardProps {
  title: string;
  icon: string;
  color: string;
  children: ReactNode;
  onTap?: () => void;
}

export function WidgetCard({ title, icon, color, children, onTap }: WidgetCardProps) {
  return (
    <button
      onClick={onTap}
      className="w-full text-left p-4 transition-transform active:scale-[0.98] cursor-pointer"
      style={{
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--border-radius)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
          {title}
        </span>
      </div>
      <div className="text-sm" style={{ color: "var(--color-text)" }}>
        {children}
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/components/WidgetCard.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/app/\[locale\]/dashboard/_components/WidgetCard.tsx tests/components/WidgetCard.test.tsx
git commit -m "feat: add WidgetCard component with tap interaction"
```

---

### Task 13: Dashboard – WidgetGrid Component

**Files:**
- Create: `src/app/[locale]/dashboard/_components/WidgetGrid.tsx`
- Test: `tests/components/WidgetGrid.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/WidgetGrid.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WidgetGrid } from "@/app/[locale]/dashboard/_components/WidgetGrid";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "widgets.calendar": "Kalender",
      "widgets.routines": "Routinen",
      "widgets.pinboard": "Pinnwand",
      "widgets.meal": "Mahlzeit",
      "widgets.feelings": "Gefühle",
      "widgets.photos": "Fotos",
      noEvents: "Keine Termine",
      noMessages: "Keine Nachrichten",
      tapToOpen: "Tippen zum Öffnen",
    };
    return map[key] || key;
  },
}));

describe("WidgetGrid", () => {
  it("renders all 6 widgets", () => {
    render(<WidgetGrid />);

    expect(screen.getByText("Kalender")).toBeInTheDocument();
    expect(screen.getByText("Routinen")).toBeInTheDocument();
    expect(screen.getByText("Pinnwand")).toBeInTheDocument();
    expect(screen.getByText("Mahlzeit")).toBeInTheDocument();
    expect(screen.getByText("Gefühle")).toBeInTheDocument();
    expect(screen.getByText("Fotos")).toBeInTheDocument();
  });

  it("uses a 3-column grid layout", () => {
    const { container } = render(<WidgetGrid />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("grid-cols-3");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/components/WidgetGrid.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement WidgetGrid**

Create `src/app/[locale]/dashboard/_components/WidgetGrid.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { WidgetCard } from "./WidgetCard";

export function WidgetGrid() {
  const t = useTranslations("dashboard");

  return (
    <div className="grid grid-cols-3 gap-4">
      <WidgetCard title={t("widgets.calendar")} icon="📅" color="#FF6B6B">
        <p style={{ color: "var(--color-text-muted)" }}>{t("noEvents")}</p>
      </WidgetCard>

      <WidgetCard title={t("widgets.routines")} icon="✅" color="#FF922B">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>

      <WidgetCard title={t("widgets.pinboard")} icon="📌" color="#6BCB77">
        <p style={{ color: "var(--color-text-muted)" }}>{t("noMessages")}</p>
      </WidgetCard>

      <WidgetCard title={t("widgets.meal")} icon="🍽" color="#4D96FF">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>

      <WidgetCard title={t("widgets.feelings")} icon="💭" color="#E599F7">
        <div className="flex gap-3 text-2xl">
          <span>😊</span>
          <span>😐</span>
          <span>😢</span>
          <span>😠</span>
          <span>🤩</span>
        </div>
      </WidgetCard>

      <WidgetCard title={t("widgets.photos")} icon="🖼" color="#FFD93D">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/components/WidgetGrid.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/app/\[locale\]/dashboard/_components/WidgetGrid.tsx tests/components/WidgetGrid.test.tsx
git commit -m "feat: add WidgetGrid with 6 placeholder widgets in 3-column layout"
```

---

### Task 14: Dashboard – Idle Screensaver

**Files:**
- Create: `src/app/[locale]/dashboard/_components/IdleScreensaver.tsx`

- [ ] **Step 1: Implement IdleScreensaver**

Create `src/app/[locale]/dashboard/_components/IdleScreensaver.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface IdleScreensaverProps {
  photos?: string[];
}

export function IdleScreensaver({ photos = [] }: IdleScreensaverProps) {
  const [isIdle, setIsIdle] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const resetTimer = useCallback(() => {
    setIsIdle(false);
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function scheduleIdle() {
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsIdle(true), IDLE_TIMEOUT_MS);
    }

    const events = ["mousedown", "mousemove", "touchstart", "keydown", "scroll"];

    function handleActivity() {
      resetTimer();
      scheduleIdle();
    }

    events.forEach((event) => window.addEventListener(event, handleActivity));
    scheduleIdle();

    return () => {
      clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [resetTimer]);

  useEffect(() => {
    if (!isIdle || photos.length === 0) return;

    const interval = setInterval(() => {
      setCurrentPhotoIndex((i) => (i + 1) % photos.length);
    }, 10_000);

    return () => clearInterval(interval);
  }, [isIdle, photos.length]);

  if (!isIdle) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black cursor-pointer"
      onClick={resetTimer}
      onTouchStart={resetTimer}
    >
      {photos.length > 0 ? (
        <img
          src={photos[currentPhotoIndex]}
          alt=""
          className="max-h-full max-w-full object-contain transition-opacity duration-1000"
        />
      ) : (
        <div className="text-center">
          <div className="text-6xl mb-4">🖼</div>
          <p className="text-white/50 text-xl">FamilyDisplay</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/app/\[locale\]/dashboard/_components/IdleScreensaver.tsx
git commit -m "feat: add idle screensaver component (5min timeout, photo rotation)"
```

---

### Task 15: Dashboard Page (Assemble Everything)

**Files:**
- Create: `src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page**

Create `src/app/[locale]/dashboard/page.tsx`:

```tsx
import { TopBar } from "./_components/TopBar";
import { WidgetGrid } from "./_components/WidgetGrid";
import { IdleScreensaver } from "./_components/IdleScreensaver";

export default function DashboardPage() {
  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-4"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <TopBar />
      <div className="flex-1 flex items-center">
        <div className="w-full">
          <WidgetGrid />
        </div>
      </div>
      <IdleScreensaver />
    </div>
  );
}
```

- [ ] **Step 2: Start the dev server and verify visually**

Run:
```bash
npm run dev
```

Open `http://localhost:3000` in a browser. You should be redirected to `/de/dashboard` and see:
- Top bar with weather placeholder, date (in German), and time
- 6 widgets in a 3x2 grid with colorful headers and emoji icons
- Playful theme (warm background, rounded corners)

Verify:
- All 6 widgets are visible and have content
- The date shows German locale (e.g., "Samstag, 12. April 2026")
- Wait 5 minutes (or temporarily reduce `IDLE_TIMEOUT_MS` to 5000ms) to see the screensaver

- [ ] **Step 3: Run all tests**

Run:
```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/app/\[locale\]/dashboard/page.tsx
git commit -m "feat: assemble dashboard page with TopBar, WidgetGrid, and IdleScreensaver"
```

---

### Task 16: Build Verification + Final Cleanup

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Verify production build**

Run:
```bash
npm run build
```

Expected: Build succeeds. Fix any type errors or warnings that appear.

- [ ] **Step 2: Verify Docker build**

Run:
```bash
docker compose build app
```

Expected: Image builds successfully. If you encounter issues with the `next-intl` plugin import in `next.config.ts`, ensure `next-intl` is in `dependencies` (not `devDependencies`).

- [ ] **Step 3: Run full test suite one more time**

Run:
```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Final commit**

Run:
```bash
git add -A
git commit -m "chore: build verification and final cleanup"
```

---

## Summary

After completing all 16 tasks, you will have:

- **Next.js 15 project** with TypeScript, Tailwind CSS, and App Router
- **PostgreSQL database** with full Prisma schema (all models for future features)
- **NextAuth v5** with credentials provider and JWT sessions
- **i18n** with English and German translations via next-intl
- **Theme system** with playful (default) and minimal themes via CSS custom properties
- **Setup wizard** to create a family and first parent member
- **Join page** to join an existing family via invite code
- **Dashboard** with top bar (date, time, weather placeholder) and 6 widget cards in a 3x2 grid
- **Idle screensaver** that activates after 5 minutes
- **Docker Compose** setup for one-command deployment
- **API routes** for family creation, joining, and member listing
- **Test suite** with Vitest covering themes, invite codes, API routes, and UI components
