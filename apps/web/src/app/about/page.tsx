import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS, RISK_CATEGORIES } from '@radarjob/shared';

export const metadata: Metadata = { title: 'About and methodology' };

export default function AboutPage() {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <div className="prose-rj mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">About RadarJob</h1>
      <p className="mt-4 text-lg text-ink">
        RadarJob helps job seekers — especially students, graduates and first-time job seekers in
        Kenya — recognise fraudulent recruitment before they lose money, share sensitive information
        or fall for phishing. It combines scam education with automated checks of suspicious links.
      </p>

      <h2 className="mt-10 text-2xl font-extrabold text-ink">How an assessment is made</h2>
      <p className="mt-3">
        Each check produces evidence with a strength: strong, warning, minor signal, or for
        information. A fixed set of rules then decides the category:
      </p>
      <dl className="mt-4 space-y-4">
        {RISK_CATEGORIES.map((c) => (
          <div key={c}>
            <dt className="font-bold text-ink">{CATEGORY_LABELS[c]}</dt>
            <dd className="text-ink-soft">{CATEGORY_DESCRIPTIONS[c]}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-6">
        <li>
          Any strong evidence — such as several security vendors flagging the link, or a password
          form on a look-alike site — leads to “Potentially malicious”.
        </li>
        <li>
          Warning-level evidence from two independent checks also leads to “Potentially malicious”.
          A single warning leads to “Suspicious”.
        </li>
        <li>
          Three or more minor signals together lead to “Suspicious”. A new domain on its own never
          does.
        </li>
        <li>
          If the reputation check could not run and nothing else was found, the result is
          “Inconclusive” — never “No significant threats”.
        </li>
        <li>
          AI-identified patterns are capped at warning level and never count as an independent
          source.
        </li>
        <li>
          The link and the job offer are assessed separately, so a scam message on a legitimate job
          board is not blamed on the job board.
        </li>
      </ul>
      <p className="mt-4">
        RadarJob does not produce a numerical “fraud score”. Categories describe the strength of the
        evidence, not a probability.
      </p>

      <h2 className="mt-10 text-2xl font-extrabold text-ink">Sources of evidence</h2>
      <ul className="mt-3">
        <li>
          <strong>VirusTotal</strong> — aggregated verdicts from security vendors. RadarJob uses an
          existing report when one is recent, otherwise it requests a new scan.
        </li>
        <li>
          <strong>Domain registration (RDAP/WHOIS)</strong> — registration dates and registrar. Some
          country domains, including .ke, may not publish this data through RDAP.
        </li>
        <li>
          <strong>Link-structure rules</strong> — a curated, partial list of organisations commonly
          impersonated, plus checks for look-alike characters and other tricks.
        </li>
        <li>
          <strong>Page inspection</strong> (when enabled on the server) — a single, script-free
          download of the page through a network guard that refuses internal addresses.
        </li>
        <li>
          <strong>Job-text rules and AI review</strong> — recognisable red flags, each shown with
          the exact words that triggered it.
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-extrabold text-ink">Independence</h2>
      <p className="mt-3">
        RadarJob is not affiliated with, endorsed by or in partnership with VirusTotal, any
        employer, job board or government agency mentioned on this site. Organisations are named
        only to help you verify opportunities or report scams.
      </p>

      <h2 id="contact" className="mt-10 scroll-mt-24 text-2xl font-extrabold text-ink">
        Contact
      </h2>
      {contact ? (
        <p className="mt-3">
          Questions, corrections or a scam pattern we should cover:{' '}
          <a className="text-signal underline" href={`mailto:${contact}`}>
            {contact}
          </a>
          .
        </p>
      ) : (
        <p className="mt-3">
          The operator of this RadarJob installation has not published a contact address yet.
        </p>
      )}
      <p className="mt-3">
        To report a scam, see the reporting section of any{' '}
        <Link className="text-signal underline" href="/learn">
          guide
        </Link>
        .
      </p>
    </div>
  );
}
