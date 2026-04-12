"use client";

import { useTranslations } from "next-intl";
import { WidgetCard } from "./WidgetCard";

export function WidgetGrid() {
  const t = useTranslations("dashboard");

  return (
    <div className="grid grid-cols-3 gap-4">
      <WidgetCard title={t("widgets.calendar")} icon="📅" color="#FF6B6B">
        <p style={{ color: "var(--color-text-muted)" }}>{t("noEvents")}</p>
      </WidgetCard>
      <WidgetCard title={t("widgets.routines")} icon="✅" color="#FF922B">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>
      <WidgetCard title={t("widgets.pinboard")} icon="📌" color="#6BCB77">
        <p style={{ color: "var(--color-text-muted)" }}>{t("noMessages")}</p>
      </WidgetCard>
      <WidgetCard title={t("widgets.meal")} icon="🍽" color="#4D96FF">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>
      <WidgetCard title={t("widgets.feelings")} icon="💭" color="#E599F7">
        <div className="flex gap-3 text-2xl">
          <span>😊</span><span>😐</span><span>😢</span><span>😠</span><span>🤩</span>
        </div>
      </WidgetCard>
      <WidgetCard title={t("widgets.photos")} icon="🖼" color="#FFD93D">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>
    </div>
  );
}
