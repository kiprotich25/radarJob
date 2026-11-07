import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { OFFER_CATEGORY_LABELS, type JobAdReport } from '@radarjob/shared';
import { AI_SERVICE, AiService } from '../ai/ai.service';
import { ApiException } from '../common/api-error';
import { redactPersonalData } from '../common/redact';
import { ENV, type Env } from '../config/env';
import { assessOfferIndicators } from '../risk-assessment/risk-engine';
import { analyzeJobAdText } from './job-ad.rules';

const LIMITATIONS = [
  'RadarJob analyses only the text you pasted. It did not contact the employer or check whether the job exists.',
  'Red flags are warning signs, not proof of fraud. A message without red flags can still be a scam.',
  'The text is not stored. Before it is sent to the AI provider, phone numbers, email addresses and long ID-like numbers are replaced with placeholders.',
];

/** Standalone analysis of a pasted job advert or recruiter message. Text is never stored. */
@Injectable()
export class JobAdService {
  constructor(
    @Inject(AI_SERVICE) private readonly ai: AiService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async analyze(rawText: string): Promise<JobAdReport> {
    const text = rawText.trim();
    if (text.length < 20) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'text_too_short',
        'Paste at least a sentence or two of the job advert or message.',
      );
    }
    const rules = analyzeJobAdText(text);
    const ai = await this.ai.analyzeJobAd(redactPersonalData(text), rules);
    const indicators = [...rules, ...ai.indicators];
    const { category, reasons } = assessOfferIndicators(indicators);

    const summary =
      category === 'no_significant_threats'
        ? 'RadarJob did not find common scam red flags in this text. That does not confirm the job is real — verify the employer through its official website before sharing documents or paying anything.'
        : `${OFFER_CATEGORY_LABELS[category]}. ${reasons.join(' ')}`;
    const actions =
      category === 'no_significant_threats'
        ? [
            "Confirm the vacancy on the employer's official website or by calling its official number.",
            'Never pay to apply and never share PINs, passwords or one-time codes.',
          ]
        : [
            'Do not pay any fee or share PINs, passwords, one-time codes or ID copies.',
            'Verify the employer and vacancy using contact details you find yourself, not those in the message.',
            'If an agency is involved, check that it is registered with the National Employment Authority.',
            'If you have already paid or shared details, see the RadarJob guides for recovery steps.',
          ];
    return {
      category,
      indicators,
      aiStatus: ai.status,
      explanation: {
        source: 'template',
        summary,
        whyItMatters: indicators.slice(0, 4).map((i) => `${i.title}: ${i.whyItMatters}`),
        recommendedActions: actions,
      },
      limitations: LIMITATIONS,
      simulated: this.env.DEV_MOCK_PROVIDERS,
    };
  }
}
