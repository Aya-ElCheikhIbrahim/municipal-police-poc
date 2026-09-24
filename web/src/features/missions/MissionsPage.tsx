import { useEffect, useState } from 'react';
import { useMissions } from './useMissions';
import { useActiveOfficers } from '../officers/useOfficers';
import { MissionTable } from './MissionTable';
import type { MissionSortField } from './MissionTable';
import { MissionFilters } from './MissionFilters';
import { MissionDetailPage } from './MissionDetailPage';
import { CreateMissionPage } from './CreateMissionPage';
import type { MissionFilters as Filters, CreateMissionRequest } from './types';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; missionId: number }
  | { kind: 'create' };

interface MissionsPageProps {
  initialMissionId?: number | null;
  onInitialMissionOpened?: () => void;
}

export function MissionsPage({
  initialMissionId,
  onInitialMissionOpened,
}: MissionsPageProps) {
  const [view, setView] = useState<View>(
    initialMissionId != null
      ? { kind: 'detail', missionId: initialMissionId }
      : { kind: 'list' }
  );
  const [filters, setFilters] = useState<Filters>({});
  const [activeSort, setActiveSort] = useState<MissionSortField | 'priority'>('priority');
  const [sortAsc, setSortAsc] = useState(false);
  const { missions, isLoading, error, refresh, createMission } = useMissions(filters);

  // Polled only on the create form, where the officer dots on the map have to
  // keep up with the officers. The list and detail views need the names once.
  const { officers } = useActiveOfficers(view.kind === 'create');

  useEffect(() => {
    if (initialMissionId == null) return;

    setView({ kind: 'detail', missionId: initialMissionId });
    onInitialMissionOpened?.();
  }, [initialMissionId, onInitialMissionOpened]);

  function handleHeaderSort(field: MissionSortField) {
    if (activeSort === field) {
      setSortAsc((prev) => !prev);
    } else {
      setActiveSort(field);
      setSortAsc(
        field === 'title' ||
        field === 'category' ||
        field === 'status' ||
        field === 'assignedTo'
      );
    }
  }

  function handlePrioritySort() {
    if (activeSort === 'priority') {
      setSortAsc((prev) => !prev);
    } else {
      setActiveSort('priority');
      setSortAsc(false);
    }
  }

  async function handleCreate(payload: CreateMissionRequest) {
    const created = await createMission(payload);
    setView({ kind: 'detail', missionId: created.id });
  }

  if (view.kind === 'create') {
    return (
      <CreateMissionPage
        officers={officers}
        onSubmit={handleCreate}
        onCancel={() => setView({ kind: 'list' })}
      />
    );
  }

  if (view.kind === 'detail') {
    return (
      <MissionDetailPage
        missionId={view.missionId}
        officers={officers}
        onBack={() => setView({ kind: 'list' })}
        onChanged={refresh}
      />
    );
  }

  return (
    <div className="flex-1 bg-white flex flex-col min-h-0">
      <div className="shrink-0 relative z-20 px-6 pt-6 border-b border-slate-100">
        <MissionFilters
          filters={filters}
          onChange={setFilters}
          officers={officers}
          onCreate={() => setView({ kind: 'create' })}
          prioritySortAsc={sortAsc}
          prioritySortActive={activeSort === 'priority'}
          onPrioritySort={handlePrioritySort}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-6 flex flex-col">
        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <MissionTable
          missions={missions}
          isLoading={isLoading}
          onSelect={(missionId) => setView({ kind: 'detail', missionId })}
          onClearFilters={() => setFilters({})}
          onCreate={() => setView({ kind: 'create' })}
          activeSort={activeSort}
          sortAsc={sortAsc}
          onHeaderSort={handleHeaderSort}
        />
      </div>
    </div>
  );
}
