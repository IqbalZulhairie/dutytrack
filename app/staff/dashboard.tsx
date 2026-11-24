"use client";

import { useState, useTransition } from "react";
import { signOut } from "../login/actions";
import { toggleMyDutyTask } from "./actions";
import type { CleaningTask } from "@/lib/types";

type TodayDuty = {
  id: string;
  date: string;
  taskIds: string[];
  completedTaskIds: string[];
};

type StaffDashboardProps = {
  name: string;
  email: string;
  today: string;
  todayDuty: TodayDuty | null;
  upcomingDuties: { id: string; date: string }[];
  tasks: CleaningTask[];
};

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function StaffDashboard({
  name,
  email,
  today,
  todayDuty,
  upcomingDuties,
  tasks,
}: StaffDashboardProps) {
  const [completedTaskIds, setCompletedTaskIds] = useState(todayDuty?.completedTaskIds ?? []);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const assignedTasks = todayDuty
    ? tasks.filter((task) => todayDuty.taskIds.includes(task.id))
    : [];
  const completedCount = assignedTasks.filter((task) => completedTaskIds.includes(task.id)).length;

  function toggleTask(taskId: string) {
    if (!todayDuty || isPending) return;
    setErrorMessage("");
    startTransition(async () => {
      try {
        const updatedTaskIds = await toggleMyDutyTask(todayDuty.id, taskId);
        setCompletedTaskIds(updatedTaskIds);
      } catch {
        setErrorMessage("Could not update the checklist. Refresh the page and try again.");
      }
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-[#172543] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">Duty Track</p>
            <h1 className="mt-1 text-xl font-bold">Staff dashboard</h1>
          </div>
          <form action={signOut}>
            <button type="submit" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold transition hover:bg-white/10">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">{formatDate(today)}</p>
          <h2 className="mt-2 text-2xl font-bold text-[#172543]">Hello, {name}</h2>
          <p className="mt-1 text-sm text-slate-500">{email}</p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-lime-700">Today</p>
                <h2 className="mt-1 text-lg font-bold text-[#172543]">Cleaning checklist</h2>
              </div>
              {todayDuty && (
                <span className="rounded-full bg-lime-50 px-3 py-1 text-xs font-semibold text-lime-800">
                  {completedCount} of {assignedTasks.length} complete
                </span>
              )}
            </div>

            {errorMessage && (
              <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </p>
            )}

            {!todayDuty ? (
              <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
                You do not have a cleaning duty assigned today.
              </p>
            ) : assignedTasks.length === 0 ? (
              <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
                There are no active cleaning tasks assigned to this duty.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-slate-100">
                {assignedTasks.map((task) => {
                  const done = completedTaskIds.includes(task.id);
                  return (
                    <li key={task.id}>
                      <label className="flex cursor-pointer items-start gap-3 py-4">
                        <input
                          type="checkbox"
                          checked={done}
                          disabled={isPending}
                          onChange={() => toggleTask(task.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-lime-600"
                        />
                        <span className="min-w-0">
                          <span className={`block text-sm font-semibold ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                            {task.label}
                          </span>
                          {task.description && <span className="mt-1 block text-xs text-slate-500">{task.description}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Coming up</p>
            <h2 className="mt-1 text-lg font-bold text-[#172543]">Upcoming duties</h2>
            {upcomingDuties.length === 0 ? (
              <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
                No upcoming duties assigned.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-slate-100">
                {upcomingDuties.slice(0, 7).map((duty) => (
                  <li key={duty.id} className="flex items-center justify-between gap-3 py-4">
                    <span className="text-sm font-medium text-slate-700">{formatDate(duty.date)}</span>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      Scheduled
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
