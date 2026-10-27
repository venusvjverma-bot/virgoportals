import type { ResourceType } from '@/types';

export function visitorLink(portalId: string): string {
  return `${window.location.origin}${window.location.pathname}?portal=${encodeURIComponent(portalId)}`;
}

export function resourceLink(resourceId: string, resourceType: ResourceType): string {
  return `${window.location.origin}${window.location.pathname}?resource=${encodeURIComponent(resourceId)}&type=${encodeURIComponent(resourceType)}`;
}

type ResourceParams = {
  resourceId: string;
  resourceType: ResourceType;
} | null;

export function readVisitorParamsFromUrl(): ResourceParams {
  const params = new URLSearchParams(window.location.search);
  const resource = params.get('resource');
  const type = params.get('type') as ResourceType | null;
  if (resource && resource.trim() && type && (type === 'department' || type === 'event' || type === 'restaurant')) {
    return { resourceId: resource.trim(), resourceType: type };
  }
  return null;
}

export function readPortalIdFromUrl(): string | null {
  const value = new URLSearchParams(window.location.search).get('portal');
  return value && value.trim() ? value.trim() : null;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
