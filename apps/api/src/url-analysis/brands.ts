/**
 * Curated list of organisations commonly impersonated in recruitment scams,
 * with their official registered domains. The list is intentionally partial and
 * conservative: an organisation missing here is simply not checked for
 * impersonation. Update it as new impersonation patterns are observed.
 */
export interface Brand {
  name: string;
  /** Tokens to look for in hostnames. Short tokens only match whole hyphen/dot-separated segments. */
  tokens: string[];
  /** Registered domains owned by the organisation (exact match). */
  official: string[];
  /** Any registered domain under this suffix is considered official (e.g. go.ke for government). */
  officialSuffix?: string;
  /** Typo-squatting comparison target (letters only). Omit for short names. */
  typoTarget?: string;
}

export const BRANDS: Brand[] = [
  {
    name: 'Safaricom',
    tokens: ['safaricom'],
    official: ['safaricom.co.ke', 'safaricom.com'],
    typoTarget: 'safaricom',
  },
  {
    name: 'M-PESA (Safaricom)',
    tokens: ['mpesa', 'm-pesa'],
    official: ['safaricom.co.ke', 'safaricom.com'],
  },
  {
    name: 'Airtel',
    tokens: ['airtel'],
    official: ['airtel.co.ke', 'airtel.africa', 'airtel.com', 'airtel.in'],
    typoTarget: 'airtel',
  },
  {
    name: 'Equity Bank',
    tokens: ['equitybank', 'equity-bank'],
    official: ['equitybank.co.ke', 'equitygroupholdings.com'],
    typoTarget: 'equitybank',
  },
  {
    name: 'KCB Group',
    tokens: ['kcbgroup', 'kcbbank', 'kcb-bank'],
    official: ['kcbgroup.com'],
    typoTarget: 'kcbgroup',
  },
  { name: 'Co-operative Bank', tokens: ['coopbank', 'co-opbank'], official: ['co-opbank.co.ke'] },
  {
    name: 'Kenya Airways',
    tokens: ['kenyaairways', 'kenya-airways'],
    official: ['kenya-airways.com'],
    typoTarget: 'kenyaairways',
  },
  { name: 'Kenya Power', tokens: ['kplc', 'kenyapower', 'kenya-power'], official: ['kplc.co.ke'] },
  { name: 'Kenya Revenue Authority', tokens: ['kra'], official: [], officialSuffix: 'go.ke' },
  {
    name: 'eCitizen',
    tokens: ['ecitizen', 'e-citizen'],
    official: [],
    officialSuffix: 'go.ke',
    typoTarget: 'ecitizen',
  },
  {
    name: 'Public Service Commission of Kenya',
    tokens: ['publicservice'],
    official: [],
    officialSuffix: 'go.ke',
  },
  { name: 'Kenya Defence Forces', tokens: ['kdf'], official: [], officialSuffix: 'go.ke' },
  {
    name: 'National Police Service',
    tokens: ['nationalpolice', 'kenyapolice'],
    official: [],
    officialSuffix: 'go.ke',
  },
  { name: 'NSSF', tokens: ['nssf'], official: ['nssf.or.ke'] },
  {
    name: 'LinkedIn',
    tokens: ['linkedin'],
    official: ['linkedin.com', 'lnkd.in'],
    typoTarget: 'linkedin',
  },
  {
    name: 'BrighterMonday',
    tokens: ['brightermonday'],
    official: ['brightermonday.co.ke', 'brightermonday.com'],
    typoTarget: 'brightermonday',
  },
  { name: 'Fuzu', tokens: ['fuzu'], official: ['fuzu.com'] },
  {
    name: 'MyJobMag',
    tokens: ['myjobmag'],
    official: ['myjobmag.co.ke', 'myjobmag.com'],
    typoTarget: 'myjobmag',
  },
  { name: 'Indeed', tokens: ['indeed'], official: ['indeed.com'], typoTarget: 'indeed' },
  {
    name: 'Glassdoor',
    tokens: ['glassdoor'],
    official: ['glassdoor.com'],
    typoTarget: 'glassdoor',
  },
  {
    name: 'Google',
    tokens: ['google'],
    official: [
      'google.com',
      'google.co.ke',
      'google.org',
      'goo.gl',
      'g.co',
      'forms.gle',
      'googleusercontent.com',
      'googleapis.com',
      'withgoogle.com',
    ],
    typoTarget: 'google',
  },
  {
    name: 'Microsoft',
    tokens: ['microsoft'],
    official: ['microsoft.com', 'microsoftonline.com', 'office.com', 'live.com'],
    typoTarget: 'microsoft',
  },
  {
    name: 'Amazon',
    tokens: ['amazon'],
    official: ['amazon.com', 'amazon.jobs', 'amazonaws.com'],
    typoTarget: 'amazon',
  },
  { name: 'PayPal', tokens: ['paypal'], official: ['paypal.com'], typoTarget: 'paypal' },
  { name: 'UNICEF', tokens: ['unicef'], official: ['unicef.org'], typoTarget: 'unicef' },
  { name: 'UNDP', tokens: ['undp'], official: ['undp.org'] },
  { name: 'UNHCR', tokens: ['unhcr'], official: ['unhcr.org'] },
  {
    name: 'World Bank',
    tokens: ['worldbank', 'world-bank'],
    official: ['worldbank.org'],
    typoTarget: 'worldbank',
  },
  { name: 'Unilever', tokens: ['unilever'], official: ['unilever.com'], typoTarget: 'unilever' },
  {
    name: 'Coca-Cola',
    tokens: ['cocacola', 'coca-cola'],
    official: ['coca-cola.com', 'coca-colacompany.com'],
    typoTarget: 'cocacola',
  },
  { name: 'Deloitte', tokens: ['deloitte'], official: ['deloitte.com'], typoTarget: 'deloitte' },
  { name: 'KPMG', tokens: ['kpmg'], official: ['kpmg.com'] },
  { name: 'PwC', tokens: ['pwc'], official: ['pwc.com'] },
  { name: 'DHL', tokens: ['dhl'], official: ['dhl.com'] },
  {
    name: 'Qatar Airways',
    tokens: ['qatarairways', 'qatar-airways'],
    official: ['qatarairways.com'],
    typoTarget: 'qatarairways',
  },
  {
    name: 'Emirates',
    tokens: ['emirates'],
    official: ['emirates.com', 'emiratesgroupcareers.com'],
    typoTarget: 'emirates',
  },
];

