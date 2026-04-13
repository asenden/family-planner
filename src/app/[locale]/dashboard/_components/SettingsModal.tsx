"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Settings, Users, CalendarDays, Key, X, MapPin, ListChecks, Trophy, Plus, Trash2, Pencil } from "lucide-react";

interface FamilyMember {
  id: string;
  name: string;
  color: string;
  avatar?: string | null;
  role?: string;
}

interface CalendarAccount {
  id: string;
  provider: string;
  username: string;
  serverUrl: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  calendarId: string | null;
  calendarName: string | null;
}

interface GeoResult {
  name: string;
  country: string;
  admin1: string;
  latitude: number;
  longitude: number;
}

interface RoutineTask {
  id: string;
  title: string;
  icon: string;
  points: number;
  order: number;
}

interface Routine {
  id: string;
  title: string;
  icon: string;
  schedule: "daily" | "weekdays" | "custom";
  customDays: number[];
  assignedTo: string;
  tasks: RoutineTask[];
  member: { id: string; name: string; color: string };
}

interface Reward {
  id: string;
  title: string;
  icon: string;
  cost: number;
  assignedTo: string | null;
  redemptions: { id: string; memberId: string }[];
}

interface SettingsModalProps {
  familyId: string;
  familyCode: string;
  members: FamilyMember[];
  city?: string | null;
  isParent?: boolean;
  onClose: () => void;
}

type Tab = "members" | "calendars" | "location" | "code" | "routines";

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

