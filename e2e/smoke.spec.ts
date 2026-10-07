import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const LEDGER = {
  started: '2026-10-07',
  target: 52,
  apps: [
    {
      week: 1,
      slug: 'split-the-bill',
      name: 'Split the bill',
      category: 'calculator',
      sentence: 'Splits a restaurant bill by what each person actually ate.',
      repo: 'oliverinhalo/split-the-bill',
      url: 'https://split-the-bill.example',
      shipped: '2026-10-12',
      score: 7.5,
    },
  ],
};

const BANK = `# Idea bank

### Calculators
- **Freelance rate floor** — a freelancer finds the rate that covers tax. *(finance-tool)*
- **Van load planner** — a mover checks whether it fits in one trip. *(calculator)*
`;

/** Serve a believable factory from api.github.com so the dashboard can be driven. */
async function mockGitHub(page: Page) {
  const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

  await page.route('https://api.github.com/**', async (route) => {
    const url = route.request().url();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.endsWith('/user')) return json({ login: 'oliverinhalo', avatar_url: '' });
    if (url.includes('ledger.json'))
      return json({ content: b64(JSON.stringify(LEDGER)), encoding: 'base64' });
    if (url.includes('idea-bank.md')) return json({ content: b64(BANK), encoding: 'base64' });
    if (url.includes('contents/factory/state/run')) return json([]);
    if (url.includes('contents/factory/state/reports')) return json([]);
    if (url.includes('/issues?')) return json([]);
    if (url.includes('/actions/runs')) return json({ workflow_runs: [] });
    if (url.includes('/issues'))
      return json({
        number: 42,
        title: 'x',
        body: '',
        created_at: new Date().toISOString(),
        state: 'open',
        html_url: 'https://github.com',
        comments: 0,
        labels: [],
      });
    return json({ message: 'unmocked' }, 404);
  });
}

/** Land on the dashboard anonymously — reads need no token. */
async function browse(page: Page) {
  await mockGitHub(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /factory console/i })).toBeVisible();
}

/** Browse, then supply a token so writes are allowed. */
async function connect(page: Page) {
  await browse(page);
  await page.getByRole('button', { name: /^connect$/i }).click();
  await page.getByLabel(/^token$/i).fill('github_pat_11TESTTOKEN0123456789');
  await page.getByRole('button', { name: /^connect$/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: /factory console/i })).toBeVisible();
}

test.describe('anonymous', () => {
  test('renders the dashboard with no token and no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await browse(page);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByText(/browsing anonymously/i)).toBeVisible();
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('offers to connect instead of a dead submit button', async ({ page }) => {
    await browse(page);
    await page.getByRole('button', { name: 'Control' }).click();
    await expect(page.getByRole('button', { name: /connect to send this/i })).toBeVisible();
  });

  test('has a title and a meta description', async ({ page }) => {
    await mockGitHub(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/.{10,}/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{30,}/);
  });

  test('puts the skip link first for keyboard users', async ({ page }) => {
    await mockGitHub(page);
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /skip to content/i })).toBeFocused();
  });

  test('keeps the token out of the page as readable text', async ({ page }) => {
    await browse(page);
    await page.getByRole('button', { name: /^connect$/i }).click();
    await expect(page.getByLabel(/^token$/i)).toHaveAttribute('type', 'password');
  });

  test('does not scroll horizontally at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await mockGitHub(page);
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('survives corrupt stored data', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', '{{{not valid');
      localStorage.setItem('factory-console:repo', '');
    });
    await mockGitHub(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('connected', () => {
  test('shows progress, the shipped app, and the idea bank', async ({ page }) => {
    await connect(page);

    await expect(page.getByText('of 52', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Apps' }).click();
    await expect(page.getByRole('heading', { name: 'Split the bill' })).toBeVisible();
    await expect(page.getByRole('link', { name: /open app/i })).toHaveAttribute(
      'href',
      'https://split-the-bill.example',
    );

    await page.getByRole('button', { name: 'Ideas' }).click();
    await expect(page.getByText('Freelance rate floor')).toBeVisible();

    await page.getByPlaceholder(/search by name/i).fill('van');
    await expect(page.getByText('Van load planner')).toBeVisible();
    await expect(page.getByText('Freelance rate floor')).toHaveCount(0);
  });

  test('a search with no matches explains itself instead of going blank', async ({ page }) => {
    await connect(page);
    await page.getByRole('button', { name: 'Ideas' }).click();
    await page.getByPlaceholder(/search by name/i).fill('zzzzzz');
    await expect(page.getByText(/nothing matches/i)).toBeVisible();
  });

  test('can send an instruction to the factory', async ({ page }) => {
    await connect(page);
    await page.getByRole('button', { name: 'Control' }).click();
    await page.getByLabel(/your instruction/i).fill('Build something for parents next.');
    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText(/sent as #42/i)).toBeVisible();
  });

  test('survives a token the API rejects', async ({ page }) => {
    await page.route('https://api.github.com/**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{"message":"Bad credentials"}',
      }),
    );
    await page.goto('/');
    await page.getByLabel(/^token$/i).fill('github_pat_11BADTOKEN0123456789');
    await page.getByRole('button', { name: /^connect$/i }).click();
    await expect(page.getByRole('alert')).toContainText(/rejected/i);
  });
});

test.describe('accessibility', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`anonymous dashboard has no serious violations in ${theme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await browse(page);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
    });

    test(`dashboard has no serious violations in ${theme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await connect(page);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
    });
  }
});
