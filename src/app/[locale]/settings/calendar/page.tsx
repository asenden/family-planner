"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface CalendarAccount {
  id: string;
  provider: string;
  username: string;
  serverUrl: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  calendarId: string | null;
}

const PROVIDER_ICONS: Record<string, string> = {
  apple: "🍎",
  google: "🔵",
  other: "📅",
};

export default function CalendarSettingsPage() {
  const t = useTranslations("calendarSettings");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const familyRes = await fetch("/api/families");
        if (!familyRes.ok) return;
        const familyData = await familyRes.json();
        const id = familyData.family?.id || familyData.id || null;
        if (!id) return;
        setFamilyId(id);

        const accountsRes = await fetch(`/api/families/${id}/calendar-accounts`);
        if (!accountsRes.ok) return;
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.accounts || []);
      } catch {
        // silently fail if API unavailable
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleRemove(accountId: string) {
    if (!familyId) return;
    await fetch(`/api/families/${familyId}/calendar-accounts/${accountId}`, {
      method: "DELETE",
    });
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  }

  function handleAccountAdded(account: CalendarAccount) {
    setAccounts((prev) => [...prev, account]);
    setShowAddForm(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
        <p style={{ color: "var(--color-text-muted)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text)" }}>
          {t("title")}
        </h1>

        {/* Account List */}
        <div className="space-y-3 mb-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-4"
              style={{
                backgroundColor: "var(--color-surface)",
                borderRadius: "var(--border-radius)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{PROVIDER_ICONS[account.provider] ?? "📅"}</span>
                <div>
                  <p className="font-semibold" style={{ color: "var(--color-text)" }}>
                    {account.username}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {account.lastSyncAt
                      ? t("lastSync", { time: new Date(account.lastSyncAt).toLocaleString() })
                      : t("neverSynced")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemove(account.id)}
                className="text-sm px-3 py-1 cursor-pointer font-semibold"
                style={{
                  color: "#FF6B6B",
                  backgroundColor: "var(--color-background)",
                  borderRadius: "var(--border-radius)",
                }}
              >
                {t("remove")}
              </button>
            </div>
          ))}

          {accounts.length === 0 && !showAddForm && (
            <p className="text-center py-8" style={{ color: "var(--color-text-muted)" }}>
              No calendar accounts yet.
            </p>
          )}
        </div>

        {/* Add Calendar Button */}
        {!showAddForm && (
          <button
            onClick={() => { setShowAddForm(true); setError(null); }}
            className="w-full py-3 text-white font-bold cursor-pointer"
            style={{
              backgroundColor: "var(--color-primary)",
              borderRadius: "var(--border-radius)",
            }}
          >
            + {t("addAccount")}
          </button>
        )}

        {/* Add Calendar Form */}
        {showAddForm && familyId && (
          <AddCalendarForm
            familyId={familyId}
            error={error}
            onError={setError}
            onCancel={() => { setShowAddForm(false); setError(null); }}
            onAdded={handleAccountAdded}
          />
        )}
      </div>
    </div>
  );
}

function AddCalendarForm({
  familyId,
  error,
  onError,
  onCancel,
  onAdded,
}: {
  familyId: string;
  error: string | null;
  onError: (msg: string) => void;
  onCancel: () => void;
  onAdded: (account: CalendarAccount) => void;
}) {
  const t = useTranslations("calendarSettings");
  const [provider, setProvider] = useState("apple");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);

  function handleGoogleConnect() {
    window.location.href = `/api/auth/google-calendar/start?familyId=${familyId}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    onError("");

    try {
      const res = await fetch(`/api/families/${familyId}/calendar-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, username, password, serverUrl: serverUrl || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        onError(data.error || t("connectionFailed"));
      } else {
        onAdded(data.account);
      }
    } catch {
      onError(t("connectionFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--border-radius)",
      }}
    >
      <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text)" }}>
        {t("addAccount")}
      </h2>

      {error && (
        <p className="mb-3 text-sm font-semibold" style={{ color: "#FF6B6B" }}>
          {error}
        </p>
      )}

      {/* Provider */}
      <label className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        {t("provider")}
      </label>
      <div className="flex gap-2 mb-3">
        {[
          { value: "apple", label: t("providerApple") },
          { value: "google", label: t("providerGoogle") },
          { value: "other", label: t("providerOther") },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setProvider(opt.value)}
            className="flex-1 py-2 text-sm font-semibold cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: provider === opt.value ? "var(--color-primary)" : "var(--color-background)",
              color: provider === opt.value ? "#fff" : "var(--color-text)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {provider === "google" ? (
        /* Google: OAuth button */
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 font-semibold cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: "var(--color-background)",
              color: "var(--color-text)",
            }}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleGoogleConnect}
            className="flex-1 py-2 text-white font-semibold cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: "#4285F4",
            }}
          >
            Mit Google verbinden
          </button>
        </div>
      ) : (
        /* Apple/Other: credential form */
        <form onSubmit={handleSubmit}>
          {/* Username */}
          <label className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {t("username")}
          </label>
          <input
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@example.com"
            className="w-full mb-3 p-2 border border-gray-200 outline-none"
            style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
            required
          />

          {/* Password */}
          <label className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {t("password")}
          </label>
          {provider === "apple" && (
            <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
              {t("passwordHint")}
            </p>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-3 p-2 border border-gray-200 outline-none"
            style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
            required
          />

          {/* Server URL (only for "other") */}
          {provider === "other" && (
            <>
              <label className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {t("serverUrl")}
              </label>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://caldav.example.com"
                className="w-full mb-3 p-2 border border-gray-200 outline-none"
                style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
              />
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 font-semibold cursor-pointer"
              style={{
                borderRadius: "var(--border-radius)",
                backgroundColor: "var(--color-background)",
                color: "var(--color-text)",
              }}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!username || !password || loading}
              className="flex-1 py-2 text-white font-semibold disabled:opacity-50 cursor-pointer"
              style={{
                borderRadius: "var(--border-radius)",
                backgroundColor: "var(--color-primary)",
              }}
            >
              {loading ? "..." : t("connect")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
