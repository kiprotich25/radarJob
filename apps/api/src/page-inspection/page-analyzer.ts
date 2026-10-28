import { parse, type HTMLElement } from 'node-html-parser';
import { parse as parseDomain } from 'tldts';
import type { Indicator } from '@radarjob/shared';
import { cleanText, redactPersonalData } from '../common/redact';
import { BRANDS } from '../url-analysis/brands';

/**
 * Static analysis of fetched HTML. Nothing is executed: scripts and styles are
 * discarded, forms are counted but never submitted. Extracted text is treated
 * as untrusted data.
 */

export interface PageFacts {
  title: string;
  /** Redacted, length-capped visible text — the only page content ever sent to the AI provider. */
  textExcerpt: string;
  formCount: number;
  passwordFields: number;
  sensitiveFieldHints: string[];
  externalFormTargets: string[];
  metaRefresh: boolean;
}

const SENSITIVE_FIELD_PATTERNS: Array<[RegExp, string]> = [
  [
    /\b(otp|one[\s_-]?time|verification[\s_-]?code|auth[\s_-]?code|sms[\s_-]?code)\b/i,
    'one-time code',
  ],
  [/\b(m-?pesa[\s_-]?pin|pin[\s_-]?(number|code)?|atm[\s_-]?pin)\b/i, 'PIN'],
  [/\b(cvv|cvc|card[\s_-]?(number|no)|expiry|exp[\s_-]?date)\b/i, 'payment card'],
  [/\b(bank[\s_-]?account|account[\s_-]?number|iban|routing)\b/i, 'bank account'],
  [/\b(national[\s_-]?id|id[\s_-]?(number|no)|passport|kra[\s_-]?pin)\b/i, 'identity number'],
];

function attrs(el: HTMLElement): string {
  return ['name', 'id', 'placeholder', 'aria-label', 'autocomplete']
    .map((a) => el.getAttribute(a) ?? '')
    .join(' ');
}

export function extractPageFacts(html: string, pageRegisteredDomain: string | null): PageFacts {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: false, style: false, noscript: false, pre: true },
  });
  root
    .querySelectorAll('script, style, noscript, template, svg, iframe')
    .forEach((n) => n.remove());

  const title = cleanText(root.querySelector('title')?.text ?? '', 160);
  const forms = root.querySelectorAll('form');
  const inputs = root.querySelectorAll('input, select, textarea');
  const passwordFields = inputs.filter(
    (i) => (i.getAttribute('type') ?? '').toLowerCase() === 'password',
  ).length;

  const hints = new Set<string>();
  for (const input of inputs) {
    const label = input.id
      ? (root.querySelector(`label[for="${input.id.replace(/"/g, '')}"]`)?.text ?? '')
      : '';
    const text = `${attrs(input)} ${label}`;
    for (const [re, name] of SENSITIVE_FIELD_PATTERNS) if (re.test(text)) hints.add(name);
  }

  const externalTargets = new Set<string>();
  for (const f of forms) {
    const action = f.getAttribute('action');
    if (!action || !/^https?:\/\//i.test(action)) continue;
    try {
      const target = parseDomain(new URL(action).hostname).domain;
      if (target && pageRegisteredDomain && target !== pageRegisteredDomain)
        externalTargets.add(target);
    } catch {
      /* ignore malformed action */
    }
  }

  const metaRefresh = root
    .querySelectorAll('meta')
    .some((m) => (m.getAttribute('http-equiv') ?? '').toLowerCase() === 'refresh');

  const body = root.querySelector('body') ?? root;
  const text = redactPersonalData(cleanText(body.structuredText ?? body.text, 4000));

  return {
    title,
    textExcerpt: text,
    formCount: forms.length,
    passwordFields,
    sensitiveFieldHints: [...hints],
    externalFormTargets: [...externalTargets].slice(0, 5),
    metaRefresh,
  };
}

const FEE_PATTERNS = [
  /\b(registration|processing|application|interview|training|medical|clearance|booking|onboarding|placement|uniform|activation)\s+fee\b/i,
  /\b(pay|send|deposit|lipa)\s+(ksh\.?|kes|sh\.?|usd|\$)\s?[\d,]+/i,
  /\b(till|paybill|pay\s?bill)\s*(number|no\.?)?\s*:?\s*\d{5,7}\b/i,
  /\bada\s+ya\s+(usajili|maombi)\b/i,
];

function snippetAround(text: string, re: RegExp): string | undefined {
  const m = re.exec(text);
  if (!m) return undefined;
  const start = Math.max(0, m.index - 50);
  return `…${text.slice(start, m.index + m[0].length + 50).trim()}…`;
}

