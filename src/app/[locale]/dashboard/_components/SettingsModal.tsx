"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Settings, Users, CalendarDays, Key, X } from "lucide-react";

interface FamilyMember {
  id: string;
  name: string;
  color: string;
  avatar?: string | null;
}

interface CalendarAccount {
  id: string;
  provider: string;
  username: string;
  serverUrl: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  calendarId: string | null;
}

interface SettingsModalProps {
  familyId: string;
  familyCode: string;
  members: FamilyMember[];
  onClose: () => void;
}

type Tab = "members" | "calendars" | "code";

const PROVIDER_ICONS: Record<string, string> = {
  apple: "🍎",
  google: "🔵",
  other: "📅",
};

const COLOR_OPTIONS = [
  "#FF6B6B", "#FF9F43", "#FECA57", "#48DBFB",
  "#1DD1A1", "#FF9FF3", "#54A0FF", "#5F27CD",
];

const inputStyle = {
  backgroundColor: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "var(--color-text)",
} as const;

export function SettingsModal({ familyId, familyCode, members: initialMembers, onClose }: SettingsModalProps) {
  const t = useTranslations("settings");
  const tCal = useTranslations("calendarSettings");
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [members, setMembers] = useState<FamilyMember[]>(initialMembers);
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCalendar, setShowAddCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "calendars") {
      setLoadingAccounts(true);
      fetch(`/api/families/${familyId}/calendar-accounts`)
        .then((r) => r.json())
        .then((data) => setAccounts(data.accounts || []))
        .catch(() => {})
        .finally(() => setLoadingAccounts(false));
    }
  }, [activeTab, familyId]);

  async function handleRemoveAccount(accountId: string) {
    await fetch(`/api/families/${familyId}/calendar-accounts/${accountId}`, { method: "DELETE" });
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  }

  const tabs: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: "members", icon: <Users size={16} strokeWidth={1.5} />, label: t("familyMembers") },
    { key: "calendars", icon: <CalendarDays size={16} strokeWidth={1.5} />, label: t("calendarConnectors") },
    { key: "code", icon: <Key size={16} strokeWidth={1.5} />, label: t("familyCode") },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden"
        style={{ borderRadius: "var(--border-radius)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Settings size={20} strokeWidth={1.5} style={{ color: "var(--color-primary)" }} />
            <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
              {t("title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="glass-hover p-2 rounded-xl cursor-pointer transition-all"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 cursor-pointer font-semibold transition-all"
              style={{
                borderRadius: "var(--border-radius)",
                backgroundColor: activeTab === tab.key ? "var(--color-primary)" : "rgba(255,255,255,0.05)",
                color: activeTab === tab.key ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === "members" && (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: "calc(var(--border-radius) / 2)",
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: member.color }}
                  />
                  <span className="font-semibold flex-1" style={{ color: "var(--color-text)" }}>
                    {member.name}
                  </span>
                </div>
              ))}

              {showAddMember ? (
                <AddMemberForm
                  familyCode={familyCode}
                  onClose={() => setShowAddMember(false)}
                  onAdded={(member) => {
                    setMembers((prev) => [...prev, member]);
                    setShowAddMember(false);
                  }}
                />
              ) : (
                <button
                  onClick={() => setShowAddMember(true)}
                  className="w-full py-2 text-sm font-bold cursor-pointer mt-2"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    borderRadius: "var(--border-radius)",
                    color: "#fff",
                  }}
                >
                  + {t("addMember")}
                </button>
              )}
            </div>
          )}

          {activeTab === "calendars" && (
            <div className="space-y-3">
              {loadingAccounts ? (
                <p className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                  Loading...
                </p>
              ) : (
                <>
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.05)",
                        borderRadius: "calc(var(--border-radius) / 2)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{PROVIDER_ICONS[account.provider] ?? "📅"}</span>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                            {account.username}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {account.lastSyncAt
                              ? tCal("lastSync", { time: new Date(account.lastSyncAt).toLocaleString() })
                              : tCal("neverSynced")}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAccount(account.id)}
                        className="text-xs px-2 py-1 cursor-pointer font-semibold"
                        style={{
                          color: "#FF6B6B",
                          backgroundColor: "rgba(255,255,255,0.05)",
                          borderRadius: "var(--border-radius)",
                        }}
                      >
                        {tCal("remove")}
                      </button>
                    </div>
                  ))}

                  {accounts.length === 0 && !showAddCalendar && (
                    <p className="text-center py-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
                      No calendar accounts yet.
                    </p>
                  )}

                  {showAddCalendar ? (
                    <AddCalendarForm
                      familyId={familyId}
                      error={calendarError}
                      onError={setCalendarError}
                      onCancel={() => { setShowAddCalendar(false); setCalendarError(null); }}
                      onAdded={(account) => {
                        setAccounts((prev) => [...prev, account]);
                        setShowAddCalendar(false);
                        setCalendarError(null);
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => setShowAddCalendar(true)}
                      className="w-full py-2 text-sm font-bold cursor-pointer mt-2"
                      style={{
                        backgroundColor: "var(--color-primary)",
                        borderRadius: "var(--border-radius)",
                        color: "#fff",
                      }}
                    >
                      + {tCal("addAccount")}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "code" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Key size={40} strokeWidth={1.5} style={{ color: "var(--color-primary)" }} />
              <h3 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
                {t("familyCode")}
              </h3>
              <div
                className="text-4xl font-extrabold tracking-[0.3em] px-6 py-4"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: "var(--border-radius)",
                  color: "var(--color-primary)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {familyCode}
              </div>
              <p className="text-sm text-center" style={{ color: "var(--color-text-muted)" }}>
                {t("familyCodeHint")}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-2 font-semibold cursor-pointer"
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: "var(--border-radius)",
              color: "var(--color-text)",
            }}
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddMemberForm({
  familyCode,
  onClose,
  onAdded,
}: {
  familyCode: string;
  onClose: () => void;
  onAdded: (member: FamilyMember) => void;
}) {
  const t = useTranslations("settings");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"parent" | "child">("child");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/families/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: familyCode, name, role, color }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error || "Failed to add member.");
        setLoading(false);
        return;
      }
      onAdded({ id: data.member.id, name: data.member.name, color });
    } catch {
      setError("Failed to add member.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="p-4 mt-2"
      style={{
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: "calc(var(--border-radius) / 2)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--color-text)" }}>
        {t("addMember")}
      </h3>

      {error && (
        <p className="mb-3 text-xs font-semibold" style={{ color: "#FF6B6B" }}>{error}</p>
      )}

      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>
        {t("memberName")}
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full mb-3 p-2 text-sm outline-none"
        style={{ ...inputStyle, borderRadius: "calc(var(--border-radius) / 2)" }}
      />

      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>
        {t("memberRole")}
      </label>
      <div className="flex gap-2 mb-3">
        {(["parent", "child"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className="flex-1 py-1.5 text-sm font-semibold cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: role === r ? "var(--color-primary)" : "rgba(255,255,255,0.05)",
              color: role === r ? "#fff" : "var(--color-text)",
            }}
          >
            {t(r)}
          </button>
        ))}
      </div>

      <label className="block text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
        {t("memberColor")}
      </label>
      <div className="flex gap-2 mb-4 flex-wrap">
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="w-7 h-7 rounded-full cursor-pointer transition-all"
            style={{
              backgroundColor: c,
              outline: color === c ? `2px solid white` : "none",
              outlineOffset: "2px",
            }}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2 text-sm font-semibold cursor-pointer"
          style={{
            borderRadius: "var(--border-radius)",
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "var(--color-text)",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={!name || loading}
          className="flex-1 py-2 text-sm text-white font-semibold disabled:opacity-50 cursor-pointer"
          style={{
            borderRadius: "var(--border-radius)",
            backgroundColor: "var(--color-primary)",
          }}
        >
          {loading ? "..." : t("save")}
        </button>
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
        onError((data as { error?: string }).error || t("connectionFailed"));
      } else {
        onAdded((data as { account: CalendarAccount }).account);
      }
    } catch {
      onError(t("connectionFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 mt-2"
      style={{
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: "calc(var(--border-radius) / 2)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--color-text)" }}>
        {t("addAccount")}
      </h3>

      {error && (
        <p className="mb-3 text-xs font-semibold" style={{ color: "#FF6B6B" }}>{error}</p>
      )}

      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>
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
            className="flex-1 py-1.5 text-sm font-semibold cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: provider === opt.value ? "var(--color-primary)" : "rgba(255,255,255,0.05)",
              color: provider === opt.value ? "#fff" : "var(--color-text)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>
        {t("username")}
      </label>
      <input
        type="email"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="you@example.com"
        className="w-full mb-3 p-2 text-sm outline-none"
        style={{ ...inputStyle, borderRadius: "calc(var(--border-radius) / 2)" }}
        required
      />

      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>
        {t("password")}
      </label>
      {provider === "apple" && (
        <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>{t("passwordHint")}</p>
      )}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full mb-3 p-2 text-sm outline-none"
        style={{ ...inputStyle, borderRadius: "calc(var(--border-radius) / 2)" }}
        required
      />

      {provider === "other" && (
        <>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>
            {t("serverUrl")}
          </label>
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://caldav.example.com"
            className="w-full mb-3 p-2 text-sm outline-none"
            style={{ ...inputStyle, borderRadius: "calc(var(--border-radius) / 2)" }}
          />
        </>
      )}

      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 text-sm font-semibold cursor-pointer"
          style={{
            borderRadius: "var(--border-radius)",
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "var(--color-text)",
          }}
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={!username || !password || loading}
          className="flex-1 py-2 text-sm text-white font-semibold disabled:opacity-50 cursor-pointer"
          style={{
            borderRadius: "var(--border-radius)",
            backgroundColor: "var(--color-primary)",
          }}
        >
          {loading ? "..." : t("connect")}
        </button>
      </div>
    </form>
  );
}
