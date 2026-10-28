import { describe, expect, it } from 'vitest';
import { redactPersonalData } from '../common/redact';
import { analyzeJobAdText } from './job-ad.rules';

/** FICTIONAL recruitment messages used as test data. */
const cats = (t: string) => analyzeJobAdText(t).map((i) => i.category);

describe('job advert rules', () => {
  it('detects upfront fees in English and Swahili, with quoted evidence', () => {
    const r = analyzeJobAdText(
      'Congratulations on being shortlisted. Pay KES 1,500 registration fee to till 512345 today.',
    );
    const fee = r.find((i) => i.category === 'upfront_fee');
    expect(fee?.severity).toBe('strong');
    expect(fee?.evidence).toContain('registration fee');
    expect(cats('Tafadhali lipa ada ya usajili kabla ya Ijumaa.')).toContain('upfront_fee');
  });

  it('detects requests for PINs and one-time codes', () => {
    expect(cats('Please send the 6-digit code we sent to your phone.')).toContain(
      'secret_credentials',
    );
    expect(cats('Confirm your M-PESA PIN for payroll setup.')).toContain('secret_credentials');
  });

  it('detects money-mule and task-deposit patterns', () => {
    expect(
      cats(
        'You will receive client payments on your account and forward the funds to our regional account.',
      ),
    ).toContain('money_transfer');
    expect(cats('Top up your account to unlock VIP tasks.')).toContain('deposit_to_earn');
  });

  it('detects urgency, secrecy, chat-only contact and free email', () => {
    const c = cats(
      'URGENT: limited slots. Do not tell anyone about this offer. WhatsApp us or email hr.jobs@gmail.com',
    );
    expect(c).toEqual(
      expect.arrayContaining(['urgency', 'secrecy', 'chat_only_contact', 'free_email_recruiter']),
    );
  });

  it('finds no red flags in an ordinary advert', () => {
    expect(
      cats(
        'Acme Logistics is hiring a warehouse supervisor in Nakuru. Requirements: diploma and 2 years of experience. Apply through our careers page by 30 November.',
      ),
    ).toEqual([]);
  });

  it('redacts phone numbers in evidence', () => {
    const r = analyzeJobAdText('Send KES 500 to 0712 345 678 to book your interview.');
    expect(r[0].evidence).toContain('[phone]');
    expect(r[0].evidence).not.toContain('345 678');
  });
});

describe('redactPersonalData', () => {
  it('removes phones, emails and ID-like numbers but keeps amounts', () => {
    const out = redactPersonalData(
      'Call +254 712 345 678 or 0712345678, email a.b@c.co.ke, ID 12345678. Fee KES 1,500.',
    );
    expect(out).not.toMatch(/712|a\.b@|12345678/);
    expect(out).toContain('KES 1,500');
  });
});
