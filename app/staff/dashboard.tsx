"use client";

import { useState, useTransition } from "react";
import { signOut } from "../login/actions";
import { toggleMyDutyTask } from "./actions";
import type { CleaningTask } from "@/lib/types";

type Section = "Overview" | "Schedule";

type StaffDuty = {
  id: string;
  date: string;
  taskIds: string[];
  completedTaskIds: string[];
};

type StaffDashboardProps = {
  name: string;
  email: string;
  today: string;
  duties: StaffDuty[];
  tasks: CleaningTask[];
};

function formatDate(value: string, options: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
}) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", options);
}

function Icon({ name, size = 17 }: { name: "grid" | "calendar" | "logout" | "check" | "clock"; size?: number }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></>,
    check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function KpiCard({ label, value, note, icon, tone }: { label: string; value: number; note: string; icon: "grid" | "calendar" | "check" | "clock"; tone: "lime" | "blue" | "purple" | "amber" }) {
  const tones = {
    lime: "bg-[#f0f9e7] text-[#598331]",
    blue: "bg-[#edf4ff] text-[#4779d7]",
    purple: "bg-[#f3efff] text-[#8064cb]",
    amber: "bg-[#fff5e8] text-[#c48330]",
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-[27px] font-bold leading-none tracking-tight text-[#17233c]">{value}</p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon name={icon} size={17} />
        </span>
      </div>
      <p className="mt-3 text-[10px] text-slate-400">{note}</p>
    </div>
  );
}

export default function StaffDashboard({ name, email, today, duties, tasks }: StaffDashboardProps) {
  const [section, setSection] = useState<Section>("Overview");
  const [completedTaskIdsByDuty, setCompletedTaskIdsByDuty] = useState(
    () => Object.fromEntries(duties.map((duty) => [duty.id, duty.completedTaskIds])),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const todayDuties = duties.filter((duty) => duty.date === today);
  const upcomingDuties = duties.filter((duty) => duty.date > today);
  const assignedTasks = (duty: StaffDuty) => tasks.filter((task) => duty.taskIds.includes(task.id));
  const todayTaskCount = todayDuties.reduce((count, duty) => count + assignedTasks(duty).length, 0);
  const completedTaskCount = todayDuties.reduce(
    (count, duty) => count + assignedTasks(duty).filter((task) => (completedTaskIdsByDuty[duty.id] ?? []).includes(task.id)).length,
    0,
  );
  const pendingTaskCount = todayTaskCount - completedTaskCount;

  function toggleTask(duty: StaffDuty, taskId: string) {
    if (isPending) return;
    setErrorMessage("");
    startTransition(async () => {
      try {
        const updatedTaskIds = await toggleMyDutyTask(duty.id, taskId);
        setCompletedTaskIdsByDuty((current) => ({ ...current, [duty.id]: updatedTaskIds }));
      } catch {
        setErrorMessage("Could not update the checklist. Refresh the page and try again.");
      }
    });
  }

  const navigation: { label: Section; icon: "grid" | "calendar" }[] = [
    { label: "Overview", icon: "grid" },
    { label: "Schedule", icon: "calendar" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col bg-[#101b36] px-5 py-6 text-white lg:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b8f26b] text-sm font-black text-[#14223d]">DT</span>
          <span className="text-[17px] font-bold tracking-tight">DutyTrack<span className="text-[#b8f26b]">.</span></span>
        </div>
        <p className="mb-3 mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Workspace</p>
        <nav className="space-y-1" aria-label="Staff navigation">
          {navigation.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setSection(item.label)}
              aria-current={section === item.label ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition ${
                section === item.label ? "bg-white/10 text-[#c5f58a]" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-300 text-xs font-bold text-lime-950">
              {name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{name}</span>
              <span className="block truncate text-[10px] text-slate-400">{email}</span>
            </span>
          </div>
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-200">
              <Icon name="logout" size={16} />
              Sign out
            </button>
          </form>
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
            <span className="hidden text-xs font-medium text-slate-500 md:block">{formatDate(today)}</span>
            <form action={signOut} className="lg:hidden">
              <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-slate-200 bg-white px-2 py-2 lg:hidden" aria-label="Mobile staff navigation">
          {navigation.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setSection(item.label)}
              aria-current={section === item.label ? "page" : undefined}
              className={`flex flex-col items-center gap-1 px-5 py-1 text-[9px] font-medium ${
                section === item.label ? "text-indigo-700" : "text-slate-400"
              }`}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 pt-7 sm:px-8 lg:px-10 lg:pb-10 lg:pt-9">
          {section === "Overview" ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Upcoming Duties" value={upcomingDuties.length} note="Scheduled after today" icon="calendar" tone="blue" />
                <KpiCard label="Total Duties" value={duties.length} note="Today and upcoming assigned duties" icon="grid" tone="purple" />
                <KpiCard label="Completed Tasks" value={completedTaskCount} note="Completed on today’s duties" icon="check" tone="lime" />
                <KpiCard label="Pending Task" value={pendingTaskCount} note="Remaining on today’s duties" icon="clock" tone="amber" />
              </section>

              <section className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_.9fr]">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-[#17233c]">Today’s cleaning checklist</h2>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(today)}</p>
                    </div>
                    {todayDuties.length > 0 && (
                      <span className="rounded-full bg-lime-50 px-3 py-1 text-xs font-semibold text-lime-800">
                        {completedTaskCount} of {todayTaskCount} complete
                      </span>
                    )}
                  </div>

                  {errorMessage && (
                    <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {errorMessage}
                    </p>
                  )}

                  {todayDuties.length === 0 ? (
                    <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">You do not have a cleaning duty assigned today.</p>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {todayDuties.map((duty, dutyIndex) => {
                        const dutyTasks = assignedTasks(duty);
                        const completedTaskIds = completedTaskIdsByDuty[duty.id] ?? [];
                        const dutyCompletedCount = dutyTasks.filter((task) => completedTaskIds.includes(task.id)).length;

                        return (
                          <div key={duty.id} className="rounded-xl border border-slate-100 px-4">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3">
                              <h3 className="text-sm font-semibold text-slate-800">Duty {dutyIndex + 1}</h3>
                              <span className="text-xs font-medium text-slate-500">{dutyCompletedCount} of {dutyTasks.length} complete</span>
                            </div>
                            {dutyTasks.length === 0 ? (
                              <p className="py-4 text-sm text-slate-600">There are no active cleaning tasks assigned to this duty.</p>
                            ) : (
                              <ul className="divide-y divide-slate-100">
                                {dutyTasks.map((task) => {
                                  const done = completedTaskIds.includes(task.id);
                                  return (
                                    <li key={task.id}>
                                      <label className="flex cursor-pointer items-start gap-3 py-4">
                                        <input
                                          type="checkbox"
                                          checked={done}
                                          disabled={isPending}
                                          onChange={() => toggleTask(duty, task.id)}
                                          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-lime-600"
                                        />
                                        <span className="min-w-0">
                                          <span className={`block text-sm font-semibold ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>{task.label}</span>
                                          {task.description && <span className="mt-1 block text-xs text-slate-500">{task.description}</span>}
                                        </span>
                                      </label>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-[#17233c]">Coming up</h2>
                      <p className="mt-1 text-xs text-slate-500">Your next assigned duties</p>
                    </div>
                    <button type="button" onClick={() => setSection("Schedule")} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                      See schedule
                    </button>
                  </div>
                  {upcomingDuties.length === 0 ? (
                    <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No upcoming duties assigned.</p>
                  ) : (
                    <ul className="mt-4 divide-y divide-slate-100">
                      {upcomingDuties.slice(0, 5).map((duty) => (
                        <li key={duty.id} className="flex items-center justify-between gap-3 py-3">
                          <span className="text-sm font-medium text-slate-700">{formatDate(duty.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-semibold text-indigo-700">Scheduled</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-[#17233c]">Assigned duties</h2>
                  <p className="mt-1 text-xs text-slate-500">Today and upcoming cleaning schedules</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-semibold text-indigo-700">
                  {duties.length} {duties.length === 1 ? "duty" : "duties"}
                </span>
              </div>

              {duties.length === 0 ? (
                <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No duties are assigned to you yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {duties.map((duty) => {
                    const dutyTasks = assignedTasks(duty);
                    const completedTaskIds = completedTaskIdsByDuty[duty.id] ?? [];
                    const allTasksComplete = dutyTasks.length > 0 && dutyTasks.every((task) => completedTaskIds.includes(task.id));

                    return (
                      <li key={duty.id} className="py-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{formatDate(duty.date)}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {dutyTasks.filter((task) => completedTaskIds.includes(task.id)).length} of {dutyTasks.length} tasks complete
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                            allTasksComplete ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"
                          }`}>
                            {allTasksComplete ? "Completed" : "Scheduled"}
                          </span>
                        </div>
                        {dutyTasks.length > 0 ? (
                          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                            {dutyTasks.map((task) => {
                              const done = completedTaskIds.includes(task.id);
                              return (
                                <li key={task.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                                    done ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-300 ring-1 ring-slate-200"
                                  }`}>
                                    {done ? "✓" : ""}
                                  </span>
                                  <span className={done ? "text-slate-400 line-through" : "text-slate-700"}>{task.label}</span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="mt-3 text-xs text-slate-500">No active cleaning tasks are assigned to this duty.</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
