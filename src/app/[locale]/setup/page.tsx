"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const MEMBER_COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#6C5CE7", "#A8E6CF", "#FF922B", "#74B9FF", "#FD79A8"];

type Step = "family" | "invite";

export default function SetupPage() {
  const t = useTranslations("setup");
  const router = useRouter();
  const [step, setStep] = useState<Step>("family");
  const [familyName, setFamilyName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [color, setColor] = useState(MEMBER_COLORS[0]);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyName, memberName, email, password, color }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      setLoading(false);
      setError("Server error — is the database running?");
      return;
    }
    setLoading(false);
    if (!res.ok) { setError(data.error || "Something went wrong"); return; }
    setInviteCode(data.family.inviteCode);
    setStep("invite");
  }

  if (step === "invite") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 text-center" style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--border-radius)" }}>
          <h1 className="text-2xl font-bold mb-2">{t("inviteCodeTitle")}</h1>
          <p className="mb-6" style={{ color: "var(--color-text-muted)" }}>{t("inviteCodeDescription")}</p>
          <div className="text-4xl font-extrabold tracking-[0.3em] py-4 mb-6" style={{ color: "var(--color-primary)", backgroundColor: "var(--color-background)", borderRadius: "var(--border-radius)" }}>
            {inviteCode}
          </div>
          <button onClick={() => router.push("/dashboard")} className="w-full py-3 text-white font-bold cursor-pointer" style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--border-radius)" }}>
            {t("goToDashboard")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8" style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--border-radius)" }}>
        <h1 className="text-2xl font-bold mb-6 text-center">{t("title")}</h1>
        {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm">{error}</div>}

        <label className="block mb-1 font-semibold text-sm">{t("familyName")}</label>
        <input type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder={t("familyNamePlaceholder")} className="w-full mb-4 p-3 border border-gray-200 outline-none" style={{ borderRadius: "var(--border-radius)" }} />

        <label className="block mb-1 font-semibold text-sm">{t("yourName")}</label>
        <input type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder={t("yourNamePlaceholder")} className="w-full mb-4 p-3 border border-gray-200 outline-none" style={{ borderRadius: "var(--border-radius)" }} />

        <label className="block mb-1 font-semibold text-sm">{t("yourEmail")}</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("yourEmailPlaceholder")} className="w-full mb-4 p-3 border border-gray-200 outline-none" style={{ borderRadius: "var(--border-radius)" }} />

        <label className="block mb-1 font-semibold text-sm">{t("password")}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mb-4 p-3 border border-gray-200 outline-none" style={{ borderRadius: "var(--border-radius)" }} />

        <label className="block mb-1 font-semibold text-sm">{t("chooseColor")}</label>
        <div className="flex gap-2 mb-6">
          {MEMBER_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className="w-10 h-10 rounded-full cursor-pointer transition-transform" style={{
              backgroundColor: c,
              transform: color === c ? "scale(1.2)" : "scale(1)",
              boxShadow: color === c ? `0 0 0 3px var(--color-background), 0 0 0 5px ${c}` : "none",
            }} />
          ))}
        </div>

        <button onClick={handleCreate} disabled={loading || !familyName || !memberName || !email || !password} className="w-full py-3 text-white font-bold disabled:opacity-50 cursor-pointer" style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--border-radius)" }}>
          {loading ? "..." : t("create")}
        </button>
      </div>
    </div>
  );
}
