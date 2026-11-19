"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { registerUser } from "./user/actions";

type Staff = { id: string; name: string; email: string; staffId?: string; active: boolean };
type CleaningTask = { id: string; label: string };
type Duty = { id: string; date: string; staffIds: string[]; completedTaskIds: string[] };
type Store = { staff: Staff[]; duties: Duty[]; tasks: CleaningTask[] };
type Section = "Overview" | "Schedule" | "Team" | "Checklist" | "Reminders";
type DutyDraft = { id?: string; date: string; staffIds: string[] };

const STORAGE_KEY = "duty-track-workspace-v1";
const DEFAULT_TASKS: CleaningTask[] = [
  { id: "sweep", label: "Sweep and mop the floor" },
  { id: "tables", label: "Wipe tables and shared surfaces" },
  { id: "rubbish", label: "Empty bins and replace liners" },
  { id: "kitchen", label: "Tidy the kitchen and wash dishes" },
  { id: "supplies", label: "Restock cleaning supplies" },
];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function shiftMonth(date: Date, months: number) {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  return next;
}

function createSeed(today: string): Store {
  const staff: Staff[] = [
    { id: "staff-maya", name: "Maya Chen", email: "maya.chen@northstar.co", active: true },
    { id: "staff-james", name: "James Wilson", email: "james.wilson@northstar.co", active: true },
    { id: "staff-amara", name: "Amara Okafor", email: "amara.okafor@northstar.co", active: true },
    { id: "staff-noah", name: "Noah Patel", email: "noah.patel@northstar.co", active: true },
    { id: "staff-elena", name: "Elena Rossi", email: "elena.rossi@northstar.co", active: true },
  ];
  const todayDate = new Date(`${today}T12:00:00`);
  return {
    staff,
    tasks: DEFAULT_TASKS,
    duties: [
      {
        id: "duty-today",
        date: today,
        staffIds: ["staff-maya", "staff-james"],
        completedTaskIds: ["sweep"],
      },
      {
        id: "duty-tomorrow",
        date: dateKey(shiftDate(todayDate, 1)),
        staffIds: ["staff-amara", "staff-noah"],
        completedTaskIds: [],
      },
      {
        id: "duty-friday",
        date: dateKey(shiftDate(todayDate, 3)),
        staffIds: ["staff-elena", "staff-maya"],
        completedTaskIds: [],
      },
    ],
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", options);
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] ?? paths.grid}
    </svg>
  );
}

