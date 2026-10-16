import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/explore', '/practice', '/progress', '/settings', '/routines', '/onboarding', '/breathe', '/pose/warrior-2', '/pose/eagle', '/practice/preview', '/dev/pose-lab', '/nie-ma-takiej-strony'];

for (const route of ROUTES) {
  test(`route ${route} renders without horizontal overflow`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(route);
    await page.waitForTimeout(1200);
    await expect(page.locator('body')).not.toBeEmpty();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test('every bottom navigation tab works', async ({ page }) => {
  await page.goto('/');
  for (const [label, path] of [['Pozycje', '/explore'], ['Praktyka', '/practice'], ['Postępy', '/progress'], ['Dziś', '/']] as const) {
    await page.getByRole('navigation', { name: 'Nawigacja główna' }).getByText(label, { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test('explore filters by 3D availability and search in Sanskrit', async ({ page }) => {
  await page.goto('/explore');
  await page.getByTestId('search').fill('Vrksasana');
  await expect(page.getByTestId('pose-card-tree')).toBeVisible();
  await page.getByTestId('search').fill('');
  await page.getByTestId('filter-3d').click();
  await expect(page.getByTestId('pose-card-eagle')).toHaveCount(0);
});