export const URL_SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'cutt.ly',
  'rb.gy',
  'is.gd',
  'ow.ly',
  'shorturl.at',
  'tiny.cc',
  'rebrand.ly',
  's.id',
  't.ly',
  'buff.ly',
  'bitly.com',
  'shorte.st',
  'v.gd',
  'lnkd.in',
  'goo.gl',
]);

/** Free website builders and form/hosting services. Legitimate uses are common; this is a weak signal. */
export const FREE_HOSTING_SUFFIXES = [
  'sites.google.com',
  'wixsite.com',
  'weebly.com',
  'blogspot.com',
  '000webhostapp.com',
  'netlify.app',
  'vercel.app',
  'github.io',
  'web.app',
  'firebaseapp.com',
  'pages.dev',
  'glitch.me',
  'ngrok-free.app',
  'ngrok.io',
  'ngrok.app',
  'repl.co',
  'replit.app',
  'webflow.io',
  'framer.website',
  'carrd.co',
  'jotform.com',
  'forms.gle',
  'typeform.com',
  'wordpress.com',
  'square.site',
  'mystrikingly.com',
  'godaddysites.com',
];

/** TLDs disproportionately used in abuse reports. Many legitimate sites use them too. */
export const FREQUENTLY_ABUSED_TLDS = new Set([
  'xyz',
  'top',
  'icu',
  'buzz',
  'click',
  'cfd',
  'sbs',
  'rest',
  'cyou',
  'monster',
  'quest',
  'bond',
  'lol',
  'mom',
  'zip',
  'mov',
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
]);
