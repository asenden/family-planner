# Google OAuth2 CalDAV Integration

## Summary

Replace Basic Auth with OAuth2 for Google Calendar CalDAV access. Google requires OAuth2 — Basic Auth returns 401. Apple/Other providers continue using Basic Auth unchanged.

## Approach

OAuth2 Authorization Code Flow for authentication, `tsdav` with `authMethod: "Oauth"` for CalDAV sync. Minimal changes to existing sync infrastructure.

## Database Changes

Three new optional fields on `CalendarAccount`:

```prisma
accessToken    String?   // OAuth2 access token (Google)
refreshToken   String?   // OAuth2 refresh token (Google)
tokenExpiresAt DateTime? // When the access token expires
```

- Apple/Other accounts: use `username` + `password` (Basic Auth) as before
- Google accounts: use `accessToken` + `refreshToken`, `password` stays empty
- `username` is populated with the Google email from OAuth userinfo

Migration: `db push` adds nullable columns, no data migration needed.

## OAuth2 Flow

### User Perspective

1. Settings page: user clicks "Google" provider, sees a "Mit Google verbinden" button (no username/password fields)
2. Button navigates to `/api/auth/google-calendar/start?familyId=xxx`
3. User is redirected to Google consent screen
4. After granting access, Google redirects to `/api/auth/google-calendar/callback?code=xxx&state=xxx`
5. Callback creates the account, runs initial sync, redirects to `/settings/calendar`

### API Route: `/api/auth/google-calendar/start` (GET)

Builds Google OAuth2 authorization URL with:
- `client_id`: from `GOOGLE_CLIENT_ID` env var
- `redirect_uri`: `https://dashboard.theasendens.com/api/auth/google-calendar/callback`
- `scope`: `https://www.googleapis.com/auth/calendar.readonly email` (calendar read + email for username)
- `access_type`: `offline` (ensures refresh token is returned)
- `prompt`: `consent` (forces consent screen so Google always provides refresh token)
- `state`: JSON `{ familyId }` base64url-encoded
- `response_type`: `code`

Redirects the browser to Google's authorization endpoint.

### API Route: `/api/auth/google-calendar/callback` (GET)

1. Receives `code` and `state` query parameters from Google
2. Exchanges `code` for tokens via POST to `https://oauth2.googleapis.com/token`
3. Fetches user email via GET `https://www.googleapis.com/oauth2/v2/userinfo` with access token
4. Discovers calendars via `tsdav` with OAuth credentials
5. Creates `CalendarAccount` in DB with tokens, email as username, first calendar as default
6. Triggers initial sync via `syncCalendarAccount()`
7. Redirects to `/de/settings/calendar` (locale from cookie or default)

## Token Refresh

### When

Before every CalDAV connection to Google. Checked in the CalDAV client layer.

### Logic

```
if (provider === "google" && tokenExpiresAt <= now + 5 minutes) {
  POST https://oauth2.googleapis.com/token
    grant_type=refresh_token
    refresh_token=<stored refresh token>
    client_id=GOOGLE_CLIENT_ID
    client_secret=GOOGLE_CLIENT_SECRET
  
  Update DB: new accessToken + tokenExpiresAt
}
```

### Triggers

- `syncCalendarAccount()` — runs on dashboard page load (if stale > 5min) and via cron endpoint
- Calendar discovery during initial OAuth callback

### Token Lifetimes

- Access token: ~1 hour (Google default)
- Refresh token: long-lived, does not expire unless user revokes access
- 5-minute buffer prevents token expiry during active requests

### Error Handling

If refresh fails (e.g. user revoked access): sync is skipped, error is logged. Account stays in DB with `syncEnabled: true`. User sees stale "Last sync" time and can remove/reconnect.

## CalDAV Client Changes

### `CalDAVConnectOptions` Extension

Add optional `oauth` field:

```typescript
interface CalDAVConnectOptions {
  provider: CalendarSource;
  serverUrl: string;
  username: string;
  password: string;
  oauth?: {
    accessToken: string;
    refreshToken: string;
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
  };
}
```

### `connectCalDAV` Branching

- **Apple/Other**: `authMethod: "Basic"`, `credentials: { username, password }` (unchanged)
- **Google**: `authMethod: "Oauth"`, `credentials: { tokenUrl, accessToken, refreshToken, clientId, clientSecret }`

`tsdav` supports `authMethod: "Oauth"` natively.

### `sync.ts` Changes

`syncCalendarAccount()` builds connect options based on `account.provider`:
- Google: populates `oauth` field from stored tokens, refreshes if expired before connecting
- Apple/Other: populates `username`/`password` as before

## UI Changes

### `AddCalendarForm` (settings/calendar page)

**When provider = "google":**
- Hide username/password inputs
- Show single button: "Mit Google verbinden"
- Click: `window.location.href = /api/auth/google-calendar/start?familyId=xxx`

**When provider = "apple" or "other":**
- No changes, same form as before

### Account List

- Google accounts show Google email as username
- Remove button works as before (deletes account + events)

## Environment Variables

```
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

Already present in `.env.example` and `.env.local` (currently empty).

## Files to Change

1. `prisma/schema.prisma` — add 3 fields to CalendarAccount
2. `src/lib/caldav/client.ts` — OAuth support in connectCalDAV
3. `src/lib/caldav/sync.ts` — build OAuth options, refresh tokens before sync
4. `src/app/api/auth/google-calendar/start/route.ts` — new, OAuth start redirect
5. `src/app/api/auth/google-calendar/callback/route.ts` — new, OAuth callback handler
6. `src/app/api/families/[familyId]/calendar-accounts/route.ts` — skip Basic Auth validation for Google
7. `src/app/[locale]/settings/calendar/page.tsx` — Google OAuth button instead of password form
8. `.env.local` / `.env` on VPS — fill in Google credentials

## Out of Scope

- Token encryption at rest (plaintext in DB, same as existing password storage)
- Google Calendar write access (read-only scope)
- Multiple Google calendar selection (uses first/primary calendar)
- Revoking Google access from within the app (user removes account, can revoke via Google account settings)
