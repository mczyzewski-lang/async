import { expect, test } from '@playwright/test';
import { canvasSignature, expectRendered, freshStart, rigTag } from './helpers';

test.describe.configure({ mode: 'serial' });

test('1. user opens the app and sees the live 3D space', async ({ page }) => {
  await freshStart(page);
  await page.reload();
  await expect(page.getByText('Twoja przestrzeń na chwilę spokoju.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('cta-first-10')).toBeVisible();
  await expectRendered(page, 'home-stage');
});

test('2–8. pose learning: render, rotate, play, mistake and correction', async ({ page }) => {
  await page.goto('/explore');
  await page.getByTestId('search').fill('pies z glowa w dol');
  await page.getByTestId('pose-card-downward-dog').click();
  // 2. pose opens
  await expect(page.getByTestId('pose-title')).toHaveText('Pies z głową w dół');
  // 3. the 3D character renders
  await expectRendered(page, 'pose-stage');
  await expect.poll(() => rigTag(page)).toContain('kf:downward-dog');

  // 4. rotate the camera by dragging
  await page.waitForTimeout(1500);
  const before = await canvasSignature(page, 'pose-stage');
  const box = (await page.getByTestId('pose-stage').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.32, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await canvasSignature(page, 'pose-stage');
  expect(after!.hash).not.toBe(before!.hash);

  // 5. play the pose animation: steps advance and the rig moves through keyframes
  const firstStep = await page.getByTestId('step-text').textContent();
  await page.getByTestId('btn-slower').click(); // slower playback works
  await page.getByTestId('btn-slower').click();
  await page.getByTestId('btn-slower').click(); // back to 1×
  await page.getByTestId('btn-play').click();
  await expect.poll(() => page.getByTestId('step-text').textContent(), { timeout: 30_000 }).not.toBe(firstStep);
  await expect.poll(() => rigTag(page), { timeout: 30_000 }).toMatch(/kf:downward-dog:(lift|dog)/);
  await page.getByTestId('btn-play').click(); // pause

  // camera view presets
  await page.getByTestId('btn-views').click();
  await page.getByTestId('view-side').click();

  // 6. open the common mistakes and choose one
  await page.getByTestId('btn-mistakes').click();
  await expect(page.getByTestId('sheet-mistakes')).toBeVisible();
  await page.getByTestId('mistake-rounded').click();

  // 7. the character shows the incorrect configuration with a coral highlight
  await expect.poll(() => rigTag(page)).toBe('mistake:rounded');
  await expect(page.getByTestId('rig-state')).toHaveAttribute('data-hl', 'error');
  await expect(page.getByTestId('mistake-text')).toContainText('zaokrągla');

  // side-by-side comparison
  await page.getByTestId('btn-compare').click();
  await expect(page.getByText('POPRAWNIE', { exact: true })).toBeVisible();
  await page.getByTestId('btn-compare').click();

  // 8. back to the correct configuration
  await page.getByTestId('show-correct').click();
  await expect.poll(() => rigTag(page)).toBe('kf:downward-dog:dog');
  await expect(page.getByTestId('mistake-text')).toContainText('Ugnij kolana');

  // technical mode toggles without errors
  await page.getByTestId('btn-tech').click();
  await expect(page.getByTestId('btn-tech')).toHaveAttribute('aria-pressed', 'true');
});

test('9–13. a 10-minute session: create, pause, resume, skip, complete, persist', async ({ page }) => {
  await page.goto('/practice');
  // 9. create a 10-minute session
  await page.getByTestId('dur-10').click();
  await page.getByTestId('goal-neckShoulders').click();
  await page.getByTestId('level-beginner').click();
  await page.getByTestId('generate').click();
  await expect(page.getByTestId('total-duration')).toHaveText('10');
  expect(await page.getByTestId('session-step').count()).toBeGreaterThan(4);
  await page.getByTestId('save-routine').click();
  await expect(page.getByTestId('save-routine')).toContainText('Zapisano');

  // 10. launch and pause
  await page.getByTestId('start-session').click();
  await page.getByTestId('begin').click();
  const play = page.getByTestId('practice-play');
  await expect(play).toHaveAttribute('data-status', /transitioning|playing/, { timeout: 15_000 });
  await expect(page.getByTestId('pose-name')).toBeVisible();
  await page.getByTestId('btn-pause').click();
  await expect(play).toHaveAttribute('data-status', 'paused');
  const frozen = await page.getByTestId('time-left').textContent();
  await page.waitForTimeout(2500);
  expect(await page.getByTestId('time-left').textContent()).toBe(frozen);

  // 11. resume and skip
  await page.getByTestId('btn-pause').click();
  await expect(play).not.toHaveAttribute('data-status', 'paused');
  const step = Number(await play.getAttribute('data-step'));
  await page.getByTestId('btn-next').click();
  await expect(play).toHaveAttribute('data-step', String(step + 1));
  await expectRendered(page, 'play-stage');

  // 12. complete (time-accelerated replay of the same saved session)
  await page.goto('/practice/play?ts=90');
  await page.getByTestId('begin').click();
  await expect(page.getByTestId('completion')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('10 minut dla siebie.')).toBeVisible();
  await page.getByTestId('feeling-Spokojniej').click();
  await page.getByTestId('done').click();

  // 13. progress persists after reload
  await page.goto('/progress');
  await expect(page.getByTestId('stat-sessions')).not.toHaveText('0');
  await page.reload();
  await expect(page.getByTestId('stat-sessions')).not.toHaveText('0');
  await expect(page.getByTestId('history')).toContainText('Rozluźnienie karku i barków');

  // the saved routine appears on the home screen
  await page.goto('/');
  await expect(page.getByTestId('favorite-routine').first()).toBeVisible();
});
