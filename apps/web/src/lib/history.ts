import { z } from 'zod';
import { ReportSchema, RiskCategorySchema, type AnalysisReport } from '@radarjob/shared';

/**
 * Local scan history, stored only in this browser (localStorage).
 * Entries keep the domain, timestamps, category, a short summary and a copy of
 * the report. Reports never contain query strings, and job-text evidence is
 * already redacted by the server. Nothing here is sent anywhere.
 */

const KEY = 'radarjob.history.v1';
export const MAX_HISTORY = 25;

const EntrySchema = z.object({
  id: z.string(),
  domain: z.string(),
  analyzedAt: z.string(),
  savedAt: z.string(),
  category: RiskCategorySchema,
  summary: z.string(),
  simulated: z.boolean().default(false),
  report: z.unknown().optional(),
});
export type HistoryEntry = z.infer<typeof EntrySchema>;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadHistory(): HistoryEntry[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    return parsed.data.flatMap((e) => {
      const r = EntrySchema.safeParse(e);
      return r.success ? [r.data] : [];
    });
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event('radarjob-history'));
    return true;
  } catch {
    return false;
  }
}

/** Save a completed report. Running or failed reports are never saved. */
export function saveReport(report: AnalysisReport): boolean {
  if (report.status !== 'completed' || !report.assessment) return false;
  const entry: HistoryEntry = {
    id: report.id,
    domain: report.input.unicodeHostname,
    analyzedAt: report.completedAt ?? report.createdAt,
    savedAt: new Date().toISOString(),
    category: report.assessment.category,
    summary: (report.explanation?.summary ?? report.assessment.reasons[0] ?? '').slice(0, 280),
    simulated: report.simulated,
    report,
  };
  const rest = loadHistory().filter((e) => e.id !== report.id);
  return write([entry, ...rest].slice(0, MAX_HISTORY));
}

export function getEntry(id: string): HistoryEntry | undefined {
  return loadHistory().find((e) => e.id === id);
}

/** The saved report, if it is still present and well-formed. */
export function getSavedReport(entry: HistoryEntry): AnalysisReport | null {
  const r = ReportSchema.safeParse(entry.report);
  return r.success ? r.data : null;
}

export function deleteEntry(id: string): void {
  write(loadHistory().filter((e) => e.id !== id));
}

export function clearHistory(): void {
  const s = storage();
  try {
    s?.removeItem(KEY);
    window.dispatchEvent(new Event('radarjob-history'));
  } catch {
    /* ignore */
  }
}
