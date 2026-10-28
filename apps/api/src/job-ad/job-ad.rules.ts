import type { Indicator, Severity } from '@radarjob/shared';
import { redactPersonalData } from '../common/redact';

/**
 * Deterministic red-flag detection for pasted job adverts and recruiter messages.
 * Each rule returns the exact sentence that triggered it so users can see why.
 * Evidence snippets are redacted (phone numbers, emails, ID-like numbers) before
 * they are stored or shown.
 */

interface Rule {
  category: string;
  title: string;
  severity: Severity;
  whyItMatters: string;
  limitations?: string;
  patterns: RegExp[];
}

const AMOUNT = String.raw`(?:ksh\.?|kes|kshs\.?|sh\.?|shs\.?|usd|us\$|\$)\s?\d[\d,]*`;

export const JOB_AD_RULES: Rule[] = [
  {
    category: 'upfront_fee',
    title: 'Asks you to pay before you are hired',
    severity: 'strong',
    whyItMatters:
      'Paying for registration, interviews, training, medicals or "processing" before a verified contract is the most common job-scam pattern.',
    limitations:
      'Some lawful foreign-employment processes involve costs; confirm them with the National Employment Authority before paying anything.',
    patterns: [
      /\b(registration|processing|application|interview|training|medical|clearance|booking|onboarding|placement|uniform|activation|commitment|reservation|slot)\s+(fee|fees|charge|charges|cost)\b/i,
      new RegExp(String.raw`\b(pay|send|deposit|remit|lipa|tuma)\b[^.!?\n]{0,40}${AMOUNT}`, 'i'),
      new RegExp(
        String.raw`${AMOUNT}[^.!?\n]{0,40}\b(fee|to (?:secure|confirm|book|reserve))\b`,
        'i',
      ),
      /\b(till|paybill|pay\s?bill|buy\s?goods)\s*(number|no\.?|#)?\s*:?\s*\d{4,7}\b/i,
      /\b(secure|confirm|book|reserve)\s+(your|the)\s+(slot|position|place|interview)\b[^.!?\n]{0,40}\b(pay|fee|send)\b/i,
      /\bada\s+ya\s+(usajili|maombi|mahojiano)\b/i,
    ],
  },
  {
    category: 'secret_credentials',
    title: 'Asks for a PIN, password or one-time code',
    severity: 'strong',
    whyItMatters:
      'No genuine recruiter needs your PIN, password or one-time code. These are used to take over accounts and steal money.',
    patterns: [
      /\b(m-?pesa\s+pin|your\s+pin|pin\s+(number|code)|atm\s+pin)\b/i,
      /\b(otp|one[\s-]?time\s+(password|pin|code)|verification\s+code|the\s+code\s+(you|sent|we)|\d-digit\s+code)\b/i,
      /\b(send|share|give|forward)\b[^.!?\n]{0,30}\b(password|passcode)\b/i,
    ],
  },
  {
    category: 'money_transfer',
    title: 'Involves receiving or forwarding money through your account',
    severity: 'strong',
    whyItMatters:
      'Jobs that move money through your personal account are often money-mule schemes, which can expose you to criminal liability.',
    patterns: [
      /\b(receive|accept)\b[^.!?\n]{0,40}\b(payments?|funds|money)\b[^.!?\n]{0,60}\b(forward|transfer|send)\b/i,
      /\b(forward|transfer)\s+(the\s+)?(funds|money|payments?)\b/i,
      /\b(payment\s+processing\s+agent|transaction\s+coordinator|financial\s+(agent|assistant)\s+to\s+receive)\b/i,
      /\b(keep|earn)\s+\d{1,2}\s?%\s+(commission|of\s+(each|every))\b/i,
    ],
  },
  {
    category: 'deposit_to_earn',
    title: 'Requires a deposit or "top-up" to unlock work or earnings',
    severity: 'strong',
    whyItMatters:
      'Task scams pay small amounts first, then require deposits that are never returned.',
    patterns: [
      /\b(top[\s-]?up|recharge|deposit|upgrade)\b[^.!?\n]{0,40}\b(account|vip|level|tasks?|package|withdraw)\b/i,
      /\b(vip|premium)\s+(task|package|level|membership)\b/i,
    ],
  },
  {
    category: 'guaranteed_job',
    title: 'Guarantees employment or skips the normal selection process',
    severity: 'moderate',
    whyItMatters:
      'Real employers assess candidates. Guarantees and "no interview needed" are used to rush people into paying.',
    patterns: [
      /\b(guaranteed|100%)\s+(job|employment|placement|hiring|income)\b/i,
      /\bno\s+(interview|experience|qualifications?)\s+(needed|required|necessary)\b[^.!?\n]{0,40}\b(guarantee|immediately|start\s+today)\b/i,
      /\b(no\s+interview\s+(needed|required)|hired\s+immediately|instant(ly)?\s+hired)\b/i,
      /\byou\s+have\s+been\s+(selected|shortlisted|hired)\b/i,
    ],
    limitations:
      'Being told you are shortlisted is normal in genuine processes — it is a concern when you did not apply or it comes with a request for money.',
  },
  {
    category: 'unrealistic_pay',
    title: 'Promises unusually high or easy earnings',
    severity: 'moderate',
    whyItMatters:
      'Pay that is far above the market for little work or no experience is used as bait.',
    patterns: [
      new RegExp(
        String.raw`\b(earn|make|get)\b[^.!?\n]{0,25}${AMOUNT}[^.!?\n]{0,20}\b(per|a|every)\s+(day|daily|hour)\b`,
        'i',
      ),
      /\b(like|rate|review)\s+(videos?|posts?|hotels?|products?)\b[^.!?\n]{0,40}\b(earn|paid|pay)\b/i,
      /\b(work\s+from\s+home|online\s+job)\b[^.!?\n]{0,40}\b(no\s+experience)\b/i,
    ],
    limitations: 'Some genuine roles pay well; compare with similar adverts from known employers.',
  },
  {
    category: 'urgency',
    title: 'Creates pressure to act quickly',
    severity: 'weak',
    whyItMatters: 'Deadlines and "limited slots" stop people from checking the offer.',
    patterns: [
      /\b(urgent(ly)?|immediately|asap|today\s+only|within\s+\d+\s+(minutes|hours)|before\s+\d{1,2}\s?(am|pm)|limited\s+(slots|positions|spaces)|few\s+slots|last\s+chance|deadline\s+is\s+today)\b/i,
    ],
    limitations:
      'Genuine adverts also have deadlines; urgency matters most alongside other red flags.',
  },
  {
    category: 'secrecy',
    title: 'Asks you to keep the offer secret',
    severity: 'moderate',
    whyItMatters:
      'Secrecy prevents you from getting advice from people who might recognise a scam.',
    patterns: [
      /\b(do\s+not|don'?t)\s+(tell|share|disclose|inform)\b[^.!?\n]{0,40}\b(anyone|others|this\s+offer|family|friends)\b/i,
      /\bkeep\s+(this|it)\s+(confidential|secret|private)\b/i,
    ],
  },
  {
    category: 'chat_only_contact',
    title: 'Recruitment happens only through WhatsApp or Telegram',
    severity: 'weak',
    whyItMatters: 'Moving applicants to private chat apps makes the recruiter harder to verify.',
    patterns: [/\b(whatsapp|telegram|t\.me\/|wa\.me\/)\b/i],
    limitations: 'Some small employers do use WhatsApp. Verify the business independently.',
  },
  {
    category: 'free_email_recruiter',
    title: 'Uses a free email address for an organisation',
    severity: 'weak',
    whyItMatters: 'Established organisations normally recruit from their own email domain.',
    patterns: [
      /\b[A-Z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|ymail|proton(mail)?|aol)\.[a-z.]{2,6}\b/i,
    ],
    limitations: 'Small businesses sometimes use free email providers.',
  },
  {
    category: 'sensitive_documents_early',
    title: 'Requests identity documents or bank details early',
    severity: 'moderate',
    whyItMatters:
      'ID copies, selfies with ID and bank details can be used for fraud in your name. Share them only after verifying the employer.',
    patterns: [
      /\b(send|share|upload|attach|submit)\b[^.!?\n]{0,40}\b(copy\s+of\s+(your\s+)?id|national\s+id|id\s+card|passport|selfie|bank\s+(details|statement|account)|kra\s+pin)\b/i,
    ],
    limitations: 'Genuine employers request documents after an offer, through official channels.',
  },
  {
    category: 'equipment_purchase',
    title: 'Requires you to buy equipment, software or training',
    severity: 'moderate',
    whyItMatters:
      'Fake remote jobs make money by selling "starter kits" or software through the employer\'s chosen supplier.',
    patterns: [
      /\b(buy|purchase|pay\s+for)\b[^.!?\n]{0,40}\b(starter\s+kit|software|licen[cs]e|laptop|equipment|training\s+(materials?|course))\b/i,
    ],
  },
];

function sentenceAround(text: string, index: number, length: number): string {
  const before = text.lastIndexOf('\n', index);
  const startSentence = Math.max(
    text.lastIndexOf('.', index - 1),
    text.lastIndexOf('!', index - 1),
    text.lastIndexOf('?', index - 1),
    before,
  );
  let start = startSentence + 1;
  if (index - start > 120) start = index - 120;
  const endCandidates = ['.', '!', '?', '\n']
    .map((c) => text.indexOf(c, index + length))
    .filter((i) => i >= 0);
  let end = endCandidates.length ? Math.min(...endCandidates) + 1 : text.length;
  if (end - (index + length) > 120) end = index + length + 120;
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function analyzeJobAdText(text: string): Indicator[] {
  const out: Indicator[] = [];
  for (const rule of JOB_AD_RULES) {
    for (const re of rule.patterns) {
      const m = re.exec(text);
      if (!m) continue;
      out.push({
        id: `job-${rule.category}`,
        source: 'job_ad',
        dimension: 'offer',
        category: rule.category,
        title: rule.title,
        evidence:
          rule.category === 'free_email_recruiter'
            ? `A contact address on the free email service "${m[1].toLowerCase()}"`
            : `"${redactPersonalData(sentenceAround(text, m.index, m[0].length)).slice(0, 220)}"`,
        whyItMatters: rule.whyItMatters,
        basis: 'observed',
        severity: rule.severity,
        limitations: rule.limitations,
      });
      break;
    }
  }
  return out;
}
