// Anonymous counters, bucketed by hour (Panama time). No names, IPs or cookies are stored.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const EVENTS = ['visit', 'cert', 'pdf', 'print', 'photo', 'zip', 'share'];
const OFFSET_H = Number(process.env.TZ_OFFSET_HOURS ?? -5); // America/Panama, no DST

const pad = (n) => String(n).padStart(2, '0');

// "YYYY-MM-DDTHH" in local (Panama) time.
export function hourKey(date = new Date()) {
  const d = new Date(date.getTime() + OFFSET_H * 3600_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}`;
}

export function dayKey(date = new Date()) {
  return hourKey(date).slice(0, 10);
}

// The day keys of the last `n` local days, oldest first, ending today.
export function lastDays(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(dayKey(new Date(now.getTime() - i * 86_400_000)));
  return out;
}

const empty = () => Object.fromEntries(EVENTS.map((e) => [e, 0]));

export class Metrics {
  constructor(file) {
    this.file = file;
    this.data = { v: 1, since: null, hours: {} };
    this.saved = true;
    this.error = null;
    this.timer = null;
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      if (raw && raw.v === 1 && raw.hours && typeof raw.hours === 'object') this.data = raw;
    } catch (e) {
      if (e.code !== 'ENOENT') {
        this.error = `No se pudo leer ${file}: ${e.code || e.message}`;
        console.error(this.error);
      }
    }
  }

  add(type, date = new Date()) {
    if (!EVENTS.includes(type)) return;
    const k = hourKey(date);
    const bucket = (this.data.hours[k] ||= {});
    bucket[type] = (bucket[type] || 0) + 1;
    if (!this.data.since) this.data.since = date.toISOString();
    this.schedule();
  }

  schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 2000);
    this.timer.unref?.();
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const tmp = `${this.file}.tmp`;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(tmp, JSON.stringify(this.data));
      renameSync(tmp, this.file);
      this.saved = true;
      this.error = null;
    } catch (e) {
      this.saved = false;
      this.error = `No se pudo guardar en ${this.file}: ${e.code || e.message}`;
      console.error(this.error);
    }
  }

  // Sums per day for the given day keys, plus totals over all time.
  summary(days) {
    const byDay = new Map(days.map((d) => [d, empty()]));
    const total = empty();
    const hoursToday = Array.from({ length: 24 }, () => empty());
    const today = dayKey();
    for (const [k, counts] of Object.entries(this.data.hours)) {
      const day = k.slice(0, 10);
      const row = byDay.get(day);
      for (const e of EVENTS) {
        const n = counts[e] || 0;
        if (!n) continue;
        total[e] += n;
        if (row) row[e] += n;
        if (day === today) hoursToday[Number(k.slice(11, 13))][e] += n;
      }
    }
    return { days: days.map((d) => ({ day: d, ...byDay.get(d) })), total, hoursToday, since: this.data.since };
  }

  // All-time totals and fun facts for the promo image: record day, peak hour of the day.
  facts() {
    const total = empty();
    const byDay = new Map();
    const byHour = Array(24).fill(0);
    for (const [k, counts] of Object.entries(this.data.hours)) {
      for (const e of EVENTS) total[e] += counts[e] || 0;
      const n = counts.cert || 0;
      if (!n) continue;
      const day = k.slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + n);
      byHour[Number(k.slice(11, 13))] += n;
    }
    let peakDay = null;
    for (const [day, n] of byDay) if (!peakDay || n > peakDay.n) peakDay = { day, n };
    let peakHour = null;
    byHour.forEach((n, hour) => {
      if (n && (!peakHour || n > peakHour.n)) peakHour = { hour, n };
    });
    const today = dayKey();
    return { total, peakDay, peakHour, today: byDay.get(today) || 0, asOf: today, since: this.data.since };
  }

  // Every day with data, oldest first (for the CSV).
  allDays() {
    const keys = Object.keys(this.data.hours).map((k) => k.slice(0, 10));
    return [...new Set(keys)].sort();
  }
}
