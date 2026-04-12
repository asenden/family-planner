"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const t = useTranslations("landing");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Check if already authenticated via cookie
  useEffect(() => {
    fetch("/api/auth/family-code")
      .then((res) => {
        if (res.ok) {
          router.replace("/dashboard");
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  async function handleSubmit() {
    if (!code || code.length < 6) return;
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/family-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.toUpperCase() }),
    });

    if (res.ok) {
      router.replace("/dashboard");
    } else {
      const data = await res.json();
      setLoading(false);
      if (data.error === "invalid") {
        setError(t("invalidCode"));
      } else {
        setError(t("unknownCode"));
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
        <div className="text-2xl" style={{ color: "var(--color-text-muted)" }}>...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🏠</div>
        <h1 className="text-3xl font-extrabold mb-1" style={{ color: "var(--color-text)" }}>
          {t("title")}
        </h1>
        <p className="mb-8" style={{ color: "var(--color-text-muted)" }}>
          {t("subtitle")}
        </p>

        <div
          className="p-6 mb-4"
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--border-radius)",
          }}
        >
          <label className="block mb-2 text-sm font-semibold text-left">
            {t("enterCode")}
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={t("codePlaceholder")}
            maxLength={6}
            className="w-full p-3 text-center text-2xl tracking-[0.3em] font-bold uppercase border border-gray-200 outline-none mb-3"
            style={{ borderRadius: "var(--border-radius)" }}
            autoFocus
          />

          {error && (
            <p className="text-sm text-red-500 mb-3">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={code.length < 6}
            className="w-full py-3 text-white font-bold disabled:opacity-50 cursor-pointer"
            style={{
              backgroundColor: "var(--color-primary)",
              borderRadius: "var(--border-radius)",
            }}
          >
            {t("join")}
          </button>
        </div>

        <p className="mb-4" style={{ color: "var(--color-text-muted)" }}>
          {t("or")}
        </p>

        <button
          onClick={() => router.push("/setup")}
          className="w-full py-3 font-bold cursor-pointer"
          style={{
            backgroundColor: "var(--color-surface)",
            color: "var(--color-primary)",
            borderRadius: "var(--border-radius)",
          }}
        >
          {t("createFamily")}
        </button>
      </div>
    </div>
  );
}
