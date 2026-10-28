import { expect, test } from '@playwright/test';

/** All analyses here use development mock providers; reports are labelled "Simulated". */

async function analyze(page: import('@playwright/test').Page, url: string, jobAd?: string) {
  await page.goto('/analyze');
  await page.getByLabel('Job link to check').fill(url);
  if (jobAd) {
    await page.getByText('Add the job advert or recruiter message (optional)').click();
    await page.getByLabel('Advert or message text').first().fill(jobAd);
  }
  await page.getByRole('button', { name: 'Analyze Link' }).click();
  await page.waitForURL(/\/report\//);
  await expect(page.locator('#verdict')).toBeVisible({ timeout: 30_000 });
}

test('submitting a valid URL produces a completed, clearly simulated report', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Job link to check')
    .fill('https://careers.acme-logistics.com/jobs/42?ref=wa');
  await page.getByRole('button', { name: 'Analyze Link' }).click();
  await page.waitForURL(/\/report\//);
  await expect(page.locator('#verdict')).toHaveText('No significant threats detected', {
    timeout: 30_000,
  });
  await expect(page.getByText('Simulated report.')).toBeVisible();
  await expect(page.getByText(/does not guarantee/)).toBeVisible();
  await expect(
    page.getByText('The webpage itself was not inspected.', { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText('ref=wa')).toHaveCount(0);
});

test('a suspicious report is shown despite zero VirusTotal detections', async ({ page }) => {
  await analyze(page, 'https://safaricom.jobs-portal-ke.com/apply');
  await expect(page.locator('#verdict')).toHaveText('Suspicious — investigate further');
  await expect(
    page.getByText(/Zero detections means no vendor has flagged this link/),
  ).toBeVisible();
  await expect(page.getByText(/appears in the subdomain/)).toBeVisible();
});

test('an inconclusive report when VirusTotal is unavailable', async ({ page }) => {
  await analyze(page, 'https://mock-vt-down.example.com/jobs');
  await expect(page.locator('#verdict')).toHaveText('Inconclusive — insufficient evidence');
  await expect(page.getByText('This is not a clean result.')).toBeVisible();
});

test('job advert text is analysed separately from the link', async ({ page }) => {
  await analyze(
    page,
    'https://www.linkedin.com/jobs/view/123',
    'You have been selected! Pay KES 2,000 processing fee to confirm your slot today.',
  );
  await expect(page.getByText('The job offer (text you provided)')).toBeVisible();
  await expect(page.getByText('Asks you to pay before you are hired')).toBeVisible();
});

test('offline devices cannot start a verification', async ({ page, context }) => {
  await page.goto('/analyze');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByRole('button', { name: 'Analyze Link' })).toBeDisabled();
  await expect(
    page.getByText("You're offline. Connect to the internet to verify this job link."),
  ).toBeVisible();
  await context.setOffline(false);
});

test('a backend outage is reported as "could not be completed"', async ({ page }) => {
  await page.route('**/api/analysis', (r) => r.abort('connectionrefused'));
  await page.goto('/analyze');
  await page.getByLabel('Job link to check').fill('https://jobs.example-test.com');
  await page.getByRole('button', { name: 'Analyze Link' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'could not be completed' })).toBeVisible();
  await expect(page).toHaveURL(/\/analyze$/);
});

test('standalone job-ad check shows red flags with evidence', async ({ page }) => {
  await page.goto('/analyze');
  await page
    .getByPlaceholder('Paste the message here')
    .fill('URGENT: pay KES 1,000 interview booking fee to till 512345. Do not tell anyone.');
  await page.getByRole('button', { name: 'Check the text' }).click();
  await expect(page.getByText('Strong scam warning signs').first()).toBeVisible();
  await expect(page.getByText('Asks you to keep the offer secret')).toBeVisible();
});

test('browsing and searching educational guides', async ({ page }) => {
  await page.goto('/learn');
  await page.getByLabel('Search the guides').fill('mule');
  await expect(page.getByText('1 guide found')).toBeVisible();
  await page.getByRole('link', { name: 'Money-mule recruitment' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Money-mule recruitment');
  await expect(page.getByText('Fictional example — for learning only')).toBeVisible();
});

test('completing the quiz shows a score and recommendations', async ({ page }) => {
  await page.goto('/quiz');
  for (let i = 0; i < 10; i++) {
    await page.locator('input[type=radio]').first().check();
    await page.getByRole('button', { name: 'Check answer' }).click();
    const next = page.getByRole('button', { name: /Next question|See my score/ });
    await next.click();
  }
  await expect(page.getByRole('heading', { name: /You scored \d+ out of 10/ })).toBeVisible();
});

test('historical reports are labelled and never presented as fresh', async ({ page }) => {
  await analyze(page, 'https://mock-malicious.example.com/apply');
  await expect(page.locator('#verdict')).toHaveText('Potentially malicious');
  await page.goto('/history');
  await expect(page.getByText('mock-malicious.example.com')).toBeVisible();
  await page.getByRole('button', { name: 'Open saved copy' }).first().click();
  await expect(
    page.getByText(/This is a historical copy stored on this device, not a fresh scan/),
  ).toBeVisible();
  await page.goto('/history');
  page.on('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: /Delete saved check for mock-malicious/ })
    .first()
    .click();
  await expect(page.getByText('mock-malicious.example.com')).toHaveCount(0);
});

test('PWA: guides work offline after install, live reports do not', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  // Give the install step time to pre-cache guide pages.
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.goto('/learn/fake-job-advertisements');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fake job advertisements');
  await page.goto('/report/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    "This page isn't available offline",
  );
  await context.setOffline(false);
});
