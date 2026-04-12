import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WidgetGrid } from "@/app/[locale]/dashboard/_components/WidgetGrid";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "widgets.calendar": "Kalender", "widgets.routines": "Routinen", "widgets.pinboard": "Pinnwand",
      "widgets.meal": "Mahlzeit", "widgets.feelings": "Gefühle", "widgets.photos": "Fotos",
      noEvents: "Keine Termine", noMessages: "Keine Nachrichten", tapToOpen: "Tippen zum Öffnen",
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
