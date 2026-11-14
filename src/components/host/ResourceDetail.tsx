import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  QrCode as QrIcon,
  ScrollText,
  Sparkles,
  Pencil,
  Image as ImageIcon,
  Store,
  UtensilsCrossed,
  Printer as PrinterIcon,
  CalendarDays,
  Save as SaveIcon,
  CheckCircle2,
  Trash2,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MenuView } from '@/components/host/MenuView';
import { BotView } from '@/components/host/BotView';
import { QrView } from '@/components/host/QrView';
import { ChatThemeView } from '@/components/host/ChatThemeView';
import { TypeOfServiceSection } from '@/components/host/TypeOfServiceSection';
import { PrinterView } from '@/components/host/PrinterView';
import { listDishesByDepartment, listDishesByEvent, uploadMenuFile, createDish, deleteDish, updateDish, replaceServingOptions, replaceRemovableIngredients, replaceVariants } from '@/lib/portal';
import { updateDepartment, deleteDepartment, archiveDepartment } from '@/lib/departments';
import { updateEvent, deleteEvent, archiveEvent } from '@/lib/events';
import { callFunction } from '@/lib/functions';
import { resourceLink } from '@/lib/links';
import { getBotText } from '@/lib/config';
import { computeEventStatus, EventStatusBadge } from '@/lib/eventStatus';
import type { Department, EventItem, Dish, RestaurantPortal, ResourceView } from '@/types';
import { resourceHasOrders } from '@/lib/orders';
import type { ServingOptionInput } from '@/components/host/DishCard';
import type { RemovableIngredientInput, VariantInput } from '@/components/host/DishCard';

interface ResourceDetailProps {
  restaurant: RestaurantPortal;
  resource: Department | EventItem;
  resourceType: 'department' | 'event';
  onBack: () => void;
  onResourceChanged: () => void;
}

