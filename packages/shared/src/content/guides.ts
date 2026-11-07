import { RESOURCES, type Resource, type ResourceKey } from './resources';

export interface Guide {
  slug: string;
  title: string;
  summary: string;
  readingMinutes: number;
  tags: string[];
  definition: string;
  howItWorks: string[];
  warningSigns: string[];
  /** Always fictional. Domains use the reserved .example TLD so they can never resolve. */
  fictionalExample: { title: string; body: string; redFlags: string[] };
  howToVerify: string[];
  ifEngaged: string[];
  reporting: string[];
  resources: Resource[];
}

const r = (...keys: ResourceKey[]): Resource[] => keys.map((k) => RESOURCES[k]);

const COMMON_REPORTING = [
  'Report the advert to the platform where you found it (job board, Facebook, LinkedIn, WhatsApp or Telegram).',
  'In Kenya, report fraud to the DCI and phishing websites to the National KE-CIRT/CC.',
  'Keep screenshots, phone numbers, M-PESA confirmation messages and links as evidence. Do not delete the conversation.',
];

export const GUIDES: Guide[] = [
  {
    slug: 'fake-job-advertisements',
    title: 'Fake job advertisements',
    summary:
      'Adverts for jobs that do not exist, designed to collect money or personal information.',
    readingMinutes: 4,
    tags: ['adverts', 'basics'],
    definition:
      'A fake job advertisement describes a position that does not exist. Its purpose is to make you pay a fee, hand over personal documents, or click a link that steals information.',
    howItWorks: [
      'The scammer copies a real company name, logo or job description, or invents an attractive role.',
      'The advert is posted where many job seekers look: Facebook groups, WhatsApp status, Telegram channels, and sometimes legitimate job boards.',
      'Applicants are moved quickly to a private channel, such as WhatsApp, where checks are harder.',
      'The "recruiter" then asks for a fee, documents, or for you to fill in a form on an unfamiliar website.',
    ],
    warningSigns: [
      'Salary far above what similar roles pay, with few or no qualifications required.',
      'Vague duties ("data entry", "online assistant") with no named team, location or manager.',
      'Contact only through WhatsApp, Telegram or a personal email address such as Gmail.',
      'Spelling mistakes in the company name or a website that is slightly different from the official one.',
      'Pressure to apply "today" because "slots are limited".',
    ],
    fictionalExample: {
      title: 'FICTIONAL EXAMPLE — "Urgent hiring: 40 customer care agents"',
      body: 'A poster shared in a Facebook group says a well-known telecom company is hiring 40 customer care agents in Nairobi at KES 85,000 a month. No experience is needed. Applicants must send their CV to a WhatsApp number and "secure a slot" by paying a KES 1,500 registration fee to a till number. The link in the poster leads to telecom-careers-ke.example rather than the company\'s official website.',
      redFlags: [
        'Registration fee before any interview',
        'Unrealistic pay for an entry-level role',
        'WhatsApp-only contact',
        "Website that is not the company's official domain",
      ],
    },
    howToVerify: [
      "Find the company's official website yourself (not through the advert) and check its careers page for the same role.",
      'Call or email the company using contact details from its official website, not from the advert.',
      'Search the job title, company name and phone number together with the word "scam".',
      'Check that the recruitment agency, if one is involved, is registered with the National Employment Authority.',
    ],
    ifEngaged: [
      'Stop communicating and do not send any more money or documents.',
      'If you paid through M-PESA, contact Safaricom immediately — reversals are sometimes possible only within a short window.',
      'If you shared your ID or other documents, watch for unexpected loans, SIM swaps or accounts opened in your name.',
      "Change any passwords you entered on the advert's website.",
    ],
    reporting: COMMON_REPORTING,
    resources: r('nea', 'dci', 'safaricom', 'ftcJobScams'),
  },
  {
    slug: 'recruitment-fee-scams',
    title: 'Recruitment and application-fee scams',
    summary: 'Paying to apply, train, or "secure" a job is the most common job-scam pattern.',
    readingMinutes: 4,
    tags: ['fees', 'payments', 'm-pesa'],
    definition:
      'An application-fee scam asks you to pay before you are hired — for registration, processing, training, uniforms, medical checks, or "booking an interview". Once you pay, the job disappears or new fees appear.',
    howItWorks: [
      'You are told you have been shortlisted or "successfully selected".',
      'A small fee is requested so it feels affordable and low-risk.',
      'After the first payment, more fees follow: medicals, visa processing, insurance, uniforms.',
      'Payment is requested through mobile money, a personal till or paybill number, or a gift card — methods that are hard to reverse.',
    ],
    warningSigns: [
      'Any payment requested before you have a signed, verifiable employment contract.',
      'Payment to a personal M-PESA number or a till that does not match the company name.',
      'Fees described as "refundable" once you start work.',
      'Different people asking for different fees at different stages.',
    ],
    fictionalExample: {
      title: 'FICTIONAL EXAMPLE — "Congratulations, you are shortlisted"',
      body: 'An SMS reads: "Congratulations! You have been shortlisted for Cleaner/Supervisor at a supermarket chain. Pay KES 750 interview booking fee to 0700-000-000 (J. Otieno) before 5pm today to confirm your slot." The applicant never applied for this job.',
      redFlags: [
        'Shortlisted for a job never applied for',
        'Fee to "book" an interview',
        "Payment to an individual's name",
        'Same-day deadline',
      ],
    },
    howToVerify: [
      "Legitimate employers in Kenya generally do not charge job seekers for interviews or applications. Ask the employer's official HR office directly.",
      'If an agency is involved in foreign employment, confirm its registration with the National Employment Authority and ask exactly which costs are lawful.',
      "Ask for a written contract and verify the company's physical office.",
    ],
    ifEngaged: [
      'Do not pay any further fees, even if told the first payment will be lost.',
      'Contact your mobile money provider immediately with the transaction code.',
      "Save the M-PESA confirmation message and the recipient's name and number.",
    ],
    reporting: COMMON_REPORTING,
    resources: r('nea', 'safaricom', 'dci', 'ftcJobScams'),
  },
  {
    slug: 'phishing-links-fake-career-sites',
    title: 'Phishing links and fake career websites',
    summary: 'Websites that copy a real careers page to steal logins, IDs or payment details.',
    readingMinutes: 5,
    tags: ['phishing', 'links', 'websites'],
    definition:
      "A phishing career site imitates a real employer's careers portal or a well-known job platform to trick you into entering passwords, one-time codes, identity numbers or card details.",
    howItWorks: [
      'The scammer registers a domain that looks similar to the real one, such as adding "-careers" or swapping letters.',
      "The page copies the employer's logo and colours.",
      'You are asked to "log in with your email" or "verify your identity" to apply.',
      'Anything you type is sent to the scammer, who may then take over your email or social media accounts.',
    ],
    warningSigns: [
      "The website address does not exactly match the employer's official domain.",
      'The real company name appears in the subdomain (for example company.jobs-portal.example) rather than as the main domain.',
      'A login form asks for your email password, M-PESA PIN, or a one-time code.',
      'The link came through a shortened URL or an unsolicited message.',
    ],
    fictionalExample: {
      title: 'FICTIONAL EXAMPLE — a look-alike careers portal',
      body: 'A message links to bank-careers.verify-applicant.example. The page shows a bank\'s logo and asks applicants to "Sign in with Google" by typing their Gmail password, then enter the 6-digit code sent to their phone.',
      redFlags: [
        'Brand name only in the subdomain',
        'Password entered on a non-Google page',
        'Request for a one-time code',
      ],
    },
    howToVerify: [
      "Type the employer's official address yourself instead of following links.",
      'Read the domain right-to-left from the first single slash: the part just before the ending (.com, .co.ke) is who really owns the site.',
      'Use RadarJob or another reputation service, but remember that new phishing sites may not yet be flagged.',
    ],
    ifEngaged: [
      'Change the password you entered immediately, starting with your email account.',
      'Turn on two-step verification and sign out of other sessions.',
      'If you shared a one-time code or PIN, contact your bank or mobile provider straight away.',
    ],
    reporting: [
      'Report the phishing site to the National KE-CIRT/CC.',
      ...COMMON_REPORTING.slice(0, 1),
      'If the site imitates a specific company, tell that company through its official contact channels.',
    ],
    resources: r('kecirt', 'dci', 'actionFraud'),
  },
  {
    slug: 'employer-impersonation',
    title: 'Employer impersonation',
    summary: 'Scammers pretend to be a real, trusted organisation to make a fake offer believable.',
    readingMinutes: 4,
    tags: ['impersonation', 'brands'],
    definition:
      'Employer impersonation is when a scammer uses the name, logo, staff names or letterhead of a genuine company, NGO or government agency to make a fraudulent job offer look real.',
    howItWorks: [
      'Popular employers — telecoms, banks, airlines, NGOs, UN agencies and government bodies — are copied because their names inspire trust.',
      'Scammers create look-alike email addresses, social media pages, or websites.',
      'They may use the names of real HR staff found on LinkedIn.',
    ],
    warningSigns: [
      'Emails from free addresses (gmail.com, yahoo.com) claiming to represent a large organisation.',
      'Social media pages with few followers, recent creation dates, or slightly misspelled names.',
      'Offer letters with poor formatting, wrong logos, or unusual payment instructions.',
      'Government jobs advertised with fees, or outside official government portals.',
    ],
    fictionalExample: {
      title: 'FICTIONAL EXAMPLE — the "NGO country office" offer',
      body: 'An email from hr.recruitment.ngo@gmail.example offers a Programme Assistant role at an international NGO\'s Kisumu office, with a salary in US dollars. The applicant must pay for a "mandatory work permit clearance" through a named agent.',
      redFlags: [
        'Free email address for a large organisation',
        'Payment through a third-party "agent"',
        'Offer without any interview',
      ],
    },
    howToVerify: [
      "Compare the email domain with the organisation's official website.",
      "Look for the vacancy on the organisation's own careers page.",
      'For Kenyan public-service jobs, check the relevant official government recruitment portal.',
    ],
    ifEngaged: [
      'Stop communicating and do not pay.',
      'Warn the real organisation so it can alert others.',
      'Watch for misuse of any documents you shared.',
    ],
    reporting: COMMON_REPORTING,
    resources: r('dci', 'kecirt', 'odpc'),
  },
  {
    slug: 'whatsapp-telegram-recruitment-scams',
    title: 'WhatsApp and Telegram recruitment scams',
    summary: '"Like and earn", task groups, and recruiters who only talk on chat apps.',
    readingMinutes: 5,
    tags: ['whatsapp', 'telegram', 'tasks'],
    definition:
      'Chat-app recruitment scams contact people directly on WhatsApp or Telegram with offers of easy online work — liking videos, rating products, or completing "tasks" — that later require deposits.',
    howItWorks: [
      'A stranger messages you offering part-time online work with daily pay.',
      'You receive small real payments for the first few tasks to build trust.',
      'You are added to a group where others appear to be earning a lot.',
      'Then you are asked to "top up" or "upgrade your account" to unlock bigger tasks, and your money is not returned.',
    ],
    warningSigns: [
      'Unsolicited messages from unknown international numbers.',
      'Payment for trivial tasks such as liking posts or reviewing hotels.',
      'Requests to deposit money to unlock earnings or withdraw your balance.',
      'Group members who seem scripted and celebrate constantly.',
    ],
    fictionalExample: {
      title: 'FICTIONAL EXAMPLE — the "task mentor"',
      body: 'A Telegram user called "Mentor Grace" offers KES 300 per task for rating hotels online. After earning KES 900, the user is told to deposit KES 5,000 for a "VIP task pack" with returns of KES 12,000. The withdrawal button then requires another deposit.',
      redFlags: [
        'Unsolicited contact',
        'Deposit required to earn',
        'Withdrawal blocked behind more payments',
      ],
    },
    howToVerify: [
      'Genuine employers do not ask you to deposit money to start or continue working.',
      "Ask for the company's registered name and verify it independently.",
      'Search the group name, website and phone numbers with the word "scam".',
    ],
    ifEngaged: [
      'Stop depositing money — the losses usually grow with every "upgrade".',
      'Do not pay "fees" to recover lost money; recovery offers are often a second scam.',
      'Report and block the accounts.',
    ],
    reporting: [
      "Use WhatsApp's or Telegram's built-in report function on the chat and group.",
      ...COMMON_REPORTING.slice(1),
    ],
    resources: r('safaricom', 'dci', 'ftcJobScams'),
  },
  {
    slug: 'fake-remote-jobs',
    title: 'Fake remote jobs',
    summary: 'Work-from-home offers that hide fees, equipment purchases, or money laundering.',
    readingMinutes: 4,
    tags: ['remote', 'online work'],
    definition:
      'Fake remote jobs promise flexible online work but are used to collect fees, sell equipment or "training", or recruit people into moving money.',
    howItWorks: [
      'Offers are posted for writing, transcription, data entry or virtual assistant roles.',
      'Applicants are "hired" quickly, often after a chat-only interview.',
      'They are asked to buy software, equipment or training from a specific vendor, or to receive a cheque and send part of it on.',
    ],
    warningSigns: [
      'Hiring without a video or voice interview with an identifiable person.',
      'Requirement to buy equipment or training from a supplier the employer chooses.',
      'Being sent money and asked to forward part of it.',
      'Requests to create accounts (for freelance platforms or banks) that someone else will use.',
    ],
    fictionalExample: {
      title: 'FICTIONAL EXAMPLE — the transcription "starter kit"',
      body: 'A remote transcription company hires an applicant after a text-only chat and asks them to buy a KES 4,000 "certified transcription software licence" from a link to softlicence-kenya.example before receiving any work.',
      redFlags: ['Chat-only hiring', 'Mandatory purchase before work', 'Unknown vendor'],
    },
    howToVerify: [
      'Ask for a call with a named manager and check their profile independently.',
      "Research the company's registration, address and reviews outside its own website.",
      'Never buy equipment or software as a condition of being hired unless you have verified the employer.',
    ],
    ifEngaged: [
      'Do not make further purchases.',
      'If you received money to forward, stop and seek advice — you may be at legal risk.',
      "Close any accounts you opened on someone else's instructions.",
    ],
    reporting: COMMON_REPORTING,
    resources: r('dci', 'ftcJobScams', 'ftcReport'),
  },
  {
    slug: 'fake-interviews-fraudulent-offers',
    title: 'Fake interviews and fraudulent offers',
    summary: 'Interviews held entirely by chat and offer letters that arrive suspiciously fast.',
    readingMinutes: 4,
    tags: ['interviews', 'offer letters'],
    definition:
      'A fake interview is a staged hiring process — often a text-only chat — designed to make you believe you have been hired so you will pay fees or share sensitive information.',
    howItWorks: [
      'You are invited to an "interview" on a chat app with a "hiring manager".',
      'The questions are generic and you are offered the job immediately.',
      'An official-looking offer letter follows, along with requests for documents, bank details, or fees for onboarding.',
    ],
    warningSigns: [
      'An offer made within minutes, without discussing your experience.',
      'An interviewer who refuses voice or video calls.',
      'Offer letters with mismatched logos, spelling mistakes, or a non-company email signature.',
      'Requests for bank details, ID copies, or payments before you sign a verifiable contract.',
    ],
    fictionalExample: {
      title: 'FICTIONAL EXAMPLE — the instant offer',
      body: 'After a 20-minute Telegram chat, the applicant receives an offer letter for a "Logistics Coordinator" role at USD 2,500 a month. They are asked to send a scan of their national ID and pay a KES 3,200 "background check fee" to start onboarding.',
      redFlags: [
        'Chat-only interview',
        'Instant offer',
        'Background-check fee',
        'ID requested immediately',
      ],
    },
    howToVerify: [
      "Ask for a video or in-person interview and check the interviewer's identity with the company.",
      "Confirm the offer by contacting the company's official HR department.",
      'Legitimate background checks are normally arranged and paid for by the employer.',
    ],
    ifEngaged: [
      'Do not send further documents or money.',
      'If you sent ID copies, watch for loans or SIM registrations in your name.',
    ],
    reporting: COMMON_REPORTING,
    resources: r('dci', 'odpc', 'ftcJobScams'),
  },
  {
    slug: 'identity-theft-sensitive-information',
    title: 'Identity theft and sensitive-information requests',
    summary: 'Why recruiters should never need your PINs, passwords or one-time codes.',
    readingMinutes: 4,
    tags: ['identity', 'privacy', 'otp'],
    definition:
      'Some job scams aim to collect your identity documents and account access rather than money. The information is then used for loans, SIM swaps, account takeovers or other fraud in your name.',
    howItWorks: [
      'Applicants are asked for ID copies, KRA PIN, date of birth, bank details and selfies "for onboarding".',
      'Some are asked to read out a one-time code "to verify their phone".',
      'The details are used to borrow money, open accounts or take over existing ones.',
    ],
    warningSigns: [
      'Requests for passwords, M-PESA PINs, bank PINs or one-time passwords (OTPs). No genuine employer needs these.',
      'Requests for full ID copies, selfies holding your ID, or bank details before an offer is verified.',
      'Being asked to install remote-access apps.',
    ],
    fictionalExample: {
      title: 'FICTIONAL EXAMPLE — "verify your phone"',
      body: 'A recruiter says: "To complete your registration, you will receive a 6-digit code by SMS. Please send it to me so the system can confirm your number." The code is actually a password-reset code for the applicant\'s WhatsApp account.',
      redFlags: ['Request for a one-time code', 'Unverified recruiter', 'Urgency'],
    },
    howToVerify: [
      'Share identity documents only after you have verified the employer and signed a contract, and only through official HR channels.',
      'Never share a PIN, password or one-time code with anyone.',
    ],
    ifEngaged: [
      'If you shared a one-time code, secure the related account immediately and contact the provider.',
      'If you shared your ID, monitor for unexpected loans or SIM registrations and report misuse.',
      'Change passwords and enable two-step verification.',
    ],
    reporting: [
      'Report data misuse to the Office of the Data Protection Commissioner.',
      ...COMMON_REPORTING,
    ],
    resources: r('odpc', 'safaricom', 'dci'),
  },
  {
    slug: 'money-mule-recruitment',
    title: 'Money-mule recruitment',
    summary: '"Payment processing" jobs that use your account to move stolen money.',
    readingMinutes: 4,
    tags: ['money mule', 'payments', 'legal risk'],
    definition:
      "A money mule receives money into their bank or mobile-money account and transfers it elsewhere on someone else's instructions. Criminals advertise this as a job, but taking part can expose you to criminal liability.",
    howItWorks: [
      'Roles are advertised as "payment processing agent", "financial assistant" or "transaction coordinator".',
      'You receive money into your account and are told to forward it, keeping a commission.',
      'The money is often stolen, and the account holder is the one investigators can trace.',
    ],
    warningSigns: [
      'Any job that involves receiving money into your personal account and sending it on.',
      "Requests to open new bank or mobile-money accounts for the employer's use.",
      'Easy commission for "simple transactions".',
    ],
    fictionalExample: {
      title: 'FICTIONAL EXAMPLE — the "transaction coordinator"',
      body: 'A remote role offers 10% commission for receiving client payments to the applicant\'s M-PESA and forwarding the rest to a "regional account" within an hour.',
      redFlags: [
        'Using your own account for company money',
        'Commission per transfer',
        'Time pressure',
      ],
    },
    howToVerify: [
      'Legitimate companies process payments through their own business accounts.',
      'Treat any request to move money through your account as a serious warning sign.',
    ],
    ifEngaged: [
      'Stop moving money immediately.',
      'Contact your bank or mobile-money provider and explain what happened.',
      'Consider seeking legal advice and reporting to the police.',
    ],
    reporting: COMMON_REPORTING,
    resources: r('dci', 'safaricom', 'actionFraud'),
  },
  {
    slug: 'social-engineering-urgency',
    title: 'Social engineering and urgency tactics',
    summary: 'How pressure, flattery and fear are used to stop you from checking the facts.',
    readingMinutes: 3,
    tags: ['psychology', 'urgency'],
    definition:
      'Social engineering manipulates emotions — hope, fear, excitement, urgency — so that you act before you think. Most job scams rely on it.',
    howItWorks: [
      'Deadlines ("pay before 5pm") stop you from verifying.',
      'Flattery ("you were specially selected") lowers your guard.',
      'Authority (a "director" or "government officer") discourages questions.',
      'Secrecy ("do not tell others, slots are few") isolates you from advice.',
    ],
    warningSigns: [
      'Extreme urgency or threats that you will lose the opportunity.',
      'Being asked to keep the offer secret.',
      'Emotional pressure when you ask questions.',
    ],
    fictionalExample: {
      title: 'FICTIONAL EXAMPLE — the closing window',
      body: '"Only 3 slots remain in the Mombasa port recruitment. Our director has approved your name personally. Send the processing fee within 30 minutes or the slot will be given to the next candidate. Do not share this offer."',
      redFlags: ['30-minute deadline', 'Secrecy', 'Appeal to authority', 'Fee'],
    },
    howToVerify: [
      'Pause. A genuine opportunity will still exist after you take time to check.',
      'Talk to someone you trust before paying or sharing information.',
      'Verify every claim through official channels you find yourself.',
    ],
    ifEngaged: [
      'It is never too late to stop. Do not let embarrassment keep you engaged.',
      'Follow the reporting steps and secure your accounts.',
    ],
    reporting: COMMON_REPORTING,
    resources: r('dci', 'kecirt', 'ftcJobScams'),
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function searchGuides(query: string): Guide[] {
  const q = query.trim().toLowerCase();
  if (!q) return GUIDES;
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = GUIDES.map((g) => {
    const title = g.title.toLowerCase();
    const tags = g.tags.join(' ').toLowerCase();
    const body = [g.summary, g.definition, ...g.warningSigns, ...g.howItWorks]
      .join(' ')
      .toLowerCase();
    let score = 0;
    for (const t of terms) {
      const inTitle = title.includes(t);
      const inTags = tags.includes(t);
      const inBody = body.includes(t);
      if (!inTitle && !inTags && !inBody) return { g, score: -1 };
      score += (inTitle ? 10 : 0) + (inTags ? 5 : 0) + (inBody ? 1 : 0);
    }
    return { g, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.g);
}
