import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JOB_AD_MAX_LENGTH, MAX_URL_LENGTH } from '@radarjob/shared';

export class CreateAnalysisDto {
  @IsString()
  @MaxLength(MAX_URL_LENGTH + 100)
  url!: string;

  /** Optional job advert or recruiter message. Not stored. */
  @IsOptional()
  @IsString()
  @MaxLength(JOB_AD_MAX_LENGTH)
  jobAdText?: string;
}

export class JobAdAnalysisDto {
  @IsString()
  @MaxLength(JOB_AD_MAX_LENGTH)
  text!: string;
}
