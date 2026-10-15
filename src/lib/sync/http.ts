import { ProviderError } from './types';

export async function requestJson<T>(url: string, init: RequestInit & { label: string }): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error_description ?? body.error?.message ?? (typeof body.error === 'string' ? body.error : '');
    } catch {
      // Not JSON; the status says enough.
    }
    throw new ProviderError(`${init.label} failed (${res.status})${detail ? `: ${detail}` : ''}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function form(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}
