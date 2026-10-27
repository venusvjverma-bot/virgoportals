import { useEffect, useState } from 'react';
import { ChevronRight, Clock, LayoutGrid, Plus, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { Badge } from '@/components/ui/Badge';
import { createDepartment, listDepartments } from '@/lib/departments';
import type { Department, RestaurantPortal } from '@/types';

interface DepartmentsViewProps {
  restaurant: RestaurantPortal;
  onOpenDepartment: (dept: Department) => void;
  onReload: () => Promise<void>;
}

export function DepartmentsView({ restaurant, onOpenDepartment, onReload }: DepartmentsViewProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await listDepartments(restaurant.id);
        if (active) setDepartments(rows);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load departments.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [restaurant.id]);

  async function handleCreate() {
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError('Enter a department name.');
      return;
    }
    setCreating(true);
    try {
      const dept = await createDepartment(restaurant.id, newName.trim());
      setDepartments((prev) => [...prev, dept]);
      setNewName('');
      setAdding(false);
      await onReload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create department.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center py-14 text-sm text-ink-muted">
        Loading departments…
      </Card>
    );
  }

  if (error) {
    return <Notice tone="error">{error}</Notice>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1
          className="text-[38px] font-bold leading-tight sm:text-[52px]"
          style={{ fontFamily: 'Georgia, serif', color: '#292A27' }}
        >
          Departments
        </h1>
        <p className="text-[15px] leading-[1.5]" style={{ color: '#77766F' }}>
          Manage permanent service areas, each with its own menu, AI assistant and QR code.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          {departments.length} {departments.length === 1 ? 'department' : 'departments'}
        </p>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-4 w-4" />
          Add department
        </Button>
      </div>

      {adding ? (
        <Card className="animate-fade-in">
          <h3 className="font-display text-lg font-semibold text-ink">New department</h3>
          <p className="mt-1 text-sm text-ink-muted">e.g. Breakfast Buffet, À la Carte, Bar, Room Service</p>
          <div className="mt-4">
            <Input
              value={newName}
              placeholder="Department name"
              onChange={(e) => { setNewName(e.target.value); setCreateError(null); }}
              autoFocus
            />
          </div>
          {createError ? <Notice tone="error" className="mt-3">{createError}</Notice> : null}
          <div className="mt-4 flex gap-3">
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
            <Button variant="secondary" onClick={() => { setAdding(false); setNewName(''); setCreateError(null); }}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="space-y-4">
        {departments.map((dept) => (
          <DepartmentCard key={dept.id} dept={dept} onOpen={() => onOpenDepartment(dept)} />
        ))}
      </div>

      {departments.length === 0 && !adding ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-100 text-olive-600">
            <LayoutGrid className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-ink">No departments yet</p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            Click "Add department" to create a new service area with its own menu, bot and QR.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function DepartmentCard({ dept, onOpen }: { dept: Department; onOpen: () => void }) {
  const hours = dept.openTime && dept.closeTime
    ? `${dept.openTime} – ${dept.closeTime}`
    : 'Always open';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full rounded-[22px] p-5 text-left transition-all duration-[175ms] ease-out hover:shadow-[0_8px_24px_rgba(41,42,39,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2 active:bg-[#FBFAF7] motion-reduce:transition-none sm:p-6"
      style={{
        backgroundColor: '#FFFEFC',
        border: '1px solid #E8E1D7',
        boxShadow: '0 4px 14px rgba(41, 42, 39, 0.06)',
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: '#E4E8DF' }}
        >
          <UtensilsCrossed className="h-[22px] w-[22px]" style={{ color: '#58664F' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="text-[21px] font-bold leading-tight sm:text-[24px]"
              style={{ fontFamily: 'Georgia, serif', color: '#292A27' }}
            >
              {dept.name}
            </h3>
            {dept.isDefault ? (
              <Badge tone="olive">Default</Badge>
            ) : null}
            {!dept.isActive ? (
              <Badge tone="warning">Inactive</Badge>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[15px]" style={{ color: '#77766F' }}>
            <Clock className="h-4 w-4 shrink-0" />
            <span>{hours}</span>
          </div>
          <p className="mt-0.5 text-[13px]" style={{ color: '#9A978E' }}>
            Menu, service hours and QR settings
          </p>
        </div>
        <ChevronRight
          className="h-5 w-5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
          style={{ color: '#58664F' }}
        />
      </div>
    </button>
  );
}