export function pageIndicators(
  facts: PageFacts,
  registeredDomain: string | null,
  impersonatedBrands: string[],
): Indicator[] {
  const out: Indicator[] = [];
  const add = (i: Omit<Indicator, 'id' | 'source'>) =>
    out.push({ id: `page-${out.length + 1}`, source: 'page', ...i });

  // Page claims to be a brand that does not own this domain.
  const titleLower = facts.title.toLowerCase();
  const claimed = BRANDS.find(
    (b) =>
      b.tokens.some(
        (t) => t.length > 4 && titleLower.replace(/\s+/g, '').includes(t.replace(/-/g, '')),
      ) &&
      !(
        registeredDomain &&
        (b.official.includes(registeredDomain) ||
          (b.officialSuffix && registeredDomain.endsWith(b.officialSuffix)))
      ),
  );
  if (claimed) {
    add({
      dimension: 'link',
      category: 'page_brand_mismatch',
      title: `The page title presents itself as "${claimed.name}", but the site is not one of its known domains`,
      evidence: `Title: "${facts.title}"`,
      whyItMatters:
        "Fake career sites copy a trusted organisation's name and branding while being hosted elsewhere.",
      basis: 'observed',
      severity: 'moderate',
      limitations: 'Job boards, news sites and partners legitimately mention employers by name.',
    });
  }

  const impersonating = impersonatedBrands.length > 0 || Boolean(claimed);
  if (facts.passwordFields > 0) {
    add({
      dimension: 'link',
      category: 'password_form',
      title: impersonating
        ? 'The page asks for a password while appearing to impersonate another organisation'
        : 'The page contains a password field',
      evidence: `${facts.passwordFields} password field(s) found`,
      whyItMatters: impersonating
        ? 'Collecting passwords on a look-alike site is the defining behaviour of a phishing page.'
        : 'Some applicant portals require accounts, but never reuse your email or social-media password on unfamiliar sites.',
      basis: 'observed',
      severity: impersonating ? 'strong' : 'weak',
    });
  }

  const critical = facts.sensitiveFieldHints.filter((h) => h === 'one-time code' || h === 'PIN');
  if (critical.length) {
    add({
      dimension: 'link',
      category: 'secret_code_request',
      title: 'The page has fields for a PIN or one-time code',
      evidence: `Fields referring to: ${critical.join(', ')}`,
      whyItMatters:
        'No genuine recruitment process needs your PIN or one-time codes. These are used to take over accounts and move money.',
      basis: 'observed',
      severity: 'strong',
    });
  }
  const financial = facts.sensitiveFieldHints.filter(
    (h) => h === 'payment card' || h === 'bank account',
  );
  if (financial.length) {
    add({
      dimension: 'offer',
      category: 'financial_details_request',
      title: 'The page asks for payment-card or bank details',
      evidence: `Fields referring to: ${financial.join(', ')}`,
      whyItMatters:
        'Employers do not need card details to consider an application. Bank details for payroll come after a verified contract.',
      basis: 'observed',
      severity: 'moderate',
    });
  }
  if (facts.sensitiveFieldHints.includes('identity number')) {
    add({
      dimension: 'offer',
      category: 'identity_request',
      title: 'The page asks for identity-document numbers',
      evidence: 'Fields referring to national ID, passport or KRA PIN',
      whyItMatters:
        'Identity numbers can be misused for loans or SIM swaps. Share them only with a verified employer.',
      basis: 'observed',
      severity: 'weak',
      limitations:
        'Some legitimate application forms, including public-service ones, ask for ID numbers.',
    });
  }

  if (facts.externalFormTargets.length && facts.passwordFields > 0) {
    add({
      dimension: 'link',
      category: 'external_form_target',
      title: 'A login form sends its data to a different website',
      evidence: facts.externalFormTargets.join(', '),
      whyItMatters:
        'Credentials submitted to an unrelated domain may be collected by a third party.',
      basis: 'observed',
      severity: 'moderate',
      limitations: 'Single sign-on services legitimately use other domains.',
    });
  }

  for (const re of FEE_PATTERNS) {
    const s = snippetAround(facts.textExcerpt, re);
    if (s) {
      add({
        dimension: 'offer',
        category: 'payment_request',
        title: 'The page text mentions paying a fee or sending money',
        evidence: s,
        whyItMatters:
          'Requests to pay for registration, interviews, training or processing are one of the most common job-scam patterns.',
        basis: 'observed',
        severity: 'moderate',
      });
      break;
    }
  }

  return out;
}
