import { useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { useLeafletMap } from '../map/useLeafletMap';
import { useMissionPin } from '../map/useMissionPin';
import { searchTripoliLocations } from '../../data/tripoliLocations';
import { MISSION_PRIORITIES, priorityLabel } from './types';
import type { CreateMissionRequest, MissionPriority } from './types';
import type { ActiveOfficer } from '../officers/types';

const TRIPOLI_CENTRE: [number, number] = [34.4367, 35.8497];

interface CreateMissionPageProps {
  officers: ActiveOfficer[];
  onSubmit: (payload: CreateMissionRequest) => Promise<unknown>;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<keyof CreateMissionRequest | 'detail', string>>;

export function CreateMissionPage({
  officers,
  onSubmit,
  onCancel,
}: CreateMissionPageProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MissionPriority>('medium');
  const [address, setAddress] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [coords, setCoords] = useState<[number, number]>(TRIPOLI_CENTRE);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { containerRef, mapRef } = useLeafletMap({
    centre: TRIPOLI_CENTRE,
    zoom: 14,
    onClick: setCoords,
  });

  useMissionPin({ mapRef, coords });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      await onSubmit({
        title,
        description,
        latitude: coords[0],
        longitude: coords[1],
        address,
        priority,
        // §5: the officer's id, never a name parsed out of a label.
        assigned_to_id: assigneeId ? Number(assigneeId) : null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      });
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === 'object') {
        const body = err.body as Record<string, unknown>;
        const mapped: FieldErrors = {};
        for (const [field, messages] of Object.entries(body)) {
          const text = Array.isArray(messages) ? messages[0] : messages;
          if (typeof text === 'string') mapped[field as keyof FieldErrors] = text;
        }
        setErrors(mapped);
      } else {
        setErrors({ detail: 'Could not create the mission. Try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]';

  return (
    <div className="flex-1 bg-white flex w-full">
      <div className="w-1/2 p-8 overflow-y-auto space-y-6">
        <h2 className="text-lg font-bold text-slate-900">New mission</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.detail && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
              {errors.detail}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs attention?"
              className={inputClass}
              required
            />
            {errors.title && <FieldError>{errors.title}</FieldError>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as MissionPriority)}
                className={`${inputClass} bg-white`}
              >
                {MISSION_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Assign to
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="">Leave unassigned</option>
                {officers.map((entry) => (
                  <option key={entry.officer.id} value={String(entry.officer.id)}>
                    {entry.officer.full_name} · {entry.officer.badge_number}
                  </option>
                ))}
              </select>
              {officers.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  No officers on duty right now.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setSuggestions(searchTripoliLocations(e.target.value));
                }}
                placeholder="Neighbourhood or street"
                className={inputClass}
              />
              {suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.map((location) => (
                    <button
                      key={location}
                      type="button"
                      onClick={() => {
                        setAddress(location);
                        setSuggestions([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 text-xs cursor-pointer"
                    >
                      {location}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Deadline — optional
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#1F3864] hover:bg-[#182c50] disabled:bg-slate-400 text-white text-xs font-semibold px-5 py-2 rounded-md transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Creating…' : assigneeId ? 'Create and assign' : 'Create mission'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-5 py-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <div className="w-1/2 p-4 relative flex flex-col bg-slate-100">
        <div className="flex-1 relative rounded-lg overflow-hidden border border-slate-200 shadow-xs">
          <div ref={containerRef} className="w-full h-full z-0" />

          <div className="absolute top-4 left-4 right-4 z-10 pointer-events-none">
            <div className="bg-white/95 backdrop-blur px-3 py-2 rounded-md shadow-md text-xs text-slate-700 border border-slate-200">
              Click anywhere on the map to set the mission location.
            </div>
          </div>

          <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur px-3 py-1 rounded text-[11px] text-slate-700 font-mono shadow-xs border border-slate-200">
            {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-rose-600 mt-1">{children}</p>;
}