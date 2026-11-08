import { Controller, Get, Header, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Health } from '@radarjob/shared';
import { AI_SERVICE, AiService } from '../ai/ai.service';
import { REPORT_STORE, type ReportStore } from '../analysis/report-store';
import {
  DOMAIN_INTEL_PROVIDER,
  type DomainIntelProvider,
} from '../domain-intelligence/domain-intel.provider';
import { PAGE_INSPECTOR, type PageInspector } from '../page-inspection/page-inspection.service';
import { REPUTATION_PROVIDER, type ReputationProvider } from '../virustotal/reputation.provider';
import { WEBCHECK_PROVIDER, type WebCheckProvider } from '../webcheck/webcheck.service';

/** Reports which integrations are configured — never secrets or their values. */
@Controller('health')
@SkipThrottle({ analysis: true })
export class HealthController {
  constructor(
    @Inject(REPUTATION_PROVIDER) private readonly vt: ReputationProvider,
    @Inject(DOMAIN_INTEL_PROVIDER) private readonly domain: DomainIntelProvider,
    @Inject(AI_SERVICE) private readonly ai: AiService,
    @Inject(PAGE_INSPECTOR) private readonly page: PageInspector,
    @Inject(WEBCHECK_PROVIDER) private readonly webCheck: WebCheckProvider,
    @Inject(REPORT_STORE) private readonly store: ReportStore,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  health(): Health {
    return {
      status: 'ok',
      time: new Date().toISOString(),
      integrations: {
        virustotal: this.vt.mode,
        domainIntelligence: this.domain.mode,
        domainProvider: this.domain.providerName,
        ai: this.ai.mode,
        aiProvider: this.ai.providerLabel,
        pageInspection: this.page.enabled ? 'enabled' : 'disabled',
        webCheck: this.webCheck.mode,
        persistence: this.store.kind,
      },
    };
  }
}
