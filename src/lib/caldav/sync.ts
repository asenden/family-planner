import { db } from "@/lib/db";
import { fetchEvents } from "./client";
import type { ParsedEvent } from "./parser";
import type { CalDAVConnectOptions } from "./client";

export interface LocalEvent {
  id: string;
  externalId: string | null;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  source: string;
}

export type RemoteEvent = ParsedEvent;

interface ReconcileResult {
  toCreateLocally: RemoteEvent[];
  toUpdateLocally: (RemoteEvent & { localId: string })[];
  toDeleteLocally: string[];
}

export function reconcileEvents(
  localEvents: LocalEvent[],
  remoteEvents: RemoteEvent[],
): ReconcileResult {
  const remoteByUid = new Map(remoteEvents.map((e) => [e.externalId, e]));
  const localSynced = localEvents.filter((e) => e.externalId !== null);
  const localByUid = new Map(localSynced.map((e) => [e.externalId!, e]));

  const toCreateLocally: RemoteEvent[] = [];
  const toUpdateLocally: (RemoteEvent & { localId: string })[] = [];
  const toDeleteLocally: string[] = [];

  for (const [uid, remote] of remoteByUid) {
    const local = localByUid.get(uid);
    if (!local) {
      toCreateLocally.push(remote);
    } else if (hasChanged(local, remote)) {
      toUpdateLocally.push({ ...remote, localId: local.id });
    }
  }

  for (const local of localSynced) {
    if (!remoteByUid.has(local.externalId!)) {
      toDeleteLocally.push(local.id);
    }
  }

  return { toCreateLocally, toUpdateLocally, toDeleteLocally };
}

function hasChanged(local: LocalEvent, remote: RemoteEvent): boolean {
  return (
    local.title !== remote.title ||
    local.description !== remote.description ||
    local.start.getTime() !== remote.start.getTime() ||
    local.end.getTime() !== remote.end.getTime() ||
    local.allDay !== remote.allDay
  );
}

export async function syncCalendarAccount(
  accountId: string,
): Promise<{ created: number; updated: number; deleted: number }> {
  const account = await db.calendarAccount.findUnique({
    where: { id: accountId },
  });

  if (!account || !account.syncEnabled) {
    return { created: 0, updated: 0, deleted: 0 };
  }

  const connectOptions: CalDAVConnectOptions = {
    provider: account.provider,
    serverUrl: account.serverUrl,
    username: account.username,
    password: account.password,
  };

  const now = new Date();
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const remoteEvents = await fetchEvents(
    connectOptions,
    account.calendarId || "",
    { start: now, end },
  );

  const localEvents = await db.calendarEvent.findMany({
    where: {
      familyId: account.familyId,
      source: account.provider,
      externalId: { not: null },
    },
    select: {
      id: true,
      externalId: true,
      title: true,
      description: true,
      start: true,
      end: true,
      allDay: true,
      source: true,
    },
  });

  const { toCreateLocally, toUpdateLocally, toDeleteLocally } =
    reconcileEvents(
      localEvents.map((e) => ({ ...e, source: e.source as string })),
      remoteEvents,
    );

  for (const event of toCreateLocally) {
    await db.calendarEvent.create({
      data: {
        title: event.title,
        description: event.description,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        externalId: event.externalId,
        source: account.provider,
        familyId: account.familyId,
        lastSyncedAt: new Date(),
      },
    });
  }

  for (const event of toUpdateLocally) {
    await db.calendarEvent.update({
      where: { id: event.localId },
      data: {
        title: event.title,
        description: event.description,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        lastSyncedAt: new Date(),
      },
    });
  }

  if (toDeleteLocally.length > 0) {
    await db.calendarEvent.deleteMany({
      where: { id: { in: toDeleteLocally } },
    });
  }

  await db.calendarAccount.update({
    where: { id: accountId },
    data: { lastSyncAt: new Date() },
  });

  return {
    created: toCreateLocally.length,
    updated: toUpdateLocally.length,
    deleted: toDeleteLocally.length,
  };
}
