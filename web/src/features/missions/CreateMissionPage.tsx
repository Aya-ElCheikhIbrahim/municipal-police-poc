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
  const [category, setCategory] = useState('Municipal');
  const [priority, setPriority] = useState<MissionPriority>('medium');
  const [address, setAddress] = useState('');
  const [selectedOfficerIds, setSelectedOfficerIds] = useState<number[]>([]);
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

  const toggleOfficer = (id: number) => {
    setSelectedOfficerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      await onSubmit({
        title,
        description,
        category,
        latitude: coords[0],
        longitude: coords[1],
        address,
        priority,
        // Send array of assigned officer IDs
        assigned_to_ids: selectedOfficerIds,
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
    'w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]';

  return (
    <div className="flex-1 bg-white flex flex-col lg:flex-row w-full overflow-y-auto lg:overflow-hidden">
      <div className="w-full lg:w-1/2 p-4 lg:p-5 flex flex-col gap-2 lg:gap-3 lg:min-h-0 lg:overflow-hidden">
        <h2 className="text-base lg:text-lg font-bold text-slate-900">New mission</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 lg:gap-2.5 lg:flex-1 lg:min-h-0">
          {errors.detail && (
            <div className="text-sm sm:text-base text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 sm:px-4 py-2 sm:py-3">
              {errors.detail}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-0.5">
              Title
            </label>
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
            <label className="block text-xs font-medium text-slate-500 mb-0.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-0.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="Municipal">Municipal</option>
                <option value="Sanitation">Sanitation</option>
                <option value="Traffic">Traffic</option>
                <option value="Infrastructure">Infrastructure</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-0.5">
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
          </div>

          {/* Multi-Officer Selection Area */}
          <div className="flex flex-col lg:flex-1 lg:min-h-0">
            <label className="block text-xs font-medium text-slate-500 mb-0.5">
              Assign to ({selectedOfficerIds.length} selected)
            </label>
            <div className="border border-slate-200 rounded-md max-h-32 lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto overscroll-contain divide-y divide-slate-100 p-1 bg-white">
              {officers.length === 0 ? (
                <p className="p-3 text-xs sm:text-sm text-amber-600">
                  No officers on duty right now.
                </p>
              ) : (
                officers.map((entry) => {
                  const isChecked = selectedOfficerIds.includes(entry.officer.id);
                  return (
                    <label
                      key={entry.officer.id}
                      className="flex items-center gap-2 px-2.5 py-1 hover:bg-slate-50 cursor-pointer rounded-sm"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOfficer(entry.officer.id)}
                        className="w-4 h-4 text-[#1F3864] rounded border-slate-300 focus:ring-[#1F3864]"
                      />
                      <span className="text-sm text-slate-700">
                        {entry.officer.full_name} · {entry.officer.badge_number}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <label className="block text-xs font-medium text-slate-500 mb-0.5">
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
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-100 text-sm sm:text-base cursor-pointer"
                    >
                      {location}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-0.5">
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

          <div className="flex items-center gap-2 pt-1 shrink-0">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#1F3864] hover:bg-[#182c50] disabled:bg-slate-400 text-white text-sm font-semibold px-4 py-1.5 rounded-md transition-colors cursor-pointer"
            >
              {isSubmitting
                ? 'Creating…'
                : selectedOfficerIds.length > 0
                ? `Create and assign (${selectedOfficerIds.length})`
                : 'Create mission'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-1.5 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <div className="w-full lg:w-1/2 p-4 relative flex flex-col bg-slate-100 h-[300px] lg:h-auto shrink-0">
        <div className="flex-1 relative rounded-lg overflow-hidden border border-slate-200 shadow-xs">
          <div ref={containerRef} className="w-full h-full z-0" />

          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 z-10 pointer-events-none">
            <div className="bg-white/95 backdrop-blur px-3 sm:px-4 py-2 sm:py-3 rounded-md shadow-md text-sm sm:text-base text-slate-700 border border-slate-200">
              Click anywhere on the map to set the mission location.
            </div>
          </div>

          <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 z-10 bg-white/95 backdrop-blur px-3 py-1.5 rounded text-xs sm:text-sm text-slate-700 font-mono shadow-xs border border-slate-200">
            {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs sm:text-sm text-rose-600 mt-1.5">{children}</p>;
}