import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import type { JobAdReport } from '@radarjob/shared';
import { JobAdAnalysisDto } from '../analysis/analysis.dto';
import { JobAdService } from './job-ad.service';

@Controller('job-ad-analysis')
export class JobAdController {
  constructor(private readonly jobAds: JobAdService) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  analyze(@Body() dto: JobAdAnalysisDto): Promise<JobAdReport> {
    return this.jobAds.analyze(dto.text);
  }
}
