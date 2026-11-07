import type { Indicator, NormalizedUrl } from '@radarjob/shared';
import {
  BRANDS,
  FREE_HOSTING_SUFFIXES,
  FREQUENTLY_ABUSED_TLDS,
  URL_SHORTENERS,
  type Brand,
} from './brands';

/**
 * Deterministic, explainable URL-structure analysis. Every indicator records
 * what was observed, why it may matter, and its limitations. These are warning
 * signals, not proof: the website content is not examined here.
 */

/** Damerau–Levenshtein (optimal string alignment) distance. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Map visually confusable characters (digits, Cyrillic/Greek look-alikes) to Latin letters. */
const CONFUSABLES: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  '3': 'e',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'y',
  х: 'x',
  і: 'i',
  ј: 'j',
  ѕ: 's',
  ԁ: 'd',
  ɡ: 'g',
  ӏ: 'l',
  һ: 'h',
  ո: 'n',
  ս: 'u',
  ν: 'v',
  ο: 'o',
  α: 'a',
  ρ: 'p',
  κ: 'k',
  τ: 't',
  ι: 'i',
  м: 'm',
  т: 't',
  к: 'k',
  в: 'b',
  н: 'h',
};

export function skeleton(s: string): string {
  return [...s.toLowerCase()]
    .map((c) => CONFUSABLES[c] ?? c)
    .join('')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w');
}

function scriptOf(ch: string): 'latin' | 'cyrillic' | 'greek' | 'other' | 'neutral' {
  if (/[a-z]/i.test(ch)) return 'latin';
  if (/[Ѐ-ӿ]/.test(ch)) return 'cyrillic';
  if (/[Ͱ-Ͽ]/.test(ch)) return 'greek';
  if (/[0-9\-_.]/.test(ch)) return 'neutral';
  return 'other';
}

export function hasMixedScripts(label: string): boolean {
  const scripts = new Set([...label].map(scriptOf).filter((s) => s !== 'neutral'));
  return scripts.size > 1;
}

/** Government-only endings: .go.ke and foreign equivalents such as .gov, .gov.uk or .go.ug. */
export function isGovernmentDomain(registeredDomain: string | null): boolean {
  return Boolean(
    registeredDomain &&
    /\.(gov|mil)$|\.(gov|govt|go|gob|gouv|mil)\.[a-z]{2}$/.test(registeredDomain),
  );
}

/** Does the address present itself as Kenyan government? `text` is the hostname without its public suffix. */
function looksLikeKenyanGovernment(host: string, text: string, suffix: string): boolean {
  if (/(^|[.\-_])gov?[.\-_]ke([.\-_]|$)/.test(host)) return true;
  const segments = text.split(/[.\-_]/);
  if (segments.some((s) => ['gov', 'govt', 'government', 'serikali'].includes(s))) return true;
  const compact = segments.join('');
  if (/govke|govkenya|kenyagov|governmentofkenya|republicofkenya/.test(compact)) return true;
  const kenyan = compact.includes('kenya') || suffix === 'ke' || suffix.endsWith('.ke');
  return (
    kenyan &&
    (compact.includes('ministryof') ||
      compact.includes('countygov') ||
      segments.some((s) => s.endsWith('county')))
  );
}

export function isOfficial(brand: Brand, registeredDomain: string | null): boolean {
  if (!registeredDomain) return false;
  if (brand.official.includes(registeredDomain)) return true;
  if (
    brand.officialSuffix &&
    (registeredDomain === brand.officialSuffix ||
      registeredDomain.endsWith(`.${brand.officialSuffix}`))
  ) {
    return true;
  }
  return false;
}

/** Does `text` contain `token`? Tokens ≤ 4 chars must be a whole hyphen/dot/underscore-separated segment. */
function containsToken(text: string, token: string): boolean {
  if (token.length <= 4) return text.split(/[.\-_]/).includes(token);
  return text.includes(token);
}

