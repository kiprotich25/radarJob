import { describe, expect, it } from 'vitest';
import { fixtureReport } from './fixtures';
import {
  clearHistory,
  deleteEntry,
  getEntry,
  getSavedReport,
  loadHistory,
  MAX_HISTORY,
  saveReport,
} from './history';

describe('local history', () => {
  it('saves completed reports only', () => {
    expect(saveReport(fixtureReport({ status: 'running', assessment: undefined }))).toBe(false);
    expect(saveReport(fixtureReport())).toBe(true);
    const [e] = loadHistory();
    expect(e).toMatchObject({
      domain: 'careers.example-test.com',
      category: 'no_significant_threats',
      analyzedAt: '2026-10-28T10:00:20.000Z',
    });
    expect(getSavedReport(e)?.id).toBe(e.id);
  });

  it('de-duplicates, caps the list and supports delete/clear', () => {
    for (let i = 0; i < MAX_HISTORY + 5; i++)
      saveReport(fixtureReport({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }));
    saveReport(fixtureReport({ id: '00000000-0000-4000-8000-000000000003' }));
    const list = loadHistory();
    expect(list).toHaveLength(MAX_HISTORY);
    expect(list[0].id).toBe('00000000-0000-4000-8000-000000000003');
    deleteEntry(list[0].id);
    expect(getEntry(list[0].id)).toBeUndefined();
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });

  it('tolerates corrupted storage and reports incomplete saved data', () => {
    window.localStorage.setItem('radarjob.history.v1', '{not json');
    expect(loadHistory()).toEqual([]);
    window.localStorage.setItem(
      'radarjob.history.v1',
      JSON.stringify([
        {
          id: 'x',
          domain: 'a.com',
          analyzedAt: 'now',
          savedAt: 'now',
          category: 'suspicious',
          summary: '',
          report: { broken: true },
        },
        { junk: 1 },
      ]),
    );
    const list = loadHistory();
    expect(list).toHaveLength(1);
    expect(getSavedReport(list[0])).toBeNull();
  });
});
