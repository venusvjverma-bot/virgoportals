import type { SessionReportTicketData } from '@/lib/sessionReportTicket';
import { generateSessionReportBlob } from '@/lib/sessionReportTicket';

export function downloadSessionReportPdf(
  ticket: SessionReportTicketData,
  departmentName: string,
  startedAt: string,
): void {
  const blob = generateSessionReportBlob(ticket);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${departmentName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-session-${new Date(startedAt).toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
