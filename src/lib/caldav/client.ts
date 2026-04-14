import {
  createDAVClient,
  type DAVCalendar,
  type DAVCalendarObject,
} from "tsdav";
import type { CalendarSource } from "../../generated/prisma/enums";
import {
  icsToEvent,
  eventToIcs,
  type ParsedEvent,
  type EventToIcsInput,
} from "./parser";

interface CalDAVConnectOptions {
  provider: CalendarSource;
  serverUrl: string;
  username: string;
  password: string;
  oauth?: {
    accessToken: string;
    refreshToken: string;
  };
}

const PROVIDER_URLS: Partial<Record<CalendarSource, string>> = {
  apple: "https://caldav.icloud.com",
  google: "https://apidata.googleusercontent.com/caldav/v2/",
};

export type { CalDAVConnectOptions };

export async function connectCalDAV(options: CalDAVConnectOptions) {
  const serverUrl = PROVIDER_URLS[options.provider] || options.serverUrl;
  if (options.oauth) {
    const client = await createDAVClient({
      serverUrl,
      credentials: {
        accessToken: options.oauth.accessToken,
        refreshToken: options.oauth.refreshToken,
        tokenUrl: "https://oauth2.googleapis.com/token",
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      authMethod: "Oauth",
      defaultAccountType: "caldav",
    });
    return client;
  }
  const client = await createDAVClient({
    serverUrl,
    credentials: {
      username: options.username,
      password: options.password,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  return client;
}

export async function fetchCalendars(
  options: CalDAVConnectOptions,
): Promise<DAVCalendar[]> {
  const client = await connectCalDAV(options);
  return client.fetchCalendars();
}

export async function fetchEvents(
  options: CalDAVConnectOptions,
  calendarUrl: string,
  timeRange: { start: Date; end: Date },
): Promise<ParsedEvent[]> {
  const client = await connectCalDAV(options);
  const calendars = await client.fetchCalendars();
  const calendar =
    calendars.find((c) => c.url === calendarUrl) || calendars[0];
  if (!calendar) return [];

  const objects = await client.fetchCalendarObjects({
    calendar,
    timeRange: {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    },
  });

  return objects
    .filter(
      (obj): obj is DAVCalendarObject & { data: string } =>
        typeof obj.data === "string",
    )
    .map((obj) => {
      try {
        return icsToEvent(obj.data);
      } catch (e) {
        console.error("Failed to parse ICS event:", e, obj.data?.substring(0, 200));
        return null;
      }
    })
    .filter((e): e is ParsedEvent => e !== null);
}

export async function createRemoteEvent(
  options: CalDAVConnectOptions,
  calendarUrl: string,
  event: EventToIcsInput,
): Promise<void> {
  const client = await connectCalDAV(options);
  const calendars = await client.fetchCalendars();
  const calendar =
    calendars.find((c) => c.url === calendarUrl) || calendars[0];
  if (!calendar) throw new Error("Calendar not found");

  const icsData = eventToIcs(event);
  await client.createCalendarObject({
    calendar,
    filename: `${event.uid}.ics`,
    iCalString: icsData,
  });
}

export async function deleteRemoteEvent(
  options: CalDAVConnectOptions,
  calendarUrl: string,
  eventUid: string,
): Promise<void> {
  const client = await connectCalDAV(options);
  const calendars = await client.fetchCalendars();
  const calendar =
    calendars.find((c) => c.url === calendarUrl) || calendars[0];
  if (!calendar) return;

  const objects = await client.fetchCalendarObjects({ calendar });
  const target = objects.find(
    (obj) =>
      typeof obj.data === "string" && obj.data.includes(`UID:${eventUid}`),
  );
  if (target?.url) {
    await client.deleteCalendarObject({ calendarObject: target });
  }
}
