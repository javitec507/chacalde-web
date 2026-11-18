// Anonymous counters for the admin panel: sends only the action name, nothing about the person.
const TYPES = new Set(['visit', 'cert', 'pdf', 'print', 'photo', 'zip', 'share']);

export function track(type) {
  if (!TYPES.has(type) || import.meta.env.DEV) return;
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/e', type)) return;
    fetch('/api/e', { method: 'POST', body: type, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch {
    /* counting must never break the site */
  }
}
