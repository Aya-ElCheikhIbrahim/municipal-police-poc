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
  /** On-duty officers, for the officer filter. */
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

  // Draft state so the panel only applies on "Apply", matching the original UI.
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
    <div className="flex items-center justify-between mb-4">
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => onChange({ ...filters, open: isOpenOnly ? undefined : true })}
          className={`px-3 py-1 text-xs font-medium rounded cursor-pointer transition-colors ${
            isOpenOnly
              ? 'bg-[#1F3864] text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Open only
        </button>

        <button
          onClick={() => onChange({ ...filters, date: isToday ? undefined : todayIso })}
          className={`px-3 py-1 text-xs font-medium rounded cursor-pointer transition-colors ${
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
          className="px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-medium rounded cursor-pointer"
        >
          Filter
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-4 w-64 z-50">
            <div className="space-y-3">
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
                  className="px-3 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={apply}
                  className="px-3 py-1 text-xs bg-[#1F3864] text-white rounded hover:bg-[#182c50] cursor-pointer"
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
        className="bg-[#1F3864] text-white text-xs font-semibold px-4 py-1.5 rounded shadow-xs hover:bg-[#182c50] transition-colors cursor-pointer"
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
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded px-2 py-1 text-xs bg-white"
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