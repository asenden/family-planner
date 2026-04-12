import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WidgetCard } from "@/app/[locale]/dashboard/_components/WidgetCard";

describe("WidgetCard", () => {
  it("renders title and icon", () => {
    render(<WidgetCard title="Calendar" icon="📅" color="#FF6B6B"><p>Event content</p></WidgetCard>);
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("📅")).toBeInTheDocument();
    expect(screen.getByText("Event content")).toBeInTheDocument();
  });

  it("calls onTap when clicked", () => {
    const onTap = vi.fn();
    render(<WidgetCard title="Calendar" icon="📅" color="#FF6B6B" onTap={onTap}><p>Content</p></WidgetCard>);
    fireEvent.click(screen.getByRole("button"));
    expect(onTap).toHaveBeenCalledOnce();
  });

  it("applies the accent color to the header", () => {
    render(<WidgetCard title="Calendar" icon="📅" color="#FF6B6B"><p>Content</p></WidgetCard>);
    const title = screen.getByText("Calendar");
    expect(title).toHaveStyle({ color: "#FF6B6B" });
  });
});
