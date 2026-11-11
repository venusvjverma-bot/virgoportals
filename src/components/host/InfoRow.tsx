/**
 * Read-only detail row used by the Host Dashboard information sections.
 * Shared so the Business Information section matches Restaurant Information
 * exactly instead of growing a second, drifting copy of the same markup.
 */
export function Divider() {
  return <div style={{ height: '1px', backgroundColor: '#EEE9E1', margin: '0' }} />;
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  multiline?: boolean;
}

export function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center"
        style={{
          backgroundColor: '#F0F1EB',
          borderRadius: '10px',
          color: '#71806A',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <p
          className="text-[11px] font-medium uppercase"
          style={{ letterSpacing: '0.5px', color: '#858278' }}
        >
          {label}
        </p>
        <p
          className="mt-0.5 text-[15px] font-medium break-words"
          style={{ color: '#292A27' }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
