import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <div className="prose-rj mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">Privacy</h1>
      <p className="mt-4 text-lg">
        RadarJob is designed to collect as little as possible. No account is needed. This page
        explains exactly what happens to what you submit.
      </p>

      <h2 className="mt-10 text-2xl font-extrabold">Links you check</h2>
      <ul className="mt-3">
        <li>
          The full link is sent from our server to <strong>VirusTotal</strong> for a reputation
          check. VirusTotal may store it and share it with security researchers and vendors under
          its own terms. Do not submit private links.
        </li>
        <li>
          The domain name is looked up with a <strong>domain-registration service</strong> (RDAP
          registries, or WhoisXML API if the operator has configured it).
        </li>
        <li>
          If the operator has enabled <strong>Web-Check</strong>, the link&apos;s address without
          the part after “?” is sent to a Web-Check server. That server checks it against
          threat-intelligence feeds (such as Google Safe Browsing, PhishTank, URLhaus and NetAPI),
          public filtering DNS services and the Tranco popularity list, and reads the site&apos;s
          HTTPS certificate.
        </li>
        <li>
          If page inspection is enabled, our server downloads the page once, without running scripts
          or submitting forms.
        </li>
        <li>
          If an AI provider is configured, the link&apos;s host and path (not the part after “?”)
          and a short, redacted excerpt of the page are sent to it.
        </li>
        <li>
          The report stored on our server contains the website address without its query string, the
          findings and the assessment. It is deleted automatically after a limited retention period
          (72 hours by default).
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-extrabold">Job advert text</h2>
      <ul className="mt-3">
        <li>Pasted text is analysed and then discarded — it is not stored on our server.</li>
        <li>
          Before any text is sent to an AI provider, phone numbers, email addresses and long ID-like
          numbers are replaced with placeholders.
        </li>
        <li>
          Short quotes that triggered a red flag appear in the report, with personal details
          redacted.
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-extrabold">On your device</h2>
      <ul className="mt-3">
        <li>
          Completed reports are saved in your browser&apos;s local storage so you can view them
          later, including offline. You can delete them at any time from “My Checks”.
        </li>
        <li>
          The app caches guides and pages for offline reading. It never caches live check results as
          if they were current.
        </li>
        <li>RadarJob does not use advertising or third-party analytics.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-extrabold">What we log</h2>
      <p className="mt-3">
        Server logs record the website&apos;s host name, a report identifier and the outcome — never
        full links, query strings or job text. Rate limiting uses your IP address in memory for up
        to an hour.
      </p>

      <h2 className="mt-10 text-2xl font-extrabold">Please don&apos;t submit</h2>
      <p className="mt-3">
        Password-reset links, links that sign you in, private document or file-sharing links, or
        messages containing other people&apos;s personal data. RadarJob cannot guarantee complete
        privacy once information is shared with external services.
      </p>
    </div>
  );
}