export function ResourceDetail({
  restaurant,
  resource,
  resourceType,
  onBack,
  onResourceChanged,
}: ResourceDetailProps) {
  const [tab, setTab] = useState<ResourceView>('details');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [adminDefault, setAdminDefault] = useState('');
  const [loadingDishes, setLoadingDishes] = useState(false);

  const isDept = resourceType === 'department';
  const resourceId = resource.id;

  const reloadDishes = useCallback(async () => {
    setLoadingDishes(true);
    try {
      const rows = isDept
        ? await listDishesByDepartment(resourceId)
        : await listDishesByEvent(resourceId);
      setDishes(rows);
    } finally {
      setLoadingDishes(false);
    }
  }, [resourceId, isDept]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [rows, botText] = await Promise.all([
        isDept ? listDishesByDepartment(resourceId) : listDishesByEvent(resourceId),
        getBotText(),
      ]);
      if (!active) return;
      setDishes(rows);
      setAdminDefault(botText);
    })();
    return () => { active = false; };
  }, [resourceId, isDept]);

  async function handleSaveDish(
    dishId: string,
    patch: Parameters<typeof updateDish>[1],
    servingOptions?: ServingOptionInput[],
    removableIngredients?: RemovableIngredientInput[],
    variants?: VariantInput[]
  ) {
    await updateDish(dishId, patch);
    if (servingOptions && servingOptions.length > 0) {
      await replaceServingOptions(dishId, servingOptions);
    }
    if (removableIngredients) {
      await replaceRemovableIngredients(dishId, removableIngredients);
    }
    if (variants) {
      await replaceVariants(dishId, variants);
    }
    await reloadDishes();
  }

  async function handleCreateDish(
    patch: Parameters<typeof createDish>[1],
    servingOptions?: ServingOptionInput[],
    removableIngredients?: RemovableIngredientInput[],
    variants?: VariantInput[]
  ): Promise<string | void> {
    const dish = await createDish(
      {
        restaurantId: restaurant.id,
        departmentId: isDept ? resourceId : null,
        eventId: isDept ? null : resourceId,
      },
      patch
    );
    if (servingOptions && servingOptions.length > 0) {
      await replaceServingOptions(dish.id, servingOptions);
    }
    if (removableIngredients) {
      await replaceRemovableIngredients(dish.id, removableIngredients);
    }
    if (variants) {
      await replaceVariants(dish.id, variants);
    }
    await reloadDishes();
    return dish.id;
  }

  async function handleGenerateImage(dishId: string) {
    await callFunction<{ imageUrl: string }>('dish-image', {
      restaurantId: restaurant.id,
      dishId,
      clientRequestId: crypto.randomUUID(),
    });
    await reloadDishes();
  }

  async function handleDeleteDish(dishId: string) {
    await deleteDish(dishId);
    await reloadDishes();
  }

  async function handleSaveSystemPrompt(text: string) {
    if (isDept) {
      await updateDepartment(resourceId, { systemPrompt: text });
    } else {
      await updateEvent(resourceId, { systemPrompt: text });
    }
    onResourceChanged();
  }

  const currentPrompt = resource.systemPrompt || restaurant.systemPrompt;
  const qrLink = resourceLink(resourceId, resourceType);

  const TABS: { id: ResourceView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'details', label: 'Details', icon: Pencil },
    { id: 'menu', label: 'Menu', icon: ScrollText },
    { id: 'bot', label: 'Bot', icon: Sparkles },
    { id: 'qr', label: 'QR', icon: QrIcon },
    { id: 'theme', label: 'Theme', icon: ImageIcon },
    ...(isDept ? [{ id: 'printer' as ResourceView, label: 'Printer', icon: PrinterIcon }] : []),
  ];

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-olive-700 transition-colors hover:text-olive-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {isDept ? 'Departments' : 'Events'}
      </button>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {resource.name}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {isDept ? (
              <>
                <Badge tone="olive">{(resource as Department).isDefault ? 'Default department' : 'Department'}</Badge>
                {(resource as Department).openTime && (resource as Department).closeTime ? (
                  <span className="text-sm text-ink-muted">
                    <Clock className="mr-1 inline h-3.5 w-3.5" />
                    {(resource as Department).openTime} – {(resource as Department).closeTime}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <Badge tone="olive">Event</Badge>
                <span className="text-sm text-ink-muted">
                  <Calendar className="mr-1 inline h-3.5 w-3.5" />
                  {(resource as EventItem).startDate} – {(resource as EventItem).endDate}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-1.5 rounded-2xl bg-white p-1.5 ring-1 ring-cream-200 shadow-[0_2px_8px_rgba(41,42,39,0.06)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-1 active:scale-[0.96] ${
                tab === t.id
                  ? 'bg-olive-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_6px_rgba(0,0,0,0.18)] hover:bg-olive-600'
                  : 'bg-white text-ink-muted ring-1 ring-cream-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_3px_rgba(41,42,39,0.08)] hover:bg-cream-50 hover:text-ink hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_6px_rgba(41,42,39,0.12)]'
              }`}
            >
              <Icon className="h-4 w-4 stroke-[2.25]" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'details' ? (
        isDept ? (
          <DepartmentDetails
            restaurant={restaurant}
            department={resource as Department}
            onSaved={onResourceChanged}
            onDelete={onBack}
          />
        ) : (
          <EventDetails
            restaurant={restaurant}
            event={resource as EventItem}
            onSaved={onResourceChanged}
            onDelete={onBack}
          />
        )
      ) : null}

      {tab === 'menu' ? (
        <MenuView
          restaurantId={restaurant.id}
          dishes={dishes}
          loading={loadingDishes}
          currency={restaurant.currency}
          onReload={reloadDishes}
          onCreateDish={handleCreateDish}
          onSaveDish={handleSaveDish}
          onDeleteDish={handleDeleteDish}
          onGenerateImage={handleGenerateImage}
          uploadMenuFile={(file) => uploadMenuFile(file, restaurant.id)}
          departmentId={isDept ? resourceId : undefined}
          eventId={isDept ? undefined : resourceId}
        />
      ) : null}

      {tab === 'bot' ? (
        <BotView
          adminDefault={adminDefault}
          value={currentPrompt}
          onSave={handleSaveSystemPrompt}
        />
      ) : null}

      {tab === 'qr' ? <QrView link={qrLink} /> : null}

      {tab === 'theme' ? (
        <ChatThemeView resource={resource} resourceType={resourceType} onSaved={onResourceChanged} />
      ) : null}

      {tab === 'printer' && isDept ? (
        <PrinterView department={resource as Department} onSaved={onResourceChanged} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared read-only UI primitives
// ---------------------------------------------------------------------------

const READ_ONLY_CARD_STYLE: React.CSSProperties = {
  backgroundColor: '#FFFEFC',
  border: '1px solid #E8E1D7',
  borderRadius: '22px',
  boxShadow: '0 4px 14px rgba(41, 42, 39, 0.05)',
};

const ICON_TILE_STYLE: React.CSSProperties = {
  backgroundColor: '#E4E8DF',
  borderRadius: '12px',
  color: '#58664F',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#85847B',
};

const VALUE_STYLE: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: 500,
  lineHeight: '1.45',
  color: '#292A27',
};

function ReadOnlyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="p-5 sm:p-6"
      style={READ_ONLY_CARD_STYLE}
    >
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <>
      <div className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center"
          style={ICON_TILE_STYLE}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p style={LABEL_STYLE}>{label}</p>
          <p className="mt-1 break-words" style={VALUE_STYLE}>{children}</p>
        </div>
      </div>
      {!last ? <div style={{ height: '1px', backgroundColor: '#EEE9E1' }} /> : null}
    </>
  );
}

function SectionHeader({
  icon,
  title,
  onEdit,
}: {
  icon: React.ReactNode;
  title: string;
  onEdit: () => void;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center"
          style={ICON_TILE_STYLE}
        >
          {icon}
        </div>
        <h2
          className="text-[28px] font-bold leading-tight sm:text-[32px]"
          style={{ fontFamily: 'Georgia, serif', color: '#292A27' }}
        >
          {title}
        </h2>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${title}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-colors hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E4DED3',
          color: '#59664F',
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
    </div>
  );
}

function EditButtonRow({
  onSave,
  onCancel,
  saving,
  canSave,
  saved,
}: {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  canSave: boolean;
  saved: boolean;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || saving}
        aria-label="Save changes"
        className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
        style={{ backgroundColor: '#3E5039' }}
      >
        <SaveIcon className="h-4 w-4" />
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel editing"
        className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-400 focus-visible:ring-offset-2"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5DED3',
          color: '#292A27',
        }}
      >
        Cancel
      </button>
      {saved ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-600">
          <CheckCircle2 className="h-4 w-4" />
          Saved
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Department Details
// ---------------------------------------------------------------------------

function ArchiveDeleteSection({
  heading,
  description,
  actionLabel,
  archiveLabel,
  dialogTitle,
  dialogConfirm,
  dialogBody,
  hasOrders,
  disabled,
  onDelete,
  onArchive,
}: {
  heading: string;
  description: string;
  actionLabel: string;
  archiveLabel: string;
  dialogTitle: string;
  dialogConfirm: string;
  dialogBody: React.ReactNode;
  hasOrders: boolean | null;
  disabled?: boolean;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div className="p-5 sm:p-6" style={READ_ONLY_CARD_STYLE}>
      <h3 className="font-display text-base font-semibold text-ink">{heading}</h3>
      {hasOrders === false ? (
        <>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
          <Button variant="ghost" className="mt-4 text-error-600" disabled={disabled} onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-4 w-4" />
            {actionLabel}
          </Button>
        </>
      ) : hasOrders === true ? (
        <>
          <p className="mt-1 text-sm text-ink-muted">
            This resource has historical orders, so it cannot be permanently deleted. Archiving removes it from your
            active lists and stops new orders, while keeping all past orders and reports intact.
          </p>
          <Button variant="ghost" className="mt-4 text-error-600" disabled={disabled} onClick={onArchive}>
            <Archive className="h-4 w-4" />
            {archiveLabel}
          </Button>
        </>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">Checking order history…</p>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={dialogTitle}
        confirmLabel={dialogConfirm}
        tone="danger"
        onConfirm={() => { setConfirmOpen(false); onDelete(); }}
        onCancel={() => setConfirmOpen(false)}
      >
        {dialogBody}
      </ConfirmDialog>
    </div>
  );
}

function DepartmentDetails({
  restaurant,
  department,
  onSaved,
  onDelete,
}: {
  restaurant: RestaurantPortal;
  department: Department;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [name, setName] = useState(department.name);
  const [openTime, setOpenTime] = useState(department.openTime ?? '');
  const [closeTime, setCloseTime] = useState(department.closeTime ?? '');
  const [isActive, setIsActive] = useState(department.isActive);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [hasOrders, setHasOrders] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    setHasOrders(null);
    resourceHasOrders('department', department.id)
      .then((v) => { if (active) setHasOrders(v); })
      .catch(() => { if (active) setHasOrders(true); });
    return () => { active = false; };
  }, [department.id]);

  async function handleArchive() {
    try {
      await archiveDepartment(department.id);
      onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive.');
    }
  }

  useEffect(() => {
    setName(department.name);
    setOpenTime(department.openTime ?? '');
    setCloseTime(department.closeTime ?? '');
    setIsActive(department.isActive);
    setStatus('idle');
  }, [department]);

  const dirty =
    name !== department.name ||
    openTime !== (department.openTime ?? '') ||
    closeTime !== (department.closeTime ?? '') ||
    isActive !== department.isActive;

  function handleEdit() {
    setError(null);
    setMode('edit');
  }

  function handleCancel() {
    setName(department.name);
    setOpenTime(department.openTime ?? '');
    setCloseTime(department.closeTime ?? '');
    setIsActive(department.isActive);
    setError(null);
    setStatus('idle');
    setMode('read');
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError('Department needs a name.');
      return;
    }
    setStatus('saving');
    try {
      await updateDepartment(department.id, {
        name: name.trim(),
        openTime: openTime || null,
        closeTime: closeTime || null,
        isActive,
      });
      setStatus('saved');
      onSaved();
      setMode('read');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function handleDelete() {
    if (department.isDefault) return;
    try {
      await deleteDepartment(department.id);
      onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
      setConfirmDelete(false);
    }
  }

  const TIME_OPTIONS = generateTimeOptions();

  const alwaysOpen = !department.openTime && !department.closeTime;

  return (
    <div className="max-w-2xl space-y-5">
      {mode === 'read' ? (
        <>
          <SectionHeader
            icon={<Store className="h-5 w-5" />}
            title="Department Information"
            onEdit={handleEdit}
          />
          <ReadOnlyPanel>
            <InfoRow icon={<Store className="h-5 w-5" />} label="Department name">
              {department.name || '—'}
            </InfoRow>
            <InfoRow icon={<Clock className="h-5 w-5" />} label="Opening time">
              {alwaysOpen ? 'Always open' : (department.openTime || '—')}
            </InfoRow>
            <InfoRow icon={<Clock className="h-5 w-5" />} label="Closing time">
              {alwaysOpen ? 'Always open' : (department.closeTime || '—')}
            </InfoRow>
            <InfoRow icon={<UtensilsCrossed className="h-5 w-5" />} label="Status" last>
              {department.isActive ? (
                <span
                  className="inline-flex items-center rounded-full text-[13px] font-medium"
                  style={{ backgroundColor: '#E4E8DF', color: '#465641', padding: '6px 12px' }}
                >
                  Active
                </span>
              ) : (
                <span
                  className="inline-flex items-center rounded-full text-[13px] font-medium"
                  style={{ backgroundColor: '#EFEEE9', color: '#68675F', padding: '6px 12px' }}
                >
                  Inactive
                </span>
              )}
            </InfoRow>
          </ReadOnlyPanel>

          <TypeOfServiceSection
            value={{
              tableServiceEnabled: department.tableServiceEnabled,
              tableServiceCharge: department.tableServiceCharge,
              roomServiceEnabled: department.roomServiceEnabled,
              roomServiceCharge: department.roomServiceCharge,
            }}
            currency={restaurant.currency}
            onSave={async (value) => {
              await updateDepartment(department.id, value);
              onSaved();
            }}
          />

          {!department.isDefault ? (
            <ArchiveDeleteSection
              heading="Remove department"
              description="This will permanently delete the department and all its menu items. This cannot be undone."
              actionLabel="Remove department"
              archiveLabel="Archive department"
              dialogTitle="Remove this department?"
              dialogConfirm="Remove"
              dialogBody={
                <p>All menu items, bot settings and QR links for <span className="font-medium">{department.name}</span> will be permanently deleted.</p>
              }
              hasOrders={hasOrders}
              onDelete={() => setConfirmDelete(true)}
              onArchive={() => setConfirmArchive(true)}
            />
          ) : (
            <p className="text-sm text-ink-muted">
              The default department cannot be removed — it is the primary service area for your restaurant.
            </p>
          )}
        </>
      ) : (
        <Card className="animate-fade-in">
          <Field label="Department name" htmlFor="dept-name">
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setStatus('idle'); }}
            />
          </Field>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Opening time (24-hour)" htmlFor="dept-open">
              <Select id="dept-open" value={openTime} onChange={(e) => { setOpenTime(e.target.value); setStatus('idle'); }}>
                <option value="">Always open</option>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Closing time (24-hour)" htmlFor="dept-close">
              <Select id="dept-close" value={closeTime} onChange={(e) => { setCloseTime(e.target.value); setStatus('idle'); }}>
                <option value="">Always open</option>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Status" htmlFor="dept-active" className="mt-5">
            <Select id="dept-active" value={isActive ? 'true' : 'false'} onChange={(e) => { setIsActive(e.target.value === 'true'); setStatus('idle'); }}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </Field>

          <p className="mt-4 text-xs text-ink-muted">
            Timezone: {restaurant.timezone}. Hours that cross midnight (e.g. 18:00 – 02:00) are supported.
          </p>

          {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}

          <EditButtonRow
            onSave={handleSave}
            onCancel={handleCancel}
            saving={status === 'saving'}
            canSave={dirty}
            saved={status === 'saved'}
          />
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Remove this department?"
        confirmLabel="Remove"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      >
        <p>All menu items, bot settings and QR links for <span className="font-medium">{department.name}</span> will be permanently deleted.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmArchive}
        title="Archive this department?"
        confirmLabel="Archive"
        tone="danger"
        onConfirm={() => { setConfirmArchive(false); handleArchive(); }}
        onCancel={() => setConfirmArchive(false)}
      >
        <p><span className="font-medium">{department.name}</span> will be removed from your active departments and can no longer receive new orders. Its historical orders, menu and reports stay intact.</p>
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Details
// ---------------------------------------------------------------------------

function EventDetails({
  restaurant,
  event,
  onSaved,
  onDelete,
}: {
  restaurant: RestaurantPortal;
  event: EventItem;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [name, setName] = useState(event.name);
  const [startDate, setStartDate] = useState(event.startDate);
  const [endDate, setEndDate] = useState(event.endDate);
  const [startTime, setStartTime] = useState(event.startTime ?? '');
  const [endTime, setEndTime] = useState(event.endTime ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [hasOrders, setHasOrders] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    setHasOrders(null);
    resourceHasOrders('event', event.id)
      .then((v) => { if (active) setHasOrders(v); })
      .catch(() => { if (active) setHasOrders(true); });
    return () => { active = false; };
  }, [event.id]);

  async function handleArchive() {
    try {
      await archiveEvent(event.id);
      onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive.');
    }
  }

  useEffect(() => {
    setName(event.name);
    setStartDate(event.startDate);
    setEndDate(event.endDate);
    setStartTime(event.startTime ?? '');
    setEndTime(event.endTime ?? '');
    setStatus('idle');
  }, [event]);

  const dirty =
    name !== event.name ||
    startDate !== event.startDate ||
    endDate !== event.endDate ||
    startTime !== (event.startTime ?? '') ||
    endTime !== (event.endTime ?? '');

  function handleEdit() {
    setError(null);
    setMode('edit');
  }

  function handleCancel() {
    setName(event.name);
    setStartDate(event.startDate);
    setEndDate(event.endDate);
    setStartTime(event.startTime ?? '');
    setEndTime(event.endTime ?? '');
    setError(null);
    setStatus('idle');
    setMode('read');
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError('Event needs a name.');
      return;
    }
    if (endDate < startDate) {
      setError('End date cannot be before start date.');
      return;
    }
    setStatus('saving');
    try {
      await updateEvent(event.id, {
        name: name.trim(),
        startDate,
        endDate,
        startTime: startTime || null,
        endTime: endTime || null,
      });
      setStatus('saved');
      onSaved();
      setMode('read');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function handleDelete() {
    try {
      await deleteEvent(event.id);
      onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
      setConfirmDelete(false);
    }
  }

  const TIME_OPTIONS = generateTimeOptions();

  const timezone = restaurant.timezone || 'UTC';
  const dynamicStatus = computeEventStatus(event, timezone);

  return (
    <div className="max-w-2xl space-y-5">
      {mode === 'read' ? (
        <>
          <SectionHeader
            icon={<CalendarDays className="h-5 w-5" />}
            title="Event Information"
            onEdit={handleEdit}
          />
          <ReadOnlyPanel>
            <InfoRow icon={<CalendarDays className="h-5 w-5" />} label="Event name">
              {event.name || '—'}
            </InfoRow>
            <InfoRow icon={<Calendar className="h-5 w-5" />} label="Start date">
              {event.startDate || '—'}
            </InfoRow>
            <InfoRow icon={<Calendar className="h-5 w-5" />} label="End date">
              {event.endDate || '—'}
            </InfoRow>
            <InfoRow icon={<Clock className="h-5 w-5" />} label="Start time">
              {event.startTime || 'All day'}
            </InfoRow>
            <InfoRow icon={<Clock className="h-5 w-5" />} label="End time">
              {event.endTime || 'All day'}
            </InfoRow>
            <InfoRow icon={<Sparkles className="h-5 w-5" />} label="Status" last>
              <EventStatusBadge status={dynamicStatus} />
            </InfoRow>
          </ReadOnlyPanel>

          <TypeOfServiceSection
            value={{
              tableServiceEnabled: event.tableServiceEnabled,
              tableServiceCharge: event.tableServiceCharge,
              roomServiceEnabled: event.roomServiceEnabled,
              roomServiceCharge: event.roomServiceCharge,
            }}
            currency={restaurant.currency}
            onSave={async (value) => {
              await updateEvent(event.id, value);
              onSaved();
            }}
          />

          <ArchiveDeleteSection
            heading="Remove event"
            description="This will permanently delete the event and all its menu items. This cannot be undone."
            actionLabel="Remove event"
            archiveLabel="Archive event"
            dialogTitle="Remove this event?"
            dialogConfirm="Remove"
            dialogBody={
              <p>All menu items, bot settings and QR links for <span className="font-medium">{event.name}</span> will be permanently deleted.</p>
            }
            hasOrders={hasOrders}
            onDelete={() => setConfirmDelete(true)}
            onArchive={() => setConfirmArchive(true)}
          />
        </>
      ) : (
        <Card className="animate-fade-in">
          <Field label="Event name" htmlFor="event-name">
            <Input
              id="event-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setStatus('idle'); }}
            />
          </Field>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Start date" htmlFor="event-start-date">
              <Input id="event-start-date" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setStatus('idle'); }} />
            </Field>
            <Field label="End date" htmlFor="event-end-date">
              <Input id="event-end-date" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setStatus('idle'); }} />
            </Field>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Start time (24-hour)" htmlFor="event-start-time">
              <Select id="event-start-time" value={startTime} onChange={(e) => { setStartTime(e.target.value); setStatus('idle'); }}>
                <option value="">All day</option>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="End time (24-hour)" htmlFor="event-end-time">
              <Select id="event-end-time" value={endTime} onChange={(e) => { setEndTime(e.target.value); setStatus('idle'); }}>
                <option value="">All day</option>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <EventStatusBadge status={dynamicStatus} />
          </div>

          <p className="mt-4 text-xs text-ink-muted">
            Timezone: {restaurant.timezone}. Events can span multiple days.
          </p>

          {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}

          <EditButtonRow
            onSave={handleSave}
            onCancel={handleCancel}
            saving={status === 'saving'}
            canSave={dirty}
            saved={status === 'saved'}
          />
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Remove this event?"
        confirmLabel="Remove"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      >
        <p>All menu items, bot settings and QR links for <span className="font-medium">{event.name}</span> will be permanently deleted.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmArchive}
        title="Archive this event?"
        confirmLabel="Archive"
        tone="danger"
        onConfirm={() => { setConfirmArchive(false); handleArchive(); }}
        onCancel={() => setConfirmArchive(false)}
      >
        <p><span className="font-medium">{event.name}</span> will be removed from your active events and can no longer receive new orders. Its historical orders, menu and reports stay intact.</p>
      </ConfirmDialog>
    </div>
  );
}

function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return times;
}
