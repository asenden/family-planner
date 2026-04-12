import { RRule } from "rrule";

interface CalendarEventData {
  id: string;
  title: string;
  description?: string | null;
  start: string; // ISO string
  end: string;   // ISO string
  allDay: boolean;
  recurrence?: string | null;
  recurrenceEnd?: string | null;
  assignedTo: { id: string; name: string; color: string }[];
}

export function expandRecurringEvents(
  events: CalendarEventData[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEventData[] {
  const result: CalendarEventData[] = [];

  for (const event of events) {
    if (!event.recurrence) {
      // Non-recurring: include as-is
      result.push(event);
      continue;
    }

    // Parse the RRULE
    try {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      const duration = eventEnd.getTime() - eventStart.getTime();

      const rruleStr = event.recurrence;
      const rule = RRule.fromString(`DTSTART:${formatRRuleDate(eventStart)}\nRRULE:${rruleStr}`);

      // If there's a recurrence end, use it; otherwise use rangeEnd
      const until = event.recurrenceEnd ? new Date(event.recurrenceEnd) : rangeEnd;
      const effectiveEnd = until < rangeEnd ? until : rangeEnd;

      const occurrences = rule.between(rangeStart, effectiveEnd, true);

      for (const occurrence of occurrences) {
        const occEnd = new Date(occurrence.getTime() + duration);
        result.push({
          ...event,
          id: `${event.id}_${occurrence.getTime()}`, // Unique ID per occurrence
          start: occurrence.toISOString(),
          end: occEnd.toISOString(),
        });
      }
    } catch (e) {
      // If RRULE parsing fails, just include the original event
      console.error("Failed to parse RRULE:", event.recurrence, e);
      result.push(event);
    }
  }

  return result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function formatRRuleDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}