function Avatar({ name, color = "bg-indigo-100 text-indigo-700", size = "h-9 w-9" }: { name: string; color?: string; size?: string }) {
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full text-xs font-bold ${size} ${color}`}>{initials(name)}</span>;
}

export default function Dashboard() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("Overview");
  const [store, setStore] = useState<Store>(() => createSeed("2026-11-18"));
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("2026-11-18");
  const [selectedDate, setSelectedDate] = useState("2026-11-18");
  const [calendarMode, setCalendarMode] = useState<"Day" | "Week" | "Month">("Week");
  const [dutyModal, setDutyModal] = useState<DutyDraft | null>(null);
  const [staffModal, setStaffModal] = useState<Staff | "new" | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffFormMessage, setStaffFormMessage] = useState("");
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [toast, setToast] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const currentDate = dateKey(new Date());
      const saved = window.localStorage.getItem(STORAGE_KEY);
      let loadedStore: Store | null = null;
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Store;
          if (Array.isArray(parsed.staff) && Array.isArray(parsed.duties) && Array.isArray(parsed.tasks)) loadedStore = parsed;
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setStore(loadedStore ?? createSeed(currentDate));
      setToday(currentDate);
      setSelectedDate(currentDate);
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [ready, store]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setStaffFormMessage("");
  }, [staffModal]);

  const todayDuty = store.duties.find((duty) => duty.date === today);
  const activeStaff = store.staff.filter((person) => person.active);
  const upcoming = useMemo(
    () => store.duties.filter((duty) => duty.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    [store.duties, today],
  );
  const completedDutyCount = store.duties.filter((duty) => store.tasks.length > 0 && duty.completedTaskIds.length === store.tasks.length).length;
  const pendingDutyCount = store.duties.length - completedDutyCount;

  async function handleLogout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        setToast(error.message);
        setIsLoggingOut(false);
        return;
      }

      setIsLoggingOut(false);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to log out.");
      setIsLoggingOut(false);
    }
  }

  function updateDuty(id: string, update: (duty: Duty) => Duty) {
    setStore((current) => ({ ...current, duties: current.duties.map((duty) => duty.id === id ? update(duty) : duty) }));
  }

  function toggleTask(duty: Duty, taskId: string) {
    updateDuty(duty.id, (current) => ({
      ...current,
      completedTaskIds: current.completedTaskIds.includes(taskId)
        ? current.completedTaskIds.filter((id) => id !== taskId)
        : [...current.completedTaskIds, taskId],
    }));
  }

  function saveDuty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dutyModal) return;
    if (dutyModal.staffIds.length < 2) {
      setToast("Select at least two active staff members.");
      return;
    }
    setStore((current) => {
      const existing = current.duties.find((duty) => duty.date === dutyModal.date);
      if (existing && existing.id !== dutyModal.id) {
        const movedDuty = current.duties.find((duty) => duty.id === dutyModal.id);
        return {
          ...current,
          duties: current.duties
            .filter((duty) => duty.id !== dutyModal.id)
            .map((duty) => duty.id === existing.id
              ? {
                  ...duty,
                  staffIds: [...new Set([...duty.staffIds, ...dutyModal.staffIds])],
                  completedTaskIds: [...new Set([...duty.completedTaskIds, ...(movedDuty?.completedTaskIds ?? [])])],
                }
              : duty),
        };
      }
      if (dutyModal.id) {
        return { ...current, duties: current.duties.map((duty) => duty.id === dutyModal.id ? { ...duty, date: dutyModal.date, staffIds: dutyModal.staffIds } : duty) };
      }
      return { ...current, duties: [...current.duties, { id: crypto.randomUUID(), date: dutyModal.date, staffIds: dutyModal.staffIds, completedTaskIds: [] }] };
    });
    setSelectedDate(dutyModal.date);
    setDutyModal(null);
    setToast("Cleaning duty saved.");
  }

  function deleteDuty(duty: Duty) {
    setStore((current) => ({ ...current, duties: current.duties.filter((item) => item.id !== duty.id) }));
    setToast("Cleaning duty removed.");
  }

  async function saveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("fullName") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    if (!name || !email) return;
    if (staffModal === "new") {
      setIsSavingStaff(true);
      try {
        const result = await registerUser({ status: "idle", message: "" }, data);
        const createdUser = result.createdUser;
        if (result.status !== "success" || !createdUser) {
          setStaffFormMessage(result.message || "Unable to register the staff account.");
          return;
        }
        setStore((current) => ({
          ...current,
          staff: [...current.staff, {
            id: createdUser.id,
            name: createdUser.fullName,
            email: createdUser.email,
            staffId: createdUser.staffId,
            active: true,
          }],
        }));
        setToast(result.message);
        setStaffModal(null);
      } catch (error) {
        setStaffFormMessage(error instanceof Error ? error.message : "Unable to register the staff account.");
      } finally {
        setIsSavingStaff(false);
      }
      return;
    }
    if (staffModal) {
      setStore((current) => ({ ...current, staff: current.staff.map((person) => person.id === staffModal.id ? { ...person, name, email } : person) }));
      setToast("Staff details updated.");
      setStaffModal(null);
    }
  }

  function toggleStaff(person: Staff) {
    const active = !person.active;
    setStore((current) => ({
      ...current,
      staff: current.staff.map((item) => item.id === person.id ? { ...item, active } : item),
      duties: active ? current.duties : current.duties.flatMap((duty) => {
        if (duty.date < today) return [duty];
        const staffIds = duty.staffIds.filter((id) => id !== person.id);
        return staffIds.length >= 2 ? [{ ...duty, staffIds }] : [];
      }),
    }));
    setToast(active ? `${person.name} reactivated.` : `${person.name} deactivated. Future duties with fewer than two staff were removed.`);
  }

  const selectedDuty = store.duties.find((duty) => duty.date === selectedDate);
  const selectedStaff = selectedDuty?.staffIds
    .map((id) => store.staff.find((person) => person.id === id))
    .filter((person): person is Staff => Boolean(person));
  const pageTitle: Record<Section, string> = {
    Overview: "Good morning, Alex",
    Schedule: "Cleaning schedule",
    Team: "Your team",
    Checklist: "Cleaning checklist",
    Reminders: "Email reminders",
  };

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col bg-[#101b36] px-5 py-6 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3 px-2" aria-label="Duty Track home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b8f26b] text-sm font-black text-[#14223d]">DT</span>
          <span className="text-[17px] font-bold tracking-tight">dutytrack<span className="text-[#b8f26b]">.</span></span>
        </Link>
        <p className="mb-3 mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Workspace</p>
        <nav className="space-y-1" aria-label="Main navigation">
          {(["Overview", "Schedule", "Team", "Checklist", "Reminders"] as Section[]).map((item) => {
            const icon = item === "Overview" ? "grid" : item === "Schedule" ? "calendar" : item === "Team" ? "users" : item === "Checklist" ? "check" : "mail";
            return (
              <button key={item} onClick={() => setSection(item)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition ${section === item ? "bg-white/10 text-[#c5f58a]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                <Icon name={icon} size={17} />{item}
                {item === "Reminders" && <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Setup</span>}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <Avatar name="Alex Morgan" color="bg-violet-300 text-violet-900" size="h-9 w-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">Alex Morgan</span>
              <span className="block truncate text-[10px] text-slate-400">Workspace admin</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Log out"
          >
            <Icon name={isLoggingOut ? "clock" : "logout"} size={16} />
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101b36] text-xs font-black text-[#b8f26b] lg:hidden">DT</span>
            <div className="hidden text-xs text-slate-400 sm:block">Workspace <span className="mx-2 text-slate-300">/</span><span className="font-medium text-slate-600">{section}</span></div>
            <span className="text-sm font-bold text-slate-900 sm:hidden">{section}</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="hidden text-xs font-medium text-slate-500 md:block">{formatDate(today, { weekday: "long", month: "long", day: "numeric" })}</span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 lg:hidden"
              aria-label="Log out"
            >
              <Icon name={isLoggingOut ? "clock" : "logout"} size={17} />
            </button>
            <button onClick={() => setSection("Reminders")} className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="View reminders"><Icon name="bell" size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-400" /></button>
            <button onClick={() => { setSection("Schedule"); setDutyModal({ date: selectedDate, staffIds: [] }); }} className="inline-flex items-center gap-2 rounded-xl bg-[#b8f26b] px-3.5 py-2.5 text-xs font-bold text-[#1b2b42] shadow-sm transition hover:bg-[#a8e95a] sm:px-4"><Icon name="plus" size={15} /><span className="hidden sm:inline">New duty</span><span className="sm:hidden">Add</span></button>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-72px)]">
          <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-slate-200 bg-white px-2 py-2 lg:hidden" aria-label="Mobile navigation">
            {(["Overview", "Schedule", "Team", "Checklist", "Reminders"] as Section[]).map((item) => (
              <button key={item} onClick={() => setSection(item)} aria-label={item} className={`flex flex-col items-center gap-1 px-2 py-1 text-[9px] font-medium ${section === item ? "text-indigo-700" : "text-slate-400"}`}>
                <Icon name={item === "Overview" ? "grid" : item === "Schedule" ? "calendar" : item === "Team" ? "users" : item === "Checklist" ? "check" : "mail"} size={18} />{item}
              </button>
            ))}
          </nav>
          <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 pt-7 sm:px-8 lg:px-10 lg:pb-10 lg:pt-9">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-indigo-600">{section === "Overview" ? formatDate(today, { weekday: "long", month: "long", day: "numeric" }) : "Workspace management"}</p>
                <h1 className="mt-1.5 text-[26px] font-bold tracking-tight text-[#17233c] sm:text-[30px]">{pageTitle[section]}</h1>
                <p className="mt-1 text-sm text-slate-500">{section === "Overview" ? "Here’s what’s happening with your office duties today." : section === "Schedule" ? "Plan and manage your team’s cleaning duties." : section === "Team" ? "Manage the people who keep your workplace fresh." : section === "Checklist" ? "Stay on top of today’s shared cleaning tasks." : "Keep your team informed before every duty."}</p>
              </div>
              {section === "Team" && <button onClick={() => setStaffModal("new")} className="inline-flex items-center gap-2 rounded-xl bg-[#172543] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#24375d]"><Icon name="plus" size={15} />Add staff member</button>}
              {section === "Schedule" && <button onClick={() => setDutyModal({ date: selectedDate, staffIds: [] })} className="inline-flex items-center gap-2 rounded-xl bg-[#172543] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#24375d]"><Icon name="plus" size={15} />Assign a duty</button>}
            </div>

            {section === "Overview" && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Assigned today" value={todayDuty?.staffIds.length ?? 0} note="Team members on duty" icon="users" tone="lime" />
                  <StatCard label="Upcoming duties" value={upcoming.length} note="Scheduled from today" icon="calendar" tone="blue" />
                  <StatCard label="Duties completed" value={completedDutyCount} note="All checklist tasks finished" icon="check" tone="purple" />
                  <StatCard label="Duties pending" value={pendingDutyCount} note="Scheduled duties in progress" icon="clock" tone="amber" />
                </section>
                <section className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_.9fr]">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h2 className="text-base font-bold text-[#17233c]">Today’s cleaning team</h2><p className="mt-1 text-xs text-slate-500">{formatDate(today, { weekday: "long", month: "long", day: "numeric" })}</p></div>
                      <button onClick={() => { setSection("Checklist"); setSelectedDate(today); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Open checklist <span aria-hidden="true">→</span></button>
                    </div>
                    {todayDuty ? (
                      <>
                        <div className="mt-5 flex flex-wrap gap-3">
                          {todayDuty.staffIds.map((id) => store.staff.find((person) => person.id === id)).filter((person): person is Staff => Boolean(person)).map((person, index) => (
                            <div key={person.id} className="flex min-w-[190px] flex-1 items-center gap-3 rounded-xl bg-[#f7f8fc] p-3">
                              <Avatar name={person.name} color={["bg-indigo-100 text-indigo-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"][index % 3]} />
                              <div className="min-w-0"><p className="truncate text-sm font-semibold">{person.name}</p><p className="truncate text-[11px] text-slate-500">{person.email}</p></div>
                              <span className="ml-auto rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-emerald-700">Assigned</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 border-t border-slate-100 pt-4">
                          <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-slate-700">Today’s task progress</p><p className="text-[11px] font-semibold text-slate-500">{todayDuty.completedTaskIds.length} of {store.tasks.length} complete</p></div>
                          <ProgressBar value={todayDuty.completedTaskIds.length} total={store.tasks.length} />
                        </div>
                      </>
                    ) : <EmptyState title="No team assigned yet" text="Add at least two staff members to today’s cleaning duty." action="Assign today’s duty" onClick={() => { setSection("Schedule"); setDutyModal({ date: today, staffIds: [] }); }} />}
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between"><div><h2 className="text-base font-bold text-[#17233c]">Coming up</h2><p className="mt-1 text-xs text-slate-500">Your next cleaning duties</p></div><button onClick={() => setSection("Schedule")} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">See schedule</button></div>
                    <div className="mt-4 space-y-3">
                      {upcoming.slice(0, 4).map((duty, index) => <UpcomingDuty key={duty.id} duty={duty} staff={store.staff} index={index} onClick={() => { setSelectedDate(duty.date); setSection("Checklist"); }} />)}
                      {!upcoming.length && <p className="py-8 text-center text-xs text-slate-400">No upcoming duties scheduled.</p>}
                    </div>
                  </div>
                </section>
                <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_.85fr]">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between"><div><h2 className="text-base font-bold text-[#17233c]">Cleaning checklist</h2><p className="mt-1 text-xs text-slate-500">Tasks for today’s duty</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-semibold text-indigo-700">{store.tasks.length} tasks</span></div>
                    {todayDuty ? <div className="mt-4 space-y-1">{store.tasks.slice(0, 4).map((task) => <TaskRow key={task.id} task={task} done={todayDuty.completedTaskIds.includes(task.id)} onToggle={() => toggleTask(todayDuty, task.id)} />)}</div> : <p className="mt-5 text-sm text-slate-400">Assign a team to see their checklist.</p>}
                    <button onClick={() => setSection("Checklist")} className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700">View all cleaning tasks</button>
                  </div>
                  <div className="rounded-2xl border border-[#dfe8ff] bg-[#f1f5ff] p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm"><Icon name="mail" size={17} /></span>
                      <div><p className="text-sm font-bold text-[#17233c]">Duty day reminders</p><p className="mt-1 text-xs leading-5 text-slate-600">Email reminders are planned for 8:00 AM on each duty day. Connect an email provider to enable delivery.</p></div>
                    </div>
                    <button onClick={() => setSection("Reminders")} className="mt-4 text-xs font-bold text-indigo-700 hover:text-indigo-900">Configure reminders <span aria-hidden="true">→</span></button>
                  </div>
                </section>
              </>
            )}

            {section === "Schedule" && (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedDate(dateKey(calendarMode === "Month" ? shiftMonth(new Date(`${selectedDate}T12:00:00`), -1) : shiftDate(new Date(`${selectedDate}T12:00:00`), calendarMode === "Day" ? -1 : -7)))} aria-label="Previous period" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Icon name="left" size={16} /></button>
                    <h2 className="min-w-[155px] text-sm font-bold text-slate-800">{calendarMode === "Month" ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : calendarMode === "Week" ? `Week of ${formatDate(dateKey(shiftDate(new Date(`${selectedDate}T12:00:00`), -new Date(`${selectedDate}T12:00:00`).getDay() + 1)), { month: "short", day: "numeric" })}` : formatDate(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</h2>
                    <button onClick={() => setSelectedDate(dateKey(calendarMode === "Month" ? shiftMonth(new Date(`${selectedDate}T12:00:00`), 1) : shiftDate(new Date(`${selectedDate}T12:00:00`), calendarMode === "Day" ? 1 : 7)))} aria-label="Next period" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Icon name="right" size={16} /></button>
                    <button onClick={() => setSelectedDate(today)} className="ml-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Today</button>
                  </div>
                  <div className="flex rounded-lg bg-slate-100 p-1">{(["Day", "Week", "Month"] as const).map((mode) => <button key={mode} onClick={() => setCalendarMode(mode)} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${calendarMode === mode ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{mode}</button>)}</div>
                </div>
                <CalendarView mode={calendarMode} selectedDate={selectedDate} today={today} duties={store.duties} staff={store.staff} onSelect={(date) => { setSelectedDate(date); if (store.duties.some((duty) => duty.date === date)) setSection("Checklist"); }} onAdd={(date) => setDutyModal({ date, staffIds: [] })} onEdit={(duty) => setDutyModal({ id: duty.id, date: duty.date, staffIds: duty.staffIds })} />
              </section>
            )}

            {section === "Team" && (
              <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div><h2 className="text-sm font-bold text-[#17233c]">Staff members <span className="ml-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-500">{activeStaff.length} active</span></h2><p className="mt-1 text-xs text-slate-500">Add and manage your cleaning team.</p></div>
                  <label className="relative block"><span className="sr-only">Search staff</span><span className="pointer-events-none absolute left-3 top-2.5 text-slate-400"><Icon name="search" size={15} /></span><input value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} placeholder="Search staff..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-300 sm:w-56" /></label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left">
                    <thead><tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400"><th className="px-6 py-3">Team member</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Upcoming duties</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
                    <tbody>{store.staff.filter((person) => `${person.name} ${person.email}`.toLowerCase().includes(staffSearch.toLowerCase())).map((person, index) => {
                      const count = store.duties.filter((duty) => duty.date >= today && duty.staffIds.includes(person.id)).length;
                      return <tr key={person.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-6 py-4"><div className="flex items-center gap-3"><Avatar name={person.name} color={["bg-indigo-100 text-indigo-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-sky-100 text-sky-700"][index % 5]} /><div><p className={`text-xs font-semibold ${person.active ? "text-slate-800" : "text-slate-400"}`}>{person.name}</p><p className="mt-1 text-[11px] text-slate-500">{person.email}</p></div></div></td>
                        <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${person.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${person.active ? "bg-emerald-500" : "bg-slate-400"}`} />{person.active ? "Active" : "Inactive"}</span></td>
                        <td className="px-4 py-4 text-xs text-slate-600">{count} {count === 1 ? "duty" : "duties"}</td>
                        <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => setStaffModal(person)} aria-label={`Edit ${person.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-700"><Icon name="edit" size={15} /></button><button onClick={() => toggleStaff(person)} className={`rounded-lg px-2.5 py-2 text-[10px] font-semibold ${person.active ? "text-slate-500 hover:bg-rose-50 hover:text-rose-600" : "text-emerald-700 hover:bg-emerald-50"}`}>{person.active ? "Deactivate" : "Reactivate"}</button></div></td>
                      </tr>;
                    })}</tbody>
                  </table>
                  {!store.staff.length && <EmptyState title="No staff members yet" text="Add your first team member to get started." action="Add staff member" onClick={() => setStaffModal("new")} />}
                </div>
              </section>
            )}

            {section === "Checklist" && (
              <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-base font-bold text-[#17233c]">Duty tasks</h2><p className="mt-1 text-xs text-slate-500">Mark each task complete as you go.</p></div>
                    <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-300" />
                  </div>
                  {selectedDuty ? <>
                    <div className="mt-5 rounded-xl bg-[#f7f8fc] p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned team</p><div className="mt-3 flex flex-wrap gap-2">{selectedStaff?.map((person) => <span key={person.id} className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[11px] font-semibold text-slate-700"><Avatar name={person.name} size="h-6 w-6" />{person.name}</span>)}</div></div>
                    <div className="mt-5 space-y-2">{store.tasks.map((task) => <TaskRow key={task.id} task={task} done={selectedDuty.completedTaskIds.includes(task.id)} onToggle={() => toggleTask(selectedDuty, task.id)} large />)}</div>
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs font-semibold text-slate-500">{selectedDuty.completedTaskIds.length} of {store.tasks.length} tasks completed</span><span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${selectedDuty.completedTaskIds.length === store.tasks.length ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{selectedDuty.completedTaskIds.length === store.tasks.length ? "Duty complete" : "In progress"}</span></div>
                  </> : <EmptyState title="No cleaning duty for this date" text="Choose another date or assign a team to get started." action="Assign a duty" onClick={() => setDutyModal({ date: selectedDate, staffIds: [] })} />}
                </section>
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-base font-bold text-[#17233c]">Checklist guide</h2><p className="mt-1 text-xs leading-5 text-slate-500">A few shared tasks keep the office ready for everyone.</p>
                  <div className="mt-5 space-y-3">{store.tasks.map((task, index) => <div key={task.id} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[10px] font-bold text-indigo-700">{String(index + 1).padStart(2, "0")}</span><p className="pt-1 text-xs leading-5 text-slate-600">{task.label}</p></div>)}</div>
                  <div className="mt-6 rounded-xl bg-[#f0f9e7] p-4"><p className="text-xs font-bold text-[#345322]">Teamwork makes it easier</p><p className="mt-1 text-[11px] leading-5 text-[#57734a]">Work through the checklist together and tick off each task when it’s done.</p></div>
                </section>
              </div>
            )}

            {section === "Reminders" && (
              <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Icon name="mail" size={20} /></span><div><h2 className="text-base font-bold text-[#17233c]">Duty day email reminders</h2><p className="mt-1 text-xs leading-5 text-slate-500">Send each assigned team member a reminder on the day of their cleaning duty.</p></div></div>
                  <div className="mt-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><div className="flex items-center gap-2.5"><span className="h-2 w-2 rounded-full bg-amber-500" /><div><p className="text-xs font-bold text-amber-900">Email delivery not connected</p><p className="mt-0.5 text-[10px] text-amber-800">An email provider and server-side scheduler are needed to send reminders.</p></div></div><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-amber-800">Setup needed</span></div>
                  <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between px-4 py-3.5"><div><p className="text-xs font-semibold text-slate-700">Send time</p><p className="mt-1 text-[10px] text-slate-500">On each assigned duty day</p></div><span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><Icon name="clock" size={14} />8:00 AM</span></div>
                    <div className="flex items-center justify-between px-4 py-3.5"><div><p className="text-xs font-semibold text-slate-700">Duplicate protection</p><p className="mt-1 text-[10px] text-slate-500">One reminder per person, per duty date</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-semibold text-slate-600">Planned</span></div>
                    <div className="flex items-center justify-between px-4 py-3.5"><div><p className="text-xs font-semibold text-slate-700">Reminder includes</p><p className="mt-1 text-[10px] text-slate-500">Duty date, assigned team, and cleaning tasks</p></div><span className="text-[10px] font-semibold text-slate-500">{store.tasks.length} tasks</span></div>
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-base font-bold text-[#17233c]">Reminder preview</h2><p className="mt-1 text-xs text-slate-500">A preview of the email assigned staff will receive.</p>
                  {todayDuty ? <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 bg-[#172543] px-4 py-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#b8f26b] text-[9px] font-black text-[#172543]">DT</span><span className="text-xs font-semibold text-white">Your cleaning duty is today</span></div>
                    <div className="p-4"><p className="text-[10px] text-slate-400">To: {todayDuty.staffIds.map((id) => store.staff.find((person) => person.id === id)?.email).filter(Boolean).join(", ")}</p><p className="mt-4 text-xs font-bold text-slate-800">Hi team,</p><p className="mt-2 text-xs leading-5 text-slate-600">You’re scheduled for the office cleaning duty today, {formatDate(today, { weekday: "long", month: "long", day: "numeric" })}.</p><p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Today’s cleaning tasks</p><ul className="mt-2 space-y-2">{store.tasks.map((task) => <li key={task.id} className="flex items-center gap-2 text-[11px] text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />{task.label}</li>)}</ul><p className="mt-4 text-xs text-slate-600">Thanks for keeping our office fresh!</p></div>
                  </div> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Assign a team to today’s duty to preview a reminder.</p>}
                </section>
              </div>
            )}
          </main>
        </div>
      </div>

      {dutyModal && <Modal title={dutyModal.id ? "Edit cleaning duty" : "Assign a cleaning duty"} onClose={() => setDutyModal(null)}>
        <form onSubmit={saveDuty} className="space-y-5">
          <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">Duty date</span><input type="date" required value={dutyModal.date} onChange={(event) => setDutyModal({ ...dutyModal, date: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
          <fieldset><legend className="mb-2 text-xs font-semibold text-slate-700">Assign staff <span className="font-normal text-slate-400">(select at least 2)</span></legend><div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">{activeStaff.map((person) => <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-slate-50"><input type="checkbox" checked={dutyModal.staffIds.includes(person.id)} onChange={(event) => setDutyModal({ ...dutyModal, staffIds: event.target.checked ? [...dutyModal.staffIds, person.id] : dutyModal.staffIds.filter((id) => id !== person.id) })} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" /><Avatar name={person.name} size="h-8 w-8" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800">{person.name}</span><span className="block truncate text-[10px] text-slate-500">{person.email}</span></span></label>)}{!activeStaff.length && <p className="p-4 text-xs text-slate-500">Add active team members before creating a duty.</p>}</div><p className="mt-2 text-[10px] text-slate-500">{dutyModal.staffIds.length} selected</p></fieldset>
          <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
            {dutyModal.id ? <button type="button" onClick={() => { const duty = store.duties.find((item) => item.id === dutyModal.id); if (duty) deleteDuty(duty); setDutyModal(null); }} className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"><Icon name="trash" size={14} />Remove duty</button> : <span />}
            <div className="flex gap-2"><button type="button" onClick={() => setDutyModal(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" className="rounded-xl bg-[#172543] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#24375d]">{dutyModal.id ? "Save changes" : "Assign duty"}</button></div>
          </div>
        </form>
      </Modal>}

      {staffModal && <Modal title={staffModal === "new" ? "Add staff member" : "Edit staff member"} onClose={() => setStaffModal(null)}>
        <form key={staffModal === "new" ? "new" : staffModal.id} onSubmit={saveStaff} className="space-y-4">
          <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">Full name</span><input name="fullName" required maxLength={120} autoComplete="name" defaultValue={staffModal === "new" ? "" : staffModal.name} placeholder="e.g. Alex Morgan" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
          {staffModal === "new" && <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">Staff ID</span><input name="staffId" required maxLength={50} placeholder="e.g. S001" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>}
          <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">Email</span><input name="email" required type="email" autoComplete="email" defaultValue={staffModal === "new" ? "" : staffModal.email} placeholder="alex@company.com" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
          {staffModal === "new" && <>
            <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">Password</span><input name="password" required type="password" minLength={8} autoComplete="new-password" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
            <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-700">Confirm password</span><input name="confirmPassword" required type="password" minLength={8} autoComplete="new-password" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
          </>}
          {staffFormMessage && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-xs text-rose-700">{staffFormMessage}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={isSavingStaff} onClick={() => setStaffModal(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button><button type="submit" disabled={isSavingStaff} className="rounded-xl bg-[#172543] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#24375d] disabled:cursor-not-allowed disabled:opacity-60">{isSavingStaff ? "Creating account..." : staffModal === "new" ? "Create staff account" : "Save changes"}</button></div>
        </form>
      </Modal>}
      {toast && <div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#172543] px-4 py-3 text-xs font-semibold text-white shadow-xl lg:bottom-6">{toast}</div>}
    </div>
  );
}

function StatCard({ label, value, note, icon, tone }: { label: string; value: number; note: string; icon: string; tone: string }) {
  const tones: Record<string, string> = { lime: "bg-[#f0f9e7] text-[#598331]", blue: "bg-[#edf4ff] text-[#4779d7]", purple: "bg-[#f3efff] text-[#8064cb]", amber: "bg-[#fff5e8] text-[#c48330]" };
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-2 text-[27px] font-bold leading-none tracking-tight text-[#17233c]">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon name={icon} size={17} /></span></div><p className="mt-3 text-[10px] text-slate-400">{note}</p></div>;
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#9fe451] transition-all" style={{ width: `${percent}%` }} /></div>;
}

function UpcomingDuty({ duty, staff, index, onClick }: { duty: Duty; staff: Staff[]; index: number; onClick: () => void }) {
  const assigned = duty.staffIds.map((id) => staff.find((person) => person.id === id)).filter((person): person is Staff => Boolean(person));
  const colors = ["bg-indigo-100 text-indigo-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700"];
  return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-slate-50"><span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[#f4f6fb]"><span className="text-[9px] font-bold uppercase text-slate-400">{formatDate(duty.date, { month: "short" })}</span><span className="text-sm font-bold leading-4 text-[#17233c]">{new Date(`${duty.date}T12:00:00`).getDate()}</span></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800">{formatDate(duty.date, { weekday: "long" })}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{assigned.map((person) => person.name.split(" ")[0]).join(" & ") || "No team assigned"}</span></span><span className="flex -space-x-2">{assigned.slice(0, 3).map((person, i) => <Avatar key={person.id} name={person.name} color={colors[(index + i) % colors.length]} size="h-7 w-7" />)}</span><Icon name="chevron" size={15} /></button>;
}

function TaskRow({ task, done, onToggle, large = false }: { task: CleaningTask; done: boolean; onToggle: () => void; large?: boolean }) {
  return <label className={`flex cursor-pointer items-center gap-3 rounded-xl transition ${large ? "border border-slate-100 px-4 py-3.5 hover:bg-slate-50" : "px-2 py-2.5 hover:bg-slate-50"}`}><input type="checkbox" checked={done} onChange={onToggle} className="h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600" /><span className={`flex-1 text-xs ${done ? "text-slate-400 line-through" : "font-medium text-slate-700"}`}>{task.label}</span>{done && <span className="text-[9px] font-semibold text-emerald-600">Done</span>}</label>;
}

function EmptyState({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) {
  return <div className="py-10 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Icon name="calendar" size={18} /></span><p className="mt-3 text-sm font-semibold text-slate-700">{title}</p><p className="mt-1 text-xs text-slate-500">{text}</p><button onClick={onClick} className="mt-4 rounded-lg bg-[#172543] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#24375d]">{action}</button></div>;
}

function CalendarView({ mode, selectedDate, today, duties, staff, onSelect, onAdd, onEdit }: { mode: "Day" | "Week" | "Month"; selectedDate: string; today: string; duties: Duty[]; staff: Staff[]; onSelect: (date: string) => void; onAdd: (date: string) => void; onEdit: (duty: Duty) => void }) {
  const selected = new Date(`${selectedDate}T12:00:00`);
  const start = new Date(selected);
  if (mode === "Week") start.setDate(selected.getDate() - selected.getDay() + 1);
  if (mode === "Month") { start.setDate(1); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); }
  const count = mode === "Day" ? 1 : mode === "Week" ? 7 : 42;
  const dates = Array.from({ length: count }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return dateKey(date);
  });
  if (mode === "Day") {
    const duty = duties.find((item) => item.date === selectedDate);
    const assigned = duty?.staffIds.map((id) => staff.find((person) => person.id === id)).filter((person): person is Staff => Boolean(person)) ?? [];
    return <div><div className="mb-5 rounded-xl bg-[#f7f8fc] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected day</p><p className="mt-1 text-lg font-bold text-[#17233c]">{formatDate(selectedDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p></div>{duty ? <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">Office cleaning duty</p><p className="mt-1 text-xs text-slate-500">{assigned.length} team members assigned</p></div><button onClick={() => onEdit(duty)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:text-indigo-700"><Icon name="edit" size={13} />Edit assignment</button></div><div className="mt-4 flex flex-wrap gap-2">{assigned.map((person) => <span key={person.id} className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[11px] font-semibold text-slate-700"><Avatar name={person.name} size="h-6 w-6" />{person.name}</span>)}</div></div> : <EmptyState title="Nothing scheduled" text="Assign at least two active staff members to this date." action="Assign cleaning team" onClick={() => onAdd(selectedDate)} />}</div>;
  }
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return <div className={mode === "Month" ? "grid grid-cols-7 border-l border-t border-slate-100" : "grid grid-cols-1 gap-2 md:grid-cols-7"}>
    {mode === "Month" && weekDays.map((day) => <div key={day} className="border-b border-r border-slate-100 px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-400">{day}</div>)}
    {dates.map((date) => {
      const duty = duties.find((item) => item.date === date);
      const isOutside = mode === "Month" && new Date(`${date}T12:00:00`).getMonth() !== selected.getMonth();
      const assigned = duty?.staffIds.map((id) => staff.find((person) => person.id === id)).filter((person): person is Staff => Boolean(person)) ?? [];
      return <div key={date} className={`${mode === "Month" ? "min-h-[112px] border-b border-r border-slate-100 p-2" : "min-h-[190px] rounded-xl border border-slate-100 p-3"} ${isOutside ? "bg-slate-50/70" : "bg-white"} ${date === selectedDate ? "ring-2 ring-inset ring-indigo-300" : ""} ${mode === "Week" ? "hover:border-indigo-200 hover:bg-indigo-50/30" : ""}`}>
        <div className="flex items-center justify-between"><button onClick={(event) => { event.stopPropagation(); onSelect(date); }} className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${date === today ? "bg-[#172543] text-white" : isOutside ? "text-slate-300" : "text-slate-600"}`}>{new Date(`${date}T12:00:00`).getDate()}</button>{mode === "Week" && <button onClick={(event) => { event.stopPropagation(); onAdd(date); }} aria-label={`Add duty on ${date}`} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-indigo-100 hover:text-indigo-700"><Icon name="plus" size={14} /></button>}</div>
        {duty ? <button onClick={(event) => { event.stopPropagation(); onEdit(duty); }} className={`mt-2 w-full rounded-lg bg-[#eff5e7] p-2 text-left hover:bg-[#e6f1d8] ${mode === "Month" ? "p-1.5" : ""}`}><span className="block text-[9px] font-bold text-[#527337]">Cleaning crew</span><span className="mt-1 block truncate text-[10px] font-semibold text-slate-700">{assigned.map((person) => person.name.split(" ")[0]).join(", ")}</span>{mode === "Week" && <span className="mt-1 block text-[9px] text-slate-500">{duty.completedTaskIds.length}/{DEFAULT_TASKS.length} tasks done</span>}</button> : mode === "Week" && <button onClick={(event) => { event.stopPropagation(); onAdd(date); }} className="mt-3 text-[10px] text-slate-300 hover:text-indigo-600">+ Add duty</button>}
      </div>;
    })}
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101b36]/45 px-4 py-6 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 id="modal-title" className="text-base font-bold text-[#17233c]">{title}</h2><button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Icon name="close" size={17} /></button></div>{children}</section></div>;
}
