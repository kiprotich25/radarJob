import { Controller, Get, Header, HttpStatus, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { getGuide, QUIZ_QUESTIONS, searchGuides } from '@radarjob/shared';
import { ApiException } from '../common/api-error';

/** Educational content. Works without any external API credentials. */
@Controller('education')
@SkipThrottle({ analysis: true })
export class EducationController {
  @Get('guides')
  @Header('Cache-Control', 'public, max-age=3600')
  guides(@Query('q') q?: string) {
    const list = searchGuides(typeof q === 'string' ? q.slice(0, 100) : '');
    return {
      guides: list.map(({ slug, title, summary, readingMinutes, tags }) => ({
        slug,
        title,
        summary,
        readingMinutes,
        tags,
      })),
    };
  }

  @Get('guides/:slug')
  @Header('Cache-Control', 'public, max-age=3600')
  guide(@Param('slug') slug: string) {
    const g = getGuide(slug);
    if (!g) throw new ApiException(HttpStatus.NOT_FOUND, 'not_found', 'Guide not found.');
    return g;
  }

  @Get('quiz')
  @Header('Cache-Control', 'public, max-age=3600')
  quiz() {
    return { questions: QUIZ_QUESTIONS };
  }
}