export function SettingsModal({ familyId, familyCode, members: initialMembers, city: initialCity, onClose }: SettingsModalProps) {
  const t = useTranslations("settings");
  const tCal = useTranslations("calendarSettings");
  const tWeather = useTranslations("weather");
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [members, setMembers] = useState<FamilyMember[]>(initialMembers);
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCalendar, setShowAddCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Location state
  const [locationQuery, setLocationQuery] = useState("");
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [searchingGeo, setSearchingGeo] = useState(false);
  const [currentCity, setCurrentCity] = useState<string | null>(initialCity ?? null);
  const [locationSaved, setLocationSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Routines state
  const tRoutines = useTranslations("routines");
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  // Simplified task management state
  const children = members.filter((m) => m.role === "child");
  const [selectedChildId, setSelectedChildId] = useState<string>(() => children[0]?.id ?? "");
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<{ task: RoutineTask; routineId: string } | null>(null);

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

  useEffect(() => {
    if (activeTab !== "routines") return;
    setLoadingRoutines(true);
    Promise.all([
      fetch(`/api/families/${familyId}/routines`).then((r) => r.json()),
      fetch(`/api/families/${familyId}/rewards`).then((r) => r.json()),
    ])
      .then(([routinesData, rewardsData]) => {
        setRoutines(routinesData.routines ?? []);
        setRewards(rewardsData.rewards ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingRoutines(false));
  }, [activeTab, familyId]);

  useEffect(() => {
    if (!locationQuery.trim()) {
      setGeoResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchingGeo(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(locationQuery)}`);
        const data = await res.json();
        setGeoResults(data.results || []);
      } catch {
        setGeoResults([]);
      } finally {
        setSearchingGeo(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [locationQuery]);

  async function handleSelectLocation(result: GeoResult) {
    const cityLabel = result.admin1 ? `${result.name}, ${result.admin1}` : result.name;
    await fetch(`/api/families/${familyId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: result.latitude, longitude: result.longitude, city: cityLabel }),
    });
    setCurrentCity(cityLabel);
    setLocationQuery("");
    setGeoResults([]);
    setLocationSaved(true);
    setTimeout(() => setLocationSaved(false), 3000);
  }

  async function handleToggleAccount(accountId: string, enabled: boolean) {
    await fetch(`/api/families/${familyId}/calendar-accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncEnabled: enabled }),
    });
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, syncEnabled: enabled } : a))
    );
  }

  async function handleRemoveAccount(accountId: string) {
    await fetch(`/api/families/${familyId}/calendar-accounts/${accountId}`, { method: "DELETE" });
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  }

  const tabs: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: "members", icon: <Users size={16} strokeWidth={1.5} />, label: t("familyMembers") },
    { key: "calendars", icon: <CalendarDays size={16} strokeWidth={1.5} />, label: t("calendarConnectors") },
    { key: "location", icon: <MapPin size={16} strokeWidth={1.5} />, label: t("location") },
    { key: "routines", icon: <ListChecks size={16} strokeWidth={1.5} />, label: tRoutines("settingsTab") },
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
        <div className="flex gap-1 px-6 pt-4 flex-wrap">
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
                            {account.calendarName || account.username}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {account.calendarName ? `${account.username} · ` : ""}
                            {account.lastSyncAt
                              ? tCal("lastSync", { time: new Date(account.lastSyncAt).toLocaleString() })
                              : tCal("neverSynced")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleAccount(account.id, !account.syncEnabled)}
                          className="relative w-10 h-5 rounded-full cursor-pointer transition-colors"
                          style={{
                            backgroundColor: account.syncEnabled
                              ? "var(--color-primary)"
                              : "rgba(255,255,255,0.15)",
                          }}
                          title={account.syncEnabled ? "Sync an" : "Sync aus"}
                        >
                          <div
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                            style={{
                              transform: account.syncEnabled ? "translateX(22px)" : "translateX(2px)",
                            }}
                          />
                        </button>
                        <button
                          onClick={() => handleRemoveAccount(account.id)}
                          className="text-xs px-2 py-1 cursor-pointer font-semibold"
                          style={{
                            color: "#FF6B6B",
                            backgroundColor: "rgba(255,255,255,0.05)",
                            borderRadius: "calc(var(--border-radius) / 2)",
                          }}
                        >
                          ✕
                        </button>
                      </div>
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
                      onAdded={(newAccounts) => {
                        setAccounts((prev) => [...prev, ...newAccounts]);
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

          {activeTab === "location" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={18} strokeWidth={1.5} style={{ color: "var(--color-primary)" }} />
                <span className="font-semibold" style={{ color: "var(--color-text)" }}>
                  {t("location")}
                </span>
              </div>

              {currentCity && (
                <div
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: "calc(var(--border-radius) / 2)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <MapPin size={14} strokeWidth={1.5} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                  <span>{tWeather("locationSet", { city: currentCity })}</span>
                </div>
              )}

              {locationSaved && (
                <p className="text-xs font-semibold" style={{ color: "#1DD1A1" }}>
                  ✓ {tWeather("locationSet", { city: currentCity ?? "" })}
                </p>
              )}

              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder={tWeather("locationSearch")}
                className="w-full p-2 text-sm outline-none"
                style={{ ...inputStyle, borderRadius: "calc(var(--border-radius) / 2)" }}
              />

              {searchingGeo && (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>...</p>
              )}

              {geoResults.length > 0 && (
                <div className="space-y-1">
                  {geoResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectLocation(r)}
                      className="w-full text-left px-3 py-2 text-sm cursor-pointer transition-all"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.05)",
                        borderRadius: "calc(var(--border-radius) / 2)",
                        color: "var(--color-text)",
                      }}
                    >
                      <span className="font-semibold">{r.name}</span>
                      {r.admin1 && (
                        <span style={{ color: "var(--color-text-muted)" }}>, {r.admin1}</span>
                      )}
                      {r.country && (
                        <span style={{ color: "var(--color-text-muted)" }}> — {r.country}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {!currentCity && geoResults.length === 0 && !locationQuery && (
                <p className="text-sm text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                  {tWeather("notConfigured")}
                </p>
              )}
            </div>
          )}

          {activeTab === "routines" && (
            <div className="space-y-4">
              {loadingRoutines ? (
                <p className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                  ...
                </p>
              ) : (
                <>
                  {/* --- Tasks section --- */}
                  <div>
                    {/* Child selector */}
                    {children.length > 1 && (
                      <div className="flex gap-1 mb-3 flex-wrap">
                        {children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => { setSelectedChildId(child.id); setShowAddTask(false); setEditingTask(null); }}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                            style={{
                              backgroundColor: selectedChildId === child.id ? "var(--color-primary)" : "rgba(255,255,255,0.07)",
                              color: selectedChildId === child.id ? "#fff" : "var(--color-text-muted)",
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: child.color ?? "#888" }}
                            />
                            {child.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {children.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        {tRoutines("noRoutines")}
                      </p>
                    ) : (
                      (() => {
                        const activeChild = children.find((c) => c.id === selectedChildId) ?? children[0];
                        if (!activeChild) return null;
                        const TIME_SLOT_ICONS: Record<string, string> = { "Morgens": "🌅", "Tagsüber": "☀️", "Abends": "🌙" };
                        const childRoutines = routines.filter((r) => r.assignedTo === activeChild.id);
                        const allTasks = childRoutines.flatMap((r) =>
                          r.tasks.map((t) => ({ ...t, routineId: r.id, routineTitle: r.title, routineSchedule: r.schedule, routineCustomDays: r.customDays }))
                        );

                        return (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                                {tRoutines("tasksFor", { name: activeChild.name })}
                              </p>
                              {!showAddTask && (
                                <button
                                  onClick={() => { setShowAddTask(true); setEditingTask(null); }}
                                  className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg cursor-pointer"
                                  style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
                                >
                                  <Plus size={12} /> {tRoutines("addTask")}
                                </button>
                              )}
                            </div>

                            <div className="space-y-2 mb-3">
                              {allTasks.map((task) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between p-2.5 rounded-xl"
                                  style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                                >
                                  <span className="text-sm flex-1" style={{ color: "var(--color-text)" }}>
                                    {TIME_SLOT_ICONS[task.routineTitle] && (
                                      <span className="mr-1 opacity-70">{TIME_SLOT_ICONS[task.routineTitle]}</span>
                                    )}
                                    {task.icon} {task.title}
                                    <span className="ml-1.5 text-xs" style={{ color: "#f59e0b" }}>+{task.points}</span>
                                    {task.routineSchedule === "weekdays" && (
                                      <span className="ml-1.5 text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>{tRoutines("scheduleMoFr")}</span>
                                    )}
                                    {task.routineSchedule === "custom" && task.routineCustomDays.length > 0 && (
                                      <span className="ml-1.5 text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                                        {task.routineCustomDays
                                          .slice()
                                          .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
                                          .map((d) => ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d])
                                          .join(", ")}
                                      </span>
                                    )}
                                  </span>
                                  <div className="flex gap-1.5 shrink-0">
                                    <button
                                      onClick={() => { setEditingTask({ task, routineId: task.routineId }); setShowAddTask(false); }}
                                      className="p-1.5 rounded-lg cursor-pointer"
                                      style={{ color: "var(--color-text-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}
                                    >
                                      <Pencil size={13} strokeWidth={1.5} />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!confirm(tRoutines("confirmDelete"))) return;
                                        await fetch(`/api/families/${familyId}/routines/${task.routineId}/tasks/${task.id}`, { method: "DELETE" });
                                        setRoutines((prev) => prev.map((r) =>
                                          r.id === task.routineId
                                            ? { ...r, tasks: r.tasks.filter((t) => t.id !== task.id) }
                                            : r
                                        ));
                                      }}
                                      className="p-1.5 rounded-lg cursor-pointer"
                                      style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}
                                    >
                                      <Trash2 size={13} strokeWidth={1.5} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {allTasks.length === 0 && !showAddTask && (
                                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{tRoutines("noRoutines")}</p>
                              )}
                            </div>

                            {/* Add Task inline form */}
                            {showAddTask && (
                              <AddTaskForm
                                familyId={familyId}
                                memberId={activeChild.id}
                                routines={routines}
                                onClose={() => setShowAddTask(false)}
                                onAdded={(task, routineId) => {
                                  setRoutines((prev) => {
                                    const exists = prev.find((r) => r.id === routineId);
                                    if (exists) {
                                      return prev.map((r) => r.id === routineId ? { ...r, tasks: [...r.tasks, task] } : r);
                                    }
                                    return prev;
                                  });
                                  setShowAddTask(false);
                                }}
                                onRoutineCreated={(routine) => {
                                  setRoutines((prev) => [...prev, routine]);
                                }}
                              />
                            )}

                            {/* Edit Task inline form */}
                            {editingTask && (
                              <EditTaskForm
                                familyId={familyId}
                                routineId={editingTask.routineId}
                                task={editingTask.task}
                                routines={routines}
                                memberId={selectedChildId}
                                onClose={() => setEditingTask(null)}
                                onRoutineCreated={(routine) => setRoutines((prev) => [...prev, routine])}
                                onUpdated={(updatedTask, oldRoutineId, newRoutineId) => {
                                  if (oldRoutineId === newRoutineId) {
                                    // Same routine — just update the task
                                    setRoutines((prev) => prev.map((r) =>
                                      r.id === oldRoutineId
                                        ? { ...r, tasks: r.tasks.map((t) => t.id === updatedTask.id ? updatedTask : t) }
                                        : r
                                    ));
                                  } else {
                                    // Moved to different routine — remove from old, add to new
                                    setRoutines((prev) => prev.map((r) => {
                                      if (r.id === oldRoutineId) {
                                        return { ...r, tasks: r.tasks.filter((t) => t.id !== editingTask.task.id) };
                                      }
                                      if (r.id === newRoutineId) {
                                        return { ...r, tasks: [...r.tasks, updatedTask] };
                                      }
                                      return r;
                                    }));
                                  }
                                  setEditingTask(null);
                                }}
                              />
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>

                  {/* --- Rewards section --- */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                        {tRoutines("manageRewards")}
                      </p>
                      <button
                        onClick={() => setShowAddReward(true)}
                        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg cursor-pointer"
                        style={{ backgroundColor: "#f59e0b", color: "#1a1625" }}
                      >
                        <Trophy size={12} /> {tRoutines("addReward")}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {rewards.map((reward) => (
                        <div
                          key={reward.id}
                          className="flex items-center justify-between p-3 rounded-xl"
                          style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                        >
                          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                            {reward.icon} {reward.title}
                            <span className="ml-2 text-xs font-normal" style={{ color: "#f59e0b" }}>
                              {reward.cost} pts
                            </span>
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingReward(reward)}
                              className="p-1.5 rounded-lg cursor-pointer"
                              style={{ color: "var(--color-text-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}
                            >
                              <Pencil size={14} strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(tRoutines("confirmDelete"))) return;
                                await fetch(`/api/families/${familyId}/rewards/${reward.id}`, { method: "DELETE" });
                                setRewards((prev) => prev.filter((r) => r.id !== reward.id));
                              }}
                              className="p-1.5 rounded-lg cursor-pointer"
                              style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}
                            >
                              <Trash2 size={14} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {rewards.length === 0 && (
                        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{tRoutines("noRewards")}</p>
                      )}
                    </div>
                  </div>

                  {/* Add Reward Form */}
                  {showAddReward && (
                    <AddRewardForm
                      familyId={familyId}
                      members={children}
                      onClose={() => setShowAddReward(false)}
                      onAdded={(reward) => {
                        setRewards((prev) => [...prev, reward]);
                        setShowAddReward(false);
                      }}
                    />
                  )}

                  {/* Edit Reward Modal */}
                  {editingReward && (
                    <EditRewardForm
                      familyId={familyId}
                      members={children}
                      reward={editingReward}
                      onClose={() => setEditingReward(null)}
                      onUpdated={(updated) => {
                        setRewards((prev) => prev.map((r) => r.id === updated.id ? updated : r));
                        setEditingReward(null);
                      }}
                    />
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

type FormStep = "credentials" | "select-calendars";

interface DiscoveredCalendar {
  url: string;
  displayName: string;
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
  onAdded: (accounts: CalendarAccount[]) => void;
}) {
  const t = useTranslations("calendarSettings");
  const [formStep, setFormStep] = useState<FormStep>("credentials");
  const [provider, setProvider] = useState("apple");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [discoveredCalendars, setDiscoveredCalendars] = useState<DiscoveredCalendar[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    onError("");

    try {
      const res = await fetch(`/api/families/${familyId}/calendar-accounts/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, username, password, serverUrl: serverUrl || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        onError((data as { error?: string }).error || t("connectionFailed"));
      } else {
        const calendars = (data as { calendars: DiscoveredCalendar[] }).calendars;
        setDiscoveredCalendars(calendars);
        // Pre-select all calendars
        setSelectedCalendars(calendars.map((c) => c.url));
        setFormStep("select-calendars");
      }
    } catch {
      onError(t("connectionFailed"));
    } finally {
      setLoading(false);
    }
  }

  function toggleCalendar(url: string) {
    setSelectedCalendars((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  }

  async function handleSave() {
    if (selectedCalendars.length === 0) return;
    setLoading(true);
    onError("");

    try {
      const created: CalendarAccount[] = [];
      for (const calUrl of selectedCalendars) {
        const cal = discoveredCalendars.find((c) => c.url === calUrl);
        const res = await fetch(`/api/families/${familyId}/calendar-accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            username,
            password,
            serverUrl: serverUrl || undefined,
            calendarId: calUrl,
            calendarName: cal?.displayName ?? null,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          created.push((data as { account: CalendarAccount }).account);
        }
      }
      if (created.length > 0) {
        onAdded(created);
      } else {
        onError(t("connectionFailed"));
      }
    } catch {
      onError(t("connectionFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (formStep === "select-calendars") {
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
          {t("selectCalendars")}
        </h3>

        {error && (
          <p className="mb-3 text-xs font-semibold" style={{ color: "#FF6B6B" }}>{error}</p>
        )}

        <div className="space-y-2 mb-4">
          {discoveredCalendars.map((cal) => {
            const isChecked = selectedCalendars.includes(cal.url);
            return (
              <label
                key={cal.url}
                className="flex items-center gap-3 p-2 cursor-pointer transition-all"
                style={{
                  backgroundColor: isChecked ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  borderRadius: "calc(var(--border-radius) / 2)",
                  border: `1px solid ${isChecked ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCalendar(cal.url)}
                  className="w-4 h-4 cursor-pointer accent-[var(--color-primary)]"
                />
                <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  {cal.displayName}
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setFormStep("credentials"); onError(""); }}
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
            type="button"
            onClick={handleSave}
            disabled={selectedCalendars.length === 0 || loading}
            className="flex-1 py-2 text-sm text-white font-semibold disabled:opacity-50 cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: "var(--color-primary)",
            }}
          >
            {loading ? t("saving") : t("connect")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleConnect}
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
          {loading ? t("connecting") : t("connect")}
        </button>
      </div>
    </form>
  );
}

function AddTaskForm({
  familyId,
  memberId,
  routines,
  onClose,
  onAdded,
  onRoutineCreated,
}: {
  familyId: string;
  memberId: string;
  routines: Routine[];
  onClose: () => void;
  onAdded: (task: RoutineTask, routineId: string) => void;
  onRoutineCreated: (routine: Routine) => void;
}) {
  const tRoutines = useTranslations("routines");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("✅");
  const [points, setPoints] = useState(1);
  const [timeSlot, setTimeSlot] = useState<"morning" | "daytime" | "evening">("morning");
  const [schedule, setSchedule] = useState<"daily" | "weekdays" | "custom">("daily");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const slotTitles = { morning: "Morgens", daytime: "Tagsüber", evening: "Abends" };
      const routineTitle = slotTitles[timeSlot];

      // Find or create a routine matching the selected time slot + schedule
      let routine = routines.find((r) =>
        r.assignedTo === memberId &&
        r.title === routineTitle &&
        r.schedule === schedule &&
        (schedule !== "custom" || JSON.stringify([...r.customDays].sort()) === JSON.stringify([...customDays].sort()))
      );
      if (!routine) {
        const res = await fetch(`/api/families/${familyId}/routines`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: routineTitle,
            icon: timeSlot === "morning" ? "🌅" : timeSlot === "daytime" ? "☀️" : "🌙",
            schedule,
            customDays: schedule === "custom" ? customDays : [],
            assignedTo: memberId,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        routine = data.routine;
        onRoutineCreated(data.routine);
      }
      const res = await fetch(`/api/families/${familyId}/routines/${routine!.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, icon, points }),
      });
      if (res.ok) {
        const data = await res.json();
        onAdded(data.task, routine!.id);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{tRoutines("addTask")}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-14 text-center text-2xl rounded-xl p-2"
          style={inputStyle}
          maxLength={2}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tRoutines("taskTitle")}
          className="flex-1 rounded-xl px-3 py-2 text-sm"
          style={inputStyle}
          required
        />
        <input
          type="number"
          value={points}
          min={1}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="w-16 rounded-xl px-3 py-2 text-sm text-center"
          style={inputStyle}
        />
      </div>
      {/* Time of day picker */}
      <div>
        <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--color-text-muted)" }}>
          {tRoutines("timeOfDay")}
        </p>
        <div className="flex gap-1.5">
          {[
            { key: "morning" as const, icon: "🌅", label: tRoutines("morning") },
            { key: "daytime" as const, icon: "☀️", label: tRoutines("daytime") },
            { key: "evening" as const, icon: "🌙", label: tRoutines("evening") },
          ].map((slot) => (
            <button
              key={slot.key}
              type="button"
              onClick={() => setTimeSlot(slot.key)}
              className="flex-1 py-2 text-xs font-semibold rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: timeSlot === slot.key ? "var(--color-primary)" : "rgba(255,255,255,0.06)",
                color: timeSlot === slot.key ? "#fff" : "var(--color-text-muted)",
              }}
            >
              <span>{slot.icon}</span> {slot.label}
            </button>
          ))}
        </div>
      </div>
      {/* Schedule picker */}
      <div>
        <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--color-text-muted)" }}>
          {tRoutines("schedule")}
        </p>
        <div className="flex gap-1.5 mb-2">
          {(["daily", "weekdays", "custom"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSchedule(s)}
              className="flex-1 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
              style={{
                backgroundColor: schedule === s ? "var(--color-primary)" : "rgba(255,255,255,0.06)",
                color: schedule === s ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {tRoutines(`schedule${s.charAt(0).toUpperCase() + s.slice(1)}` as "scheduleDaily" | "scheduleWeekdays" | "scheduleCustom")}
            </button>
          ))}
        </div>
        {schedule === "custom" && (
          <div className="flex gap-1">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label, i) => {
              const jsDay = i === 6 ? 0 : i + 1;
              return (
                <button
                  key={jsDay}
                  type="button"
                  onClick={() => setCustomDays((prev) => prev.includes(jsDay) ? prev.filter((d) => d !== jsDay) : [...prev, jsDay])}
                  className="w-9 h-9 rounded-lg text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: customDays.includes(jsDay) ? "var(--color-primary)" : "rgba(255,255,255,0.06)",
                    color: customDays.includes(jsDay) ? "#fff" : "var(--color-text-muted)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm cursor-pointer" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving || !title.trim()} className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50" style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}>
          {saving ? "..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function EditTaskForm({
  familyId,
  routineId,
  task,
  routines,
  memberId,
  onClose,
  onUpdated,
  onRoutineCreated,
}: {
  familyId: string;
  routineId: string;
  task: RoutineTask;
  routines: Routine[];
  memberId: string;
  onClose: () => void;
  onUpdated: (task: RoutineTask, oldRoutineId: string, newRoutineId: string) => void;
  onRoutineCreated: (routine: Routine) => void;
}) {
  const tRoutines = useTranslations("routines");

  // Determine current time slot and schedule from the parent routine
  const currentRoutine = routines.find((r) => r.id === routineId);
  const SLOT_TITLES_REVERSE: Record<string, "morning" | "daytime" | "evening"> = { "Morgens": "morning", "Tagsüber": "daytime", "Abends": "evening" };
  const currentSlot = currentRoutine ? (SLOT_TITLES_REVERSE[currentRoutine.title] ?? "morning") : "morning";
  const currentSchedule = currentRoutine?.schedule ?? "daily";
  const currentCustomDays = currentRoutine?.customDays ?? [];

  const [title, setTitle] = useState(task.title);
  const [icon, setIcon] = useState(task.icon);
  const [points, setPoints] = useState(task.points);
  const [timeSlot, setTimeSlot] = useState<"morning" | "daytime" | "evening">(currentSlot);
  const [schedule, setSchedule] = useState<"daily" | "weekdays" | "custom">(currentSchedule as "daily" | "weekdays" | "custom");
  const [customDays, setCustomDays] = useState<number[]>(currentCustomDays);
  const [saving, setSaving] = useState(false);

  const SLOT_TITLES: Record<string, string> = { morning: "Morgens", daytime: "Tagsüber", evening: "Abends" };
  const SLOT_ICONS: Record<string, string> = { morning: "🌅", daytime: "☀️", evening: "🌙" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    try {
      // First, update the task fields (title, icon, points)
      const updateRes = await fetch(`/api/families/${familyId}/routines/${routineId}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, icon, points }),
      });
      if (!updateRes.ok) { setSaving(false); return; }
      const updatedTask = (await updateRes.json()).task;

      // Check if time slot or schedule changed — need to move task to a different routine
      const slotChanged = timeSlot !== currentSlot;
      const scheduleChanged = schedule !== currentSchedule || JSON.stringify([...customDays].sort()) !== JSON.stringify([...currentCustomDays].sort());

      if (slotChanged || scheduleChanged) {
        // Find or create the target routine
        const targetTitle = SLOT_TITLES[timeSlot];
        let targetRoutine = routines.find((r) =>
          r.assignedTo === memberId &&
          r.title === targetTitle &&
          r.schedule === schedule &&
          (schedule !== "custom" || JSON.stringify([...r.customDays].sort()) === JSON.stringify([...customDays].sort()))
        );

        if (!targetRoutine) {
          const res = await fetch(`/api/families/${familyId}/routines`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: targetTitle,
              icon: SLOT_ICONS[timeSlot],
              schedule,
              customDays: schedule === "custom" ? customDays : [],
              assignedTo: memberId,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            targetRoutine = data.routine;
            onRoutineCreated(data.routine);
          }
        }

        if (targetRoutine && targetRoutine.id !== routineId) {
          // Delete from old routine, create in new one
          await fetch(`/api/families/${familyId}/routines/${routineId}/tasks/${task.id}`, { method: "DELETE" });
          const createRes = await fetch(`/api/families/${familyId}/routines/${targetRoutine.id}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, icon, points }),
          });
          if (createRes.ok) {
            const newTask = (await createRes.json()).task;
            onUpdated(newTask, routineId, targetRoutine.id);
            setSaving(false);
            return;
          }
        }
      }

      onUpdated(updatedTask, routineId, routineId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{tRoutines("editTask")}</p>
      <div className="flex gap-2">
        <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} className="w-14 text-center text-2xl rounded-xl p-2" style={inputStyle} maxLength={2} />
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tRoutines("taskTitle")} className="flex-1 rounded-xl px-3 py-2 text-sm" style={inputStyle} required />
        <input type="number" value={points} min={1} onChange={(e) => setPoints(Number(e.target.value))} className="w-16 rounded-xl px-3 py-2 text-sm text-center" style={inputStyle} />
      </div>

      {/* Time of day */}
      <div>
        <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--color-text-muted)" }}>{tRoutines("timeOfDay")}</p>
        <div className="flex gap-1.5">
          {([
            { key: "morning" as const, icon: "🌅", label: tRoutines("morning") },
            { key: "daytime" as const, icon: "☀️", label: tRoutines("daytime") },
            { key: "evening" as const, icon: "🌙", label: tRoutines("evening") },
          ]).map((slot) => (
            <button key={slot.key} type="button" onClick={() => setTimeSlot(slot.key)} className="flex-1 py-2 text-xs font-semibold rounded-lg cursor-pointer flex items-center justify-center gap-1.5" style={{ backgroundColor: timeSlot === slot.key ? "var(--color-primary)" : "rgba(255,255,255,0.06)", color: timeSlot === slot.key ? "#fff" : "var(--color-text-muted)" }}>
              <span>{slot.icon}</span> {slot.label}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div>
        <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--color-text-muted)" }}>{tRoutines("schedule")}</p>
        <div className="flex gap-1.5 mb-2">
          {(["daily", "weekdays", "custom"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSchedule(s)} className="flex-1 py-1.5 text-xs font-semibold rounded-lg cursor-pointer" style={{ backgroundColor: schedule === s ? "var(--color-primary)" : "rgba(255,255,255,0.06)", color: schedule === s ? "#fff" : "var(--color-text-muted)" }}>
              {tRoutines(`schedule${s.charAt(0).toUpperCase() + s.slice(1)}` as "scheduleDaily" | "scheduleWeekdays" | "scheduleCustom")}
            </button>
          ))}
        </div>
        {schedule === "custom" && (
          <div className="flex gap-1">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label, i) => {
              const jsDay = i === 6 ? 0 : i + 1;
              return (
                <button key={jsDay} type="button" onClick={() => setCustomDays((prev) => prev.includes(jsDay) ? prev.filter((d) => d !== jsDay) : [...prev, jsDay])} className="w-9 h-9 rounded-lg text-xs font-bold cursor-pointer" style={{ backgroundColor: customDays.includes(jsDay) ? "var(--color-primary)" : "rgba(255,255,255,0.06)", color: customDays.includes(jsDay) ? "#fff" : "var(--color-text-muted)" }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm cursor-pointer" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving || !title.trim()} className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50" style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}>
          {saving ? "..." : tRoutines("save")}
        </button>
      </div>
    </form>
  );
}

function AddRewardForm({
  familyId,
  members,
  onClose,
  onAdded,
}: {
  familyId: string;
  members: FamilyMember[];
  onClose: () => void;
  onAdded: (reward: Reward) => void;
}) {
  const tRoutines = useTranslations("routines");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("🏆");
  const [cost, setCost] = useState(50);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || cost < 1) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/families/${familyId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, icon, cost, assignedTo }),
      });
      if (res.ok) {
        const data = await res.json();
        onAdded(data.reward);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{tRoutines("addReward")}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-14 text-center text-2xl rounded-xl p-2"
          style={inputStyle}
          maxLength={2}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tRoutines("rewardTitle")}
          className="flex-1 rounded-xl px-3 py-2 text-sm"
          style={inputStyle}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>{tRoutines("rewardCost")}</label>
        <input
          type="number"
          value={cost}
          min={1}
          onChange={(e) => setCost(Number(e.target.value))}
          className="w-24 rounded-xl px-3 py-2 text-sm"
          style={inputStyle}
          required
        />
      </div>
      {members.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>{tRoutines("assignReward")}</label>
          <select
            value={assignedTo ?? ""}
            onChange={(e) => setAssignedTo(e.target.value || null)}
            className="flex-1 rounded-xl px-3 py-2 text-sm"
            style={inputStyle}
          >
            <option value="">{tRoutines("allChildren")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm cursor-pointer" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer" style={{ backgroundColor: "#f59e0b", color: "#1a1625" }}>
          {saving ? "..." : "Save"}
        </button>
      </div>
    </form>
  );
}


function EditRewardForm({
  familyId,
  members,
  reward,
  onClose,
  onUpdated,
}: {
  familyId: string;
  members: FamilyMember[];
  reward: Reward;
  onClose: () => void;
  onUpdated: (reward: Reward) => void;
}) {
  const tRoutines = useTranslations("routines");
  const [title, setTitle] = useState(reward.title);
  const [icon, setIcon] = useState(reward.icon);
  const [cost, setCost] = useState(reward.cost);
  const [assignedTo, setAssignedTo] = useState<string | null>(reward.assignedTo);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || cost < 1) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/families/${familyId}/rewards/${reward.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, icon, cost, assignedTo }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.reward);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass w-full max-w-sm mx-4 p-6"
        style={{ borderRadius: "var(--border-radius)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSave} className="space-y-3">
          <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{tRoutines("editReward")}</p>

          <div className="flex gap-2">
            <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} className="w-14 text-center text-2xl rounded-xl p-2" style={inputStyle} maxLength={2} />
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tRoutines("rewardTitle")} className="flex-1 rounded-xl px-3 py-2 text-sm" style={inputStyle} required />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>{tRoutines("rewardCost")}</label>
            <input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} min={1} className="w-20 rounded-xl px-3 py-2 text-sm" style={inputStyle} />
            <span className="text-xs" style={{ color: "#f59e0b" }}>pts</span>
          </div>

          {members.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>{tRoutines("assignReward")}</label>
              <select
                value={assignedTo ?? ""}
                onChange={(e) => setAssignedTo(e.target.value || null)}
                className="flex-1 rounded-xl px-3 py-2 text-sm"
                style={inputStyle}
              >
                <option value="">{tRoutines("allChildren")}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm cursor-pointer" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer" style={{ backgroundColor: "#f59e0b", color: "#1a1625" }}>
              {saving ? "..." : tRoutines("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
