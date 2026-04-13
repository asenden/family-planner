import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WidgetGrid } from "@/app/[locale]/dashboard/_components/WidgetGrid";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const maps: Record<string, Record<string, string>> = {
      dashboard: {
        "widgets.calendar": "Kalender", "widgets.routines": "Routinen", "widgets.pinboard": "Pinnwand",
        "widgets.meal": "Mahlzeit", "widgets.feelings": "Gefühle", "widgets.photos": "Fotos",
        noEvents: "Keine Termine", noMessages: "Keine Nachrichten", tapToOpen: "Tippen zum Öffnen",
      },
      calendar: {
        title: "Kalender",
        noEvents: "Keine Termine",
        allDay: "Ganztägig",
      },
      routines: {
        title: "Routinen",
        noRoutines: "Keine Routinen",
        noTasksToday: "Keine Aufgaben heute",
        taskProgress: "Fortschritt",
        tasksComplete: "Alle erledigt",
      },
    };
    return maps[namespace]?.[key] ?? key;
  },
  useLocale: () => "de",
}));

describe("WidgetGrid", () => {
  it("renders all 6 widgets", () => {
    render(
      <WidgetGrid
        calendarEvents={[]}
        familyMembers={[]}
        routines={[]}
        rewards={[]}
        todayCompletedTaskIds={[]}
        pointsMap={{}}
      />
    );
    expect(screen.getByText("Kalender")).toBeInTheDocument();
    expect(screen.getByText("Routinen")).toBeInTheDocument();
    expect(screen.getByText("Pinnwand")).toBeInTheDocument();
    expect(screen.getByText("Mahlzeit")).toBeInTheDocument();
    expect(screen.getByText("Gefühle")).toBeInTheDocument();
    expect(screen.getByText("Fotos")).toBeInTheDocument();
  });

  it("uses a 3-column grid layout", () => {
    const { container } = render(
      <WidgetGrid
        calendarEvents={[]}
        familyMembers={[]}
        routines={[]}
        rewards={[]}
        todayCompletedTaskIds={[]}
        pointsMap={{}}
      />
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("grid-cols-3");
  });
});
