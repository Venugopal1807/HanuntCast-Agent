import { expect, test, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start the experience' }).click();
  await page.getByRole('button', { name: 'Enter Blackthorn House' }).click();
  await expect(page.getByRole('heading', { name: 'Someone left the light on.' })).toBeVisible();
}

// Hides the shipped narration manifest so a test exercises the labeled mock fallback.
async function withoutRecordings(page: Page) {
  await page.route('**/narration/manifest.json', route => route.fulfill({ status: 404, body: '' }));
}

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function capture(page: Page, path: string) {
  // Normalize scroll so a sticky player is captured at its natural document position.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  // Let mobile emulation paint a compositor frame before requesting a full-page capture.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path, fullPage: true, animations: 'disabled', scale: 'css' });
}

for (const ending of ['liberation', 'escape', 'inheritance'] as const) {
  test(`complete real API route to ${ending}`, async ({ page }, info) => {
    const failures: string[] = [];
    page.on('pageerror', () => failures.push('Uncaught page error'));
    await page.goto('/'); await fits(page);
    if (ending === 'liberation') await capture(page, info.outputPath('landing.png'));
    await page.getByRole('button', { name: 'Start the experience' }).click();
    await page.getByRole('radio').nth(ending === 'liberation' ? 0 : ending === 'escape' ? 1 : 2).check();
    await fits(page);
    if (ending === 'liberation') await capture(page, info.outputPath('personas.png'));
    await page.getByRole('button', { name: 'Enter Blackthorn House' }).click();
    await expect(page.getByRole('heading', { name: 'Someone left the light on.' })).toBeVisible();
    if (ending === 'liberation') await capture(page, info.outputPath('story.png'));
    await page.getByRole('button', { name: /Study the girl's portrait/ }).click();
    await expect(page.getByRole('heading', { name: 'The house knows your name.' })).toBeVisible();
    await expect(page.locator('.scene-card')).toHaveAttribute('data-scene', 'gallery');
    if (ending === 'liberation') await capture(page, info.outputPath('scene-gallery.png'));
    await page.getByRole('button', { name: /Promise to help the girl/ }).click();
    await expect(page.locator('.scene-card')).toHaveAttribute('data-scene', 'belfry');
    if (ending === 'liberation') await capture(page, info.outputPath('scene-belfry.png'));
    await page.getByRole('button', { name: /Untie the girl's ribbon/ }).click();
    await expect(page.locator('.scene-card')).toHaveAttribute('data-scene', 'reckoning');
    if (ending === 'liberation') await capture(page, info.outputPath('scene-reckoning.png'));
    await page.getByRole('button', { name: ending === 'liberation' ? /Lead the girl into the dawn/ : ending === 'escape' ? /Leave while you still can/ : /Become the house's keeper/ }).click();
    const title = ending === 'liberation' ? 'The house exhales.' : ending === 'escape' ? 'You make it out. Mostly.' : 'Welcome home, keeper.';
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const narration = page.locator('.narrative');
    // The shipped manifest has a real AssemblyAI recording of this exact ending: the transcript stays collapsed.
    await expect(page.locator('#narration')).toHaveAttribute('data-source', 'pregenerated');
    await expect(page.locator('.transcript')).toHaveAttribute('data-default', 'collapsed');
    await expect(page.locator('.transcript')).not.toHaveAttribute('open', '');
    await expect(page.locator('.journal')).not.toHaveAttribute('open', '');
    await expect(narration).toContainText("Eleanor's name");
    await expect(narration).toContainText(ending === 'escape' ? 'broke your promise' : 'kept your promise');
    if (ending === 'liberation') await expect(narration).toContainText('For the record');
    if (ending === 'escape') await expect(narration).toContainText('reasonable explanations');
    if (ending === 'inheritance') await expect(narration).toContainText('Your pulse is everywhere now');
    await expect(page.getByText('ENDING DISCOVERED', { exact: false })).toBeVisible();
    await expect(page.locator('.scene-card')).toHaveAttribute('data-scene', ending);
    await expect(page.locator('.turning-point strong')).toHaveText("Untie the girl's ribbon");
    // Closed details contents are present but not visible; count proves history persisted.
    await expect(page.locator('.journal li')).toHaveCount(7);
    await expect(page.getByText('ASSEMBLYAI · PRE-GENERATED', { exact: true })).toBeVisible(); await fits(page);
    await page.locator('.transcript summary').click();
    await capture(page, info.outputPath(`ending-${ending}.png`));
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await fits(page);
      await capture(page, info.outputPath(`ending-${ending}-${width}.png`));
    }
    expect(failures).toEqual([]);
    await page.getByRole('button', { name: /Enter again/ }).click();
    await expect(page.getByRole('radiogroup')).toBeVisible();
  });
}

test('pre-generated AssemblyAI MP3 plays for the exact scene and keeps controls in view', async ({ page }) => {
  // Detached Audio elements are invisible to the DOM; record each one as it starts playing.
  await page.addInitScript(() => {
    const played: HTMLMediaElement[] = ((window as unknown as { __played: HTMLMediaElement[] }).__played = []);
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) { played.push(this); return original.call(this); };
  });
  await enter(page);
  await expect(page.locator('#narration')).toHaveAttribute('data-source', 'pregenerated');
  await expect(page.locator('.transcript')).toHaveAttribute('data-default', 'collapsed');
  const play = page.getByRole('button', { name: '▶ Hear George narrate' });
  await expect(play).toBeVisible();
  await play.click();
  await expect(page.getByRole('button', { name: 'Ⅱ Pause' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __played: HTMLMediaElement[] }).__played.some(a => !a.paused && a.currentTime > 0.3 && a.src.includes('/narration/scenes/')))).toBe(true);
  await page.getByRole('button', { name: /Take the brass key/ }).click();
  await expect(page.getByRole('heading', { name: 'The house knows your name.' })).toBeVisible();
  await expect(page.getByText('Stopped · Ready when you are')).toBeVisible();
  await expect(page.getByRole('button', { name: '▶ Hear George narrate' })).toBeVisible();
});

test('mock fallback WAV playback, pause, replay, cancel and scene interruption', async ({ page }) => {
  await withoutRecordings(page);
  await enter(page);
  await page.getByRole('link', { name: 'Listen ↓' }).click();
  await expect(page.getByRole('button', { name: '▶ Play demo audio' })).toBeInViewport();
  const localVoice = page.getByRole('checkbox');
  await page.locator('.player-diagnostics summary').click();
  if (await localVoice.isEnabled()) await localVoice.uncheck();
  await page.locator('.player-diagnostics summary').click();
  await page.getByRole('button', { name: '▶ Play demo audio' }).click();
  await expect(page.getByRole('button', { name: 'Ⅱ Pause' })).toBeVisible();
  await page.getByRole('button', { name: 'Ⅱ Pause' }).click();
  await page.getByRole('button', { name: '▶ Resume' }).click();
  await expect(page.getByRole('button', { name: 'Ⅱ Pause' })).toBeVisible();
  await page.getByRole('button', { name: 'Mute audio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute audio', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Replay narration' }).click();
  await expect(page.getByRole('button', { name: 'Ⅱ Pause' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel audio' }).click();
  await expect(page.getByText('Stopped · Ready when you are')).toBeVisible();
  await page.getByRole('button', { name: '▶ Play demo audio' }).click();
  await expect(page.getByRole('button', { name: 'Ⅱ Pause' })).toBeVisible();
  await page.getByRole('link', { name: 'Return to choices ↑' }).click();
  await expect(page.getByRole('button', { name: /Take the brass key/ })).toBeInViewport();
  await page.getByRole('button', { name: /Take the brass key/ }).click();
  await expect(page.getByRole('heading', { name: 'The house knows your name.' })).toBeVisible();
  await expect(page.getByText('Stopped · Ready when you are')).toBeVisible();
});

test('lost decision response retries once with the original UUID', async ({ page }) => {
  await enter(page);
  const ids: string[] = [];
  await page.route('**/api/sessions/*/choices', async route => {
    ids.push(route.request().postDataJSON().request_id);
    const result = await route.fetch();
    if (ids.length === 1) await route.abort('failed'); else await route.fulfill({ response: result });
  });
  await page.getByRole('button', { name: /Take the brass key/ }).click();
  await expect(page.getByRole('button', { name: 'Retry safely' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry safely' }).click();
  await expect(page.getByRole('heading', { name: 'The house knows your name.' })).toBeVisible();
  expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]);
  await expect(page.locator('.journal ul li')).toHaveCount(1);
});

test('keyboard entry, reduced motion and pending-navigation cancellation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await page.getByRole('button', { name: 'Start the experience' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Who tells your story?' })).toBeFocused();
  let release!: () => void;
  const gate = new Promise<void>(done => { release = done; });
  await page.route('**/api/sessions', async route => { await gate; await route.continue().catch(() => {}); });
  await page.getByRole('button', { name: 'Enter Blackthorn House' }).click();
  await page.getByRole('button', { name: '← Back to the entrance' }).click(); release();
  await expect(page.getByRole('button', { name: 'Start the experience' })).toBeVisible(); await fits(page);
});

test('listening hierarchy, collapsed details and persistent mobile controls', async ({ page }, info) => {
  await withoutRecordings(page);
  await enter(page);
  await expect(page.locator('.narrator-bar')).toContainText('The Archivist');
  // Mock scene (no real narration): the story text is expanded and starts in the first viewport.
  await expect(page.locator('.transcript')).toHaveAttribute('data-default', 'expanded');
  await expect(page.locator('.transcript')).toHaveAttribute('open', '');
  await expect(page.locator('.journal')).not.toHaveAttribute('open', '');
  await expect(page.locator('.player-diagnostics')).not.toHaveAttribute('open', '');
  const choices = page.getByRole('button', { name: /Take the brass key/ });
  expect((await page.locator('.narrative').boundingBox())!.y).toBeLessThan(page.viewportSize()!.height);
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await fits(page);
    await page.locator('.transcript summary').click();
    await choices.scrollIntoViewIfNeeded();
    await expect(page.locator('.narrator-bar')).toBeInViewport();
    await expect(page.getByRole('button', { name: '▶ Play demo audio' })).toBeInViewport();
    await page.locator('.transcript summary').click();
    await capture(page, info.outputPath(`story-${width}.png`));
  }
});

test('responsive landing and narrator cards remain usable', async ({ page }, info) => {
  await page.goto('/');
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fits(page);
    await expect(page.getByRole('heading', { name: /BLACKTHORN HOUSE/ })).toBeVisible();
    await capture(page, info.outputPath(`landing-${width}.png`));
    await page.getByRole('button', { name: 'Start the experience' }).click();
    await fits(page);
    await expect(page.getByRole('radio')).toHaveCount(3);
    await page.getByRole('radio', { name: 'The Medium' }).check();
    await expect(page.getByRole('radio', { name: 'The Medium' })).toBeChecked();
    await capture(page, info.outputPath(`narrators-${width}.png`));
    await page.getByRole('button', { name: '← Back to the entrance' }).click();
  }
});
