import { FlaskConical, History } from 'lucide-react';
import type { AnalysisReport } from '@radarjob/shared';
import { formatDateTime } from '@/lib/format';
import { Panel } from '../ui/panel';
import { AIExplanation } from './ai-explanation';
import { AnalysisProgress } from './analysis-progress';
import { DetectionSummary } from './detection-summary';
import { DomainInformation } from './domain-information';
import { EvidenceList } from './evidence-list';
import { LimitationsNotice } from './limitations-notice';
import { RecommendedActions } from './recommended-actions';
import { RiskAssessmentBanner } from './risk-assessment-banner';
import { SiteSecurity } from './site-security';

export function SimulatedNotice() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-[var(--radius-panel)] border-2 border-dashed border-caution bg-caution-wash p-4"
    >
      <FlaskConical aria-hidden className="mt-0.5 size-5 shrink-0 text-caution" />
      <p className="text-ink">
        <strong>Simulated report.</strong> This server is running development mock providers. None
        of the data below comes from real security services.
      </p>
    </div>
  );
}

export function HistoricalNotice({ analyzedAt }: { analyzedAt: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-rule-strong bg-unknown-wash p-4"
    >
      <History aria-hidden className="mt-0.5 size-5 shrink-0 text-unknown" />
      <p className="text-ink">
        <strong>Saved report from {formatDateTime(analyzedAt)}.</strong> This is a historical copy
        stored on this device, not a fresh scan. The website may have changed since then.
      </p>
    </div>
  );
}

/** A completed report. Facts (findings, evidence) are kept visibly separate from the explanation. */
export function ReportBody({ report }: { report: AnalysisReport }) {
  const a = report.assessment!;
  const link = report.indicators.filter((i) => i.dimension === 'link');
  const offer = report.indicators.filter((i) => i.dimension === 'offer');
  return (
    <div className="space-y-5">
      <RiskAssessmentBanner assessment={a} domain={report.input.unicodeHostname} />
      {report.explanation && (
        <AIExplanation explanation={report.explanation} conflicts={a.conflicts} />
      )}
      {report.explanation && <RecommendedActions actions={report.explanation.recommendedActions} />}

      <Panel
        title="What we found"
        description="Observed facts from each check, followed by every warning sign and why it may matter."
      >
        {report.findings.length > 0 && (
          <ul className="mb-6 space-y-2">
            {report.findings.map((f) => (
              <li key={f} className="flex gap-2 text-ink">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink" />
                {f}
              </li>
            ))}
          </ul>
        )}
        <h3 className="mb-3 font-semibold text-ink">Signals about the link</h3>
        <EvidenceList
          indicators={link}
          emptyText="No warning signs were found in the link checks that ran."
        />
        {(report.input.jobAdSupplied || offer.length > 0) && (
          <>
            <h3 className="mt-8 mb-3 font-semibold text-ink">Signals about the job offer</h3>
            <EvidenceList
              indicators={offer}
              emptyText="No common scam red flags were found in the job text."
            />
          </>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetectionSummary vt={report.checks.virustotal} />
        <DomainInformation domain={report.checks.domain} />
      </div>
      {report.checks.webCheck && report.checks.webCheck.status !== 'not_configured' && (
        <SiteSecurity check={report.checks.webCheck} />
      )}

      <LimitationsNotice unknowns={report.unknowns} limitations={report.limitations} />
      <AnalysisProgress report={report} title="Checks performed" />
      <p className="text-sm text-ink-faint">
        Report ID {report.id}. Analysed {formatDateTime(report.completedAt ?? report.createdAt)}.
        Assessment rules version {a.rulesVersion}.
      </p>
    </div>
  );
}
