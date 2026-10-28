import { Logger } from '@nestjs/common';
import { parse as parseDomain } from 'tldts';
import type { Indicator, PageCheck } from '@radarjob/shared';
import { cleanText } from '../common/redact';
import { extractPageFacts, pageIndicators, type PageFacts } from './page-analyzer';
import { safeFetch, type SafeFetchOptions } from './safe-fetch';
import { BlockedDestinationError } from './ssrf-guard';

export interface PageInspectionOutcome {
  check: PageCheck;
  indicators: Indicator[];
  facts?: PageFacts;
  /** Registered domain of the final page after redirects. */
  finalRegisteredDomain?: string | null;
}

export const PAGE_INSPECTOR = Symbol('PAGE_INSPECTOR');

export interface PageInspector {
  readonly enabled: boolean;
  inspect(normalizedUrl: string, impersonatedBrands: string[]): Promise<PageInspectionOutcome>;
}

export class DisabledPageInspector implements PageInspector {
  readonly enabled = false;
  async inspect(): Promise<PageInspectionOutcome> {
    return {
      check: {
        status: 'skipped',
        message:
          'Page-content inspection is disabled on this server. The webpage itself was not inspected.',
      },
      indicators: [],
    };
  }
}

export class SafePageInspector implements PageInspector {
  readonly enabled = true;
  private readonly logger = new Logger('PageInspection');

  constructor(private readonly opts: SafeFetchOptions) {}

  async inspect(
    normalizedUrl: string,
    impersonatedBrands: string[],
  ): Promise<PageInspectionOutcome> {
    try {
      const res = await safeFetch(normalizedUrl, this.opts);
      const finalHost = res.finalUrl.hostname;
      const finalDomain = parseDomain(finalHost).domain;
      const base = { finalHost, httpStatus: res.status, redirectCount: res.redirectCount };
      const redirectIndicators: Indicator[] = [];
      const startDomain = parseDomain(new URL(normalizedUrl).hostname).domain;
      if (res.redirectCount > 0 && finalDomain && startDomain && finalDomain !== startDomain) {
        redirectIndicators.push({
          id: 'page-redirect',
          source: 'page',
          dimension: 'link',
          category: 'cross_domain_redirect',
          title: `The link redirects to a different website (${finalDomain})`,
          evidence: `${startDomain} → ${finalDomain} after ${res.redirectCount} redirect(s)`,
          whyItMatters:
            'The page you land on is not the one named in the link. Judge the final site, not the link text.',
          basis: 'observed',
          severity: 'info',
          limitations: 'Shorteners and tracking links redirect legitimately.',
        });
      }

      if (res.kind === 'http_error') {
        return {
          check: {
            status: 'completed',
            ...base,
            message: `The website responded with HTTP ${res.status}; there was no page content to inspect.`,
          },
          indicators: redirectIndicators,
          finalRegisteredDomain: finalDomain,
        };
      }
      if (res.kind === 'not_html') {
        return {
          check: {
            status: 'completed',
            ...base,
            message:
              'The link does not lead to a web page (it may be a file download). Its content was not opened.',
          },
          indicators: redirectIndicators,
          finalRegisteredDomain: finalDomain,
        };
      }
      const facts = extractPageFacts(res.body ?? '', finalDomain);
      return {
        check: {
          status: 'completed',
          ...base,
          pageTitle: facts.title || undefined,
          passwordFields: facts.passwordFields,
          formCount: facts.formCount,
          message: res.truncated
            ? 'Only the first part of a very large page was inspected.'
            : undefined,
        },
        indicators: [
          ...redirectIndicators,
          ...pageIndicators(facts, finalDomain, impersonatedBrands),
        ],
        facts,
        finalRegisteredDomain: finalDomain,
      };
    } catch (e) {
      if (e instanceof BlockedDestinationError) {
        if (e.reason === 'timeout') {
          return {
            check: {
              status: 'unavailable',
              message: 'The website did not respond in time, so its content was not inspected.',
            },
            indicators: [],
          };
        }
        if (e.reason === 'DNS resolution failed' || e.reason === 'no DNS records') {
          return {
            check: {
              status: 'unavailable',
              message:
                'The website address could not be resolved — the site may be offline or no longer exist.',
            },
            indicators: [],
          };
        }
        this.logger.warn(`blocked destination: ${e.reason}`);
        return {
          check: {
            status: 'skipped',
            message: `For security reasons the page was not fetched (${cleanText(e.reason, 60)}).`,
          },
          indicators: [],
        };
      }
      this.logger.warn(`inspection failed: ${e instanceof Error ? e.name : 'error'}`);
      return {
        check: {
          status: 'unavailable',
          message: 'The website could not be reached, so its content was not inspected.',
        },
        indicators: [],
      };
    }
  }
}
