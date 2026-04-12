import { TopBar } from "./_components/TopBar";
import { WidgetGrid } from "./_components/WidgetGrid";
import { IdleScreensaver } from "./_components/IdleScreensaver";

export default function DashboardPage() {
  return (
    <div className="min-h-screen p-4 flex flex-col gap-4" style={{ backgroundColor: "var(--color-background)" }}>
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
