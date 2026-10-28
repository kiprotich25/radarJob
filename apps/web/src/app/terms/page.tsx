import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms and responsible use' };

export default function TermsPage() {
  return (
    <div className="prose-rj mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">Terms and responsible use</h1>
      <h2 className="mt-8 text-2xl font-extrabold">No guarantees</h2>
      <p className="mt-3">
        RadarJob provides automated warning signs and educational information. It does not guarantee
        that a link, website, employer or job offer is safe, legitimate or fraudulent. Always verify
        opportunities through official channels before paying money or sharing personal information.
      </p>
      <h2 className="mt-8 text-2xl font-extrabold">Responsible use</h2>
      <ul className="mt-3">
        <li>
          Use RadarJob to check links you have received, not to scan systems you are not authorised
          to test.
        </li>
        <li>
          Do not submit confidential, authenticated or private links, or other people&apos;s
          personal data.
        </li>
        <li>
          Do not attempt to overload the service or bypass its rate limits. Checks are limited per
          person to protect shared, paid services.
        </li>
        <li>
          Do not use reports to harass or make public accusations against a business; a warning sign
          is not proof of wrongdoing.
        </li>
      </ul>
      <h2 className="mt-8 text-2xl font-extrabold">Third-party services</h2>
      <p className="mt-3">
        Checks rely on external services such as VirusTotal and domain-registration providers, which
        have their own terms and may be unavailable at times. When they are, the report says so.
      </p>
      <h2 className="mt-8 text-2xl font-extrabold">Not legal or financial advice</h2>
      <p className="mt-3">
        If you have lost money or shared sensitive information, contact your bank or mobile-money
        provider and report to the authorities as described in our guides.
      </p>
    </div>
  );
}
