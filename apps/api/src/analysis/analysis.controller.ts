import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { AnalysisReport, CreateAnalysisResponse } from '@radarjob/shared';
import { CreateAnalysisDto } from './analysis.dto';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  /** Start an analysis. Returns 202 with an id; poll GET /api/analysis/:id for progress. */
  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  create(@Body() dto: CreateAnalysisDto): Promise<CreateAnalysisResponse> {
    return this.analysis.start(dto.url, dto.jobAdText);
  }

  @Get(':id')
  @SkipThrottle({ analysis: true })
  @Header('Cache-Control', 'no-store')
  get(@Param('id') id: string): Promise<AnalysisReport> {
    return this.analysis.get(id);
  }
}
