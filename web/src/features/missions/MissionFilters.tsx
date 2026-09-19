import { useState } from 'react';
import {
  MISSION_STATUSES,
  MISSION_PRIORITIES,
  statusLabel,
  priorityLabel,
} from './types';
import type { MissionFilters as Filters, MissionStatus, MissionPriority } from './types';
import type { ActiveOfficer } from '../officers/types';

interface MissionFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  officers: ActiveOfficer[];
  onCreate: () => void;
}

export function MissionFilters({
  filters,
  onChange,
  officers,
  onCreate,
}: MissionFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(filters);

  function apply() {
    onChange(draft);
    setIsOpen(false);
  }

  function clear() {
    setDraft({});
    onChange({});
    setIsOpen(false);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const isToday = filters.date === todayIso;
  const isOpenOnly = filters.open === true;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="relative flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          onClick={() => onChange({ ...filters, open: isOpenOnly ? undefined : true })}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base font-medium rounded-md cursor-pointer transition-colors ${
            isOpenOnly
              ? 'bg-[#1F3864] text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Open only
        </button>

        <button
          onClick={() => onChange({ ...filters, date: isToday ? undefined : todayIso })}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base font-medium rounded-md cursor-pointer transition-colors ${
            isToday
              ? 'bg-[#1F3864] text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Today
        </button>

        <button
          onClick={() => {
            setDraft(filters);
            setIsOpen(!isOpen);
          }}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm sm:text-base font-medium rounded-md cursor-pointer"
        >
          Filter
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-5 w-72 max-w-[90vw] z-50">
            <div className="space-y-4">
              <Select
                label="Priority"
                value={draft.priority ?? ''}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    priority: value ? (value as MissionPriority) : undefined,
                  })
                }
                options={MISSION_PRIORITIES.map((p) => ({
                  value: p,
                  label: priorityLabel(p),
                }))}
              />

              <Select
                label="Status"
                value={draft.status ?? ''}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    status: value ? (value as MissionStatus) : undefined,
                  })
                }
                options={MISSION_STATUSES.map((s) => ({
                  value: s,
                  label: statusLabel(s),
                }))}
              />

              <Select
                label="Officer"
                value={draft.officer_id ? String(draft.officer_id) : ''}
                onChange={(value) =>
                  setDraft({ ...draft, officer_id: value ? Number(value) : undefined })
                }
                options={officers.map((entry) => ({
                  value: String(entry.officer.id),
                  label: entry.officer.full_name,
                }))}
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={clear}
                  className="px-4 py-2 text-base border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={apply}
                  className="px-4 py-2 text-base bg-[#1F3864] text-white rounded-md hover:bg-[#182c50] cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onCreate}
        className="bg-[#1F3864] text-white text-sm sm:text-lg font-semibold px-4 sm:px-7 py-2 sm:py-3.5 rounded-md shadow-xs hover:bg-[#182c50] transition-colors cursor-pointer"
      >
        New mission
      </button>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-600 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-md px-3 py-2 text-base bg-white"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}