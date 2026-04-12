import ICAL from "ical.js";

export interface ParsedEvent {
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  externalId: string;
}

export interface EventToIcsInput {
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  uid: string;
}

export function icsToEvent(icsData: string): ParsedEvent {
  const jcal = ICAL.parse(icsData);
  const comp = new ICAL.Component(jcal);

  // Handle VCALENDAR wrapping VTIMEZONE + VEVENT
  const vcal = comp.name === "vcalendar" ? comp : null;
  const vevent = (vcal ?? comp).getFirstSubcomponent("vevent");
  if (!vevent) throw new Error("No VEVENT component found in ICS data");

  // Pass the parent VCALENDAR so ical.js can resolve VTIMEZONE components
  const event = new ICAL.Event(vevent, { strictExceptions: false });

  const startDate = event.startDate;
  if (!startDate) throw new Error("VEVENT has no DTSTART");

  // isDate is true only for VALUE=DATE (all-day), false for date-time (including TZID)
  const isAllDay = startDate.isDate === true;

  // endDate may be missing for all-day events (DTEND defaults to DTSTART + 1 day)
  let endDate = event.endDate;
  if (!endDate) {
    endDate = startDate.clone();
    if (isAllDay) {
      endDate.day += 1;
    }
  }

  return {
    title: event.summary || "",
    description: event.description || null,
    start: startDate.toJSDate(),
    end: endDate.toJSDate(),
    allDay: isAllDay,
    externalId: event.uid,
  };
}

export function eventToIcs(input: EventToIcsInput): string {
  const comp = new ICAL.Component(["vcalendar", [], []]);
  comp.addPropertyWithValue("prodid", "-//FamilyDisplay//EN");
  comp.addPropertyWithValue("version", "2.0");

  const vevent = new ICAL.Component("vevent");
  vevent.addPropertyWithValue("uid", input.uid);
  vevent.addPropertyWithValue("summary", input.title);

  if (input.description) {
    vevent.addPropertyWithValue("description", input.description);
  }

  if (input.allDay) {
    const dtstart = ICAL.Time.fromJSDate(input.start, true);
    dtstart.isDate = true;
    const dtstartProp = new ICAL.Property("dtstart");
    dtstartProp.setValue(dtstart);
    vevent.addProperty(dtstartProp);

    const dtend = ICAL.Time.fromJSDate(input.end, true);
    dtend.isDate = true;
    const dtendProp = new ICAL.Property("dtend");
    dtendProp.setValue(dtend);
    vevent.addProperty(dtendProp);
  } else {
    vevent.addPropertyWithValue(
      "dtstart",
      ICAL.Time.fromJSDate(input.start, false),
    );
    vevent.addPropertyWithValue(
      "dtend",
      ICAL.Time.fromJSDate(input.end, false),
    );
  }

  vevent.addPropertyWithValue("dtstamp", ICAL.Time.now());
  comp.addSubcomponent(vevent);
  return comp.toString();
}