let counter = 0;
const ind = (i: Omit<Indicator, 'id' | 'source' | 'dimension'>): Indicator => ({
  id: `url-${++counter}`,
  source: 'url_heuristic',
  dimension: 'link',
  ...i,
});

export interface UrlHeuristicsResult {
  indicators: Indicator[];
  impersonatedBrands: string[];
}

export function analyzeUrlStructure(u: NormalizedUrl): UrlHeuristicsResult {
  counter = 0;
  const out: Indicator[] = [];
  const impersonated = new Set<string>();
  const host = u.hostname;
  const reg = u.registeredDomain;
  const suffix = u.publicSuffix ?? '';
  const sld = reg && suffix ? reg.slice(0, -(suffix.length + 1)) : '';
  const subdomain =
    reg && host.length > reg.length ? host.slice(0, host.length - reg.length - 1) : '';
  const unicodeLabels = u.unicodeHostname.split('.');

  if (u.isIp) {
    out.push(
      ind({
        category: 'ip_address_host',
        title: 'The link uses a raw IP address instead of a domain name',
        evidence: host,
        whyItMatters:
          'Genuine employers almost always use a named website. IP-address links are often used to avoid domain-based blocking or to hide who runs the site.',
        basis: 'observed',
        severity: 'moderate',
        limitations:
          'Some internal or test systems use IP addresses legitimately, but they are rarely shared publicly for recruitment.',
      }),
    );
  }

  if (u.hadCredentials) {
    out.push(
      ind({
        category: 'credentials_in_url',
        title: 'The link contains an "@" trick that disguises the real website',
        evidence: `The real destination is ${u.unicodeHostname}; text before "@" is ignored by browsers.`,
        whyItMatters:
          'Text before "@" in a web address is not the website. Scammers use this to make a link appear to belong to a trusted company.',
        basis: 'observed',
        severity: 'moderate',
      }),
    );
  }

  // Homograph / mixed-script look-alikes (e.g. Cyrillic "а" in place of Latin "a").
  for (const label of unicodeLabels) {
    if (!hasMixedScripts(label)) continue;
    const sk = skeleton(label);
    const brand = BRANDS.find(
      (b) => b.tokens.some((t) => sk.includes(t.replace(/-/g, ''))) && !isOfficial(b, reg),
    );
    if (brand) impersonated.add(brand.name);
    out.push(
      ind({
        category: 'homograph',
        title: brand
          ? `Look-alike characters imitate "${brand.name}"`
          : 'The domain mixes letters from different alphabets',
        evidence: `"${label}" mixes alphabets (it reads like "${sk}")`,
        whyItMatters:
          'Letters from other alphabets can look identical to Latin letters, making a fake address look like a real one.',
        basis: 'observed',
        severity: brand ? 'strong' : 'moderate',
        limitations: brand
          ? undefined
          : 'Some legitimate international domains mix scripts, although this is uncommon.',
      }),
    );
  }

  if (reg) {
    for (const brand of BRANDS) {
      if (isOfficial(brand, reg)) continue;
      const inSub = subdomain && brand.tokens.some((t) => containsToken(subdomain, t));
      const inSld = brand.tokens.some((t) => containsToken(sld, t));
      if (inSub && !inSld) {
        impersonated.add(brand.name);
        out.push(
          ind({
            category: 'brand_in_subdomain',
            title: `"${brand.name}" appears in the subdomain, but the site belongs to ${reg}`,
            evidence: `${subdomain}.${reg}`,
            whyItMatters: `Anyone who owns ${reg} can put any name in front of it. Placing a trusted organisation's name there is a common way to make a phishing site look official.`,
            basis: 'observed',
            severity: 'moderate',
            limitations: `${reg} might be an authorised partner of ${brand.name}; this cannot be confirmed from the address alone.`,
          }),
        );
        continue;
      }
      if (inSld) {
        const exactName = brand.tokens.some((t) => sld.replace(/-/g, '') === t.replace(/-/g, ''));
        // A government body's exact name on another ending is still a warning: .go.ke is expected.
        const weakSignal = exactName && !brand.officialSuffix;
        impersonated.add(brand.name);
        out.push(
          ind({
            category: 'brand_in_domain',
            title: exactName
              ? `The domain uses the name "${brand.name}" with a different ending than its known official domains`
              : `The domain uses the name "${brand.name}" but is not one of its known official domains`,
            evidence: reg,
            whyItMatters: `Scammers register domains combining a trusted name with words like "careers" or "jobs", or the same name with a different ending. Known official domains for ${brand.name} include ${brand.official.length ? brand.official.join(', ') : `domains under .${brand.officialSuffix}`}.`,
            basis: 'inferred',
            severity: weakSignal ? 'weak' : 'moderate',
            limitations: weakSignal
              ? "Large organisations often own country-specific versions of their domain that are not in RadarJob's partial list."
              : "RadarJob's list of official domains is partial. Fan sites, partners or recently launched official sites can trigger this signal.",
          }),
        );
        continue;
      }
      if (brand.typoTarget && sld.length >= 5) {
        const candidate = sld.replace(/-/g, '');
        const sk = skeleton(candidate);
        const target = brand.typoTarget;
        const dist = editDistance(candidate, target);
        const maxDist = target.length >= 9 ? 2 : 1;
        if (candidate !== target && (sk === target || (dist > 0 && dist <= maxDist))) {
          impersonated.add(brand.name);
          out.push(
            ind({
              category: 'typosquatting',
              title: `The domain closely resembles "${brand.name}"`,
              evidence: `${reg} vs. ${brand.official[0] ?? brand.typoTarget}`,
              whyItMatters:
                'Misspelled or character-swapped versions of a trusted name are used to catch people who do not read the address carefully.',
              basis: 'inferred',
              severity: 'moderate',
              limitations: 'Short or common names can resemble a brand by coincidence.',
            }),
          );
        }
      }
    }

    const governmentBrandFlagged = BRANDS.some((b) => b.officialSuffix && impersonated.has(b.name));
    if (
      !isGovernmentDomain(reg) &&
      !governmentBrandFlagged &&
      looksLikeKenyanGovernment(host, subdomain ? `${subdomain}.${sld}` : sld, suffix)
    ) {
      impersonated.add('Government of Kenya');
      out.push(
        ind({
          category: 'government_not_go_ke',
          title: 'The address looks like a Kenyan government site, but does not end in .go.ke',
          evidence: host,
          whyItMatters:
            'Kenyan government websites are expected to use the .go.ke ending. Scammers use government-sounding addresses to make fake recruitment look official.',
          basis: 'inferred',
          severity: 'moderate',
          limitations:
            'This is a warning sign, not proof of fraud. Some public bodies use other endings, such as .or.ke or .ac.ke, and private job boards may mention government in their address. Confirm through the organisation’s official channels.',
        }),
      );
    }
  }

  if (URL_SHORTENERS.has(reg ?? '') || URL_SHORTENERS.has(host)) {
    out.push(
      ind({
        category: 'url_shortener',
        title: 'This is a shortened link that hides its final destination',
        evidence: host,
        whyItMatters:
          'Shorteners are widely used legitimately, but they also hide where a link really goes. The final website may differ from what the message suggests.',
        basis: 'observed',
        severity: 'info',
        limitations:
          'Reputation checks apply to the short link itself unless the page inspection followed the redirect.',
      }),
    );
  }

  const freeHost = FREE_HOSTING_SUFFIXES.find((s) => host === s || host.endsWith(`.${s}`));
  if (freeHost) {
    out.push(
      ind({
        category: 'free_hosting',
        title: 'Hosted on a free website-builder or form service',
        evidence: freeHost,
        whyItMatters:
          'Large employers usually run recruitment through their own domain or an established applicant-tracking system. Free services make it easy to create convincing pages quickly.',
        basis: 'observed',
        severity: 'weak',
        limitations:
          'Small businesses and community organisations often use these services legitimately.',
      }),
    );
  }

  const subLabels = subdomain ? subdomain.split('.') : [];
  if (subLabels.length >= 4) {
    out.push(
      ind({
        category: 'deep_subdomains',
        title: 'Unusually many subdomain levels',
        evidence: host,
        whyItMatters:
          'Long chains of subdomains can push the real domain out of view on small screens.',
        basis: 'observed',
        severity: 'weak',
      }),
    );
  }

  if (sld && (sld.match(/-/g) ?? []).length >= 3) {
    out.push(
      ind({
        category: 'hyphenated_domain',
        title: 'Domain made of many hyphenated words',
        evidence: reg ?? sld,
        whyItMatters:
          'Phishing domains often string together reassuring words (e.g. "official-jobs-portal-apply").',
        basis: 'observed',
        severity: 'weak',
      }),
    );
  }

  const tld = suffix.split('.').pop() ?? '';
  if (FREQUENTLY_ABUSED_TLDS.has(tld)) {
    out.push(
      ind({
        category: 'abused_tld',
        title: `The ".${tld}" ending is frequently seen in abuse reports`,
        evidence: `.${tld}`,
        whyItMatters:
          'Some low-cost domain endings are disproportionately used for short-lived scam sites.',
        basis: 'inferred',
        severity: 'weak',
        limitations: 'Many legitimate websites use this ending. This alone says very little.',
      }),
    );
  }

  if (u.protocol === 'http:') {
    out.push(
      ind({
        category: 'no_https',
        title: 'The link does not use HTTPS encryption',
        evidence: 'http://',
        whyItMatters:
          'Information you type on an unencrypted page can be intercepted. Recruitment forms should use HTTPS.',
        basis: 'observed',
        severity: 'weak',
        limitations: 'Many sites redirect HTTP to HTTPS automatically.',
      }),
    );
  }

  if (u.port && u.port !== 80 && u.port !== 443) {
    out.push(
      ind({
        category: 'non_standard_port',
        title: 'The link uses an unusual network port',
        evidence: `:${u.port}`,
        whyItMatters:
          'Public recruitment websites almost always use standard ports. Unusual ports are common on hastily set-up or compromised servers.',
        basis: 'observed',
        severity: 'weak',
      }),
    );
  }

  const path = u.pathname;
  if (/%25|%2f|%5c|%40|%00/i.test(path) || (path.match(/%[0-9a-f]{2}/gi) ?? []).length > 10) {
    out.push(
      ind({
        category: 'encoded_path',
        title: 'The link contains heavily encoded characters',
        evidence: path.slice(0, 80),
        whyItMatters: 'Encoding can disguise where a link leads or slip past filters.',
        basis: 'observed',
        severity: 'weak',
      }),
    );
  }

  const credentialWords = path
    .toLowerCase()
    .match(
      /\b(login|log-in|signin|sign-in|verify|verification|account|password|wallet|otp|pin|payment|pay|billing|secure)\b/g,
    );
  if (credentialWords && impersonated.size > 0) {
    out.push(
      ind({
        category: 'credential_path_with_brand',
        title: "Login or payment wording on a site that uses another organisation's name",
        evidence: [...new Set(credentialWords)].join(', '),
        whyItMatters:
          'A page asking you to log in, verify or pay on a domain that borrows a trusted name is a classic phishing pattern.',
        basis: 'inferred',
        severity: 'moderate',
        limitations: 'Path words describe the address only; the page itself may differ.',
      }),
    );
  } else if (credentialWords) {
    out.push(
      ind({
        category: 'credential_path',
        title: 'The address mentions login, verification or payment',
        evidence: [...new Set(credentialWords)].join(', '),
        whyItMatters:
          'Job applications rarely require payment or account verification. Be careful what you enter.',
        basis: 'observed',
        severity: 'info',
      }),
    );
  }

  return { indicators: out, impersonatedBrands: [...impersonated] };
}
