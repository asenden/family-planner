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
    <div className="grain min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="w-full max-w-sm text-center animate-slide-up">
        <div className="text-6xl mb-6">🏠</div>
        <h1 className="text-4xl font-extrabold mb-2 tracking-tight" style={{ color: "var(--color-text)" }}>
          {t("title")}
        </h1>
        <p className="mb-10 text-lg" style={{ color: "var(--color-text-muted)" }}>
          {t("subtitle")}
        </p>

        <div
          className="glass p-7 mb-5"
          style={{ borderRadius: "var(--border-radius)" }}
        >
          <label className="block mb-2 text-sm font-semibold text-left" style={{ color: "var(--color-text-muted)" }}>
            {t("enterCode")}
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={t("codePlaceholder")}
            maxLength={6}
            className="w-full p-3 text-center text-2xl tracking-[0.3em] font-bold uppercase outline-none mb-4"
            style={{
              borderRadius: "calc(var(--border-radius) / 1.5)",
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--color-text)",
            }}
            autoFocus
          />

          {error && (
            <p className="text-sm text-red-400 mb-3">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={code.length < 6}
            className="w-full py-3 font-bold disabled:opacity-30 cursor-pointer transition-all hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, var(--color-primary), #8b5cf6)",
              borderRadius: "calc(var(--border-radius) / 1.5)",
              color: "#fff",
            }}
          >
            {t("join")}
          </button>
        </div>

        <p className="mb-5 text-sm" style={{ color: "var(--color-text-muted)" }}>
          {t("or")}
        </p>

        <button
          onClick={() => router.push("/setup")}
          className="glass glass-hover w-full py-3 font-bold cursor-pointer"
          style={{
            color: "var(--color-primary)",
            borderRadius: "calc(var(--border-radius) / 1.5)",
          }}
        >
          {t("createFamily")}
        </button>
      </div>
    </div>
  );
}
