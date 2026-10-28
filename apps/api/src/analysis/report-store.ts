import { Logger } from '@nestjs/common';
import type { AnalysisReport } from '@radarjob/shared';

/**
 * Where analysis reports live while they are viewable at /report/:id.
 * Stored reports are already privacy-minimised: no query strings, no raw job
 * advert text, no IP addresses. Records expire after the retention period.
 */
export interface ReportStore {
  readonly kind: 'postgres' | 'memory';
  save(report: AnalysisReport, registeredDomain: string | null): Promise<void>;
  get(id: string): Promise<AnalysisReport | null>;
  delete(id: string): Promise<boolean>;
  purgeExpired(): Promise<number>;
  close?(): Promise<void>;
}

export const REPORT_STORE = Symbol('REPORT_STORE');

export class InMemoryReportStore implements ReportStore {
  readonly kind = 'memory' as const;
  private readonly map = new Map<string, { report: AnalysisReport; expiresAt: number }>();

  constructor(
    private readonly retentionMs: number,
    private readonly maxEntries = 5000,
    private readonly now: () => number = Date.now,
  ) {}

  async save(report: AnalysisReport): Promise<void> {
    const existing = this.map.get(report.id);
    this.map.delete(report.id);
    this.map.set(report.id, {
      report: structuredClone(report),
      expiresAt: existing?.expiresAt ?? this.now() + this.retentionMs,
    });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  async get(id: string): Promise<AnalysisReport | null> {
    const hit = this.map.get(id);
    if (!hit) return null;
    if (hit.expiresAt <= this.now()) {
      this.map.delete(id);
      return null;
    }
    return structuredClone(hit.report);
  }

  async delete(id: string): Promise<boolean> {
    return this.map.delete(id);
  }

  async purgeExpired(): Promise<number> {
    let n = 0;
    for (const [id, v] of this.map) {
      if (v.expiresAt <= this.now()) {
        this.map.delete(id);
        n++;
      }
    }
    return n;
  }
}

/** Minimal shape of the Prisma delegate we use (keeps this file testable without a database). */
interface AnalysisRecordDelegate {
  upsert(args: {
    where: { id: string };
    create: {
      id: string;
      registeredDomain: string | null;
      status: string;
      category: string | null;
      report: object;
      expiresAt: Date;
    };
    update: { status: string; category: string | null; report: object };
  }): Promise<unknown>;
  findUnique(args: { where: { id: string } }): Promise<{ report: unknown; expiresAt: Date } | null>;
  deleteMany(args: {
    where: { id?: string; expiresAt?: { lte: Date } };
  }): Promise<{ count: number }>;
}

export interface PrismaLike {
  analysisRecord: AnalysisRecordDelegate;
  $disconnect(): Promise<void>;
}

export class PrismaReportStore implements ReportStore {
  readonly kind = 'postgres' as const;
  private readonly logger = new Logger('ReportStore');

  constructor(
    private readonly prisma: PrismaLike,
    private readonly retentionMs: number,
  ) {}

  async save(report: AnalysisReport, registeredDomain: string | null): Promise<void> {
    const data = JSON.parse(JSON.stringify(report)) as object;
    await this.prisma.analysisRecord.upsert({
      where: { id: report.id },
      create: {
        id: report.id,
        registeredDomain,
        status: report.status,
        category: report.assessment?.category ?? null,
        report: data,
        expiresAt: new Date(Date.now() + this.retentionMs),
      },
      update: {
        status: report.status,
        category: report.assessment?.category ?? null,
        report: data,
      },
    });
  }

  async get(id: string): Promise<AnalysisReport | null> {
    const row = await this.prisma.analysisRecord.findUnique({ where: { id } });
    if (!row || row.expiresAt.getTime() <= Date.now()) return null;
    return row.report as AnalysisReport;
  }

  async delete(id: string): Promise<boolean> {
    const r = await this.prisma.analysisRecord.deleteMany({ where: { id } });
    return r.count > 0;
  }

  async purgeExpired(): Promise<number> {
    const r = await this.prisma.analysisRecord.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    if (r.count) this.logger.log(`purged ${r.count} expired report(s)`);
    return r.count;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
