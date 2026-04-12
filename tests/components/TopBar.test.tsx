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
