"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const MEMBER_COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#6C5CE7", "#A8E6CF", "#FF922B", "#74B9FF", "#FD79A8"];

export default function JoinPage() {
  const t = useTranslations("join");
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"parent" | "child">("parent");
  const [color, setColor] = useState(MEMBER_COLORS[1]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/families/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: inviteCode.toUpperCase(), name, role, color }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Something went wrong"); return; }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8" style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--border-radius)" }}>
        <h1 className="text-2xl font-bold mb-6 text-center">{t("title")}</h1>
        {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm">{error}</div>}

        <label className="block mb-1 font-semibold text-sm">{t("enterCode")}</label>
        <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder={t("codePlaceholder")} maxLength={6} className="w-full mb-4 p-3 border border-gray-200 outline-none text-center text-2xl tracking-[0.3em] font-bold uppercase" style={{ borderRadius: "var(--border-radius)" }} />

        <label className="block mb-1 font-semibold text-sm">{t("yourName")}</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full mb-4 p-3 border border-gray-200 outline-none" style={{ borderRadius: "var(--border-radius)" }} />

        <label className="block mb-1 font-semibold text-sm">{t("yourRole")}</label>
        <div className="flex gap-3 mb-4">
          {(["parent", "child"] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)} className="flex-1 py-2 font-semibold cursor-pointer transition-all" style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: role === r ? "var(--color-primary)" : "var(--color-background)",
              color: role === r ? "#fff" : "var(--color-text)",
            }}>
              {t(r === "parent" ? "roleParent" : "roleChild")}
            </button>
          ))}
        </div>

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

        <button onClick={handleJoin} disabled={loading || !inviteCode || !name} className="w-full py-3 text-white font-bold disabled:opacity-50 cursor-pointer" style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--border-radius)" }}>
          {loading ? "..." : t("join")}
        </button>
      </div>
    </div>
  );
}
