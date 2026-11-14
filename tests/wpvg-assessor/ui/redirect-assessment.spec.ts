/**
 * @file tests/wpvg-assessor/ui/redirect-assessment.spec.ts
 * Purpose: Verify redirect pages retain their own assessment and creation date.
 * Contents: Encoded-target loading, registration eligibility, and reviewed saves.
 */

import {
    chooseOption,
    confirmAssessment,
    expect,
    getPosts,
    openAssessor,
    test,
} from './fixtures.ts';

const title = '智代After Original SoundTrack';
const destination = "智代After ～It's a Wonderful Life～";
const redirectSource =
    '#REDIRECT [[智代After_～It%27s_a_Wonderful_Life～#音樂]]';
const options = {
    creationDates: {
        [title]: '2026-09-30T12:00:00Z',
        [destination]: '2006-12-22T11:25:21Z',
    },
    pageTitle: title,
    sourcePages: {
        [title]: { content: redirectSource, redirect: true },
    },
};

test('an encoded-target redirect opens using its own creation date and cancels without writes', async ({
    page,
}) => {
    const dialog = await openAssessor(page, options);

    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByRole('checkbox', {
            name: /^Register in the Video games new-page list/u,
        }),
    ).toBeChecked();
    await expect(
        dialog.getByRole('checkbox', {
            name: 'Register in the Video games new-page list (Created on September 30)',
            exact: true,
        }),
    ).toBeChecked();
    await expect(
        dialog.getByRole('textbox', { name: /New-page list/u }),
    ).toHaveCount(0);
    const calls = await page.evaluate(
        () => (globalThis as any).__fixture.calls,
    );
    expect(
        calls
            .filter((call: any) => call.rvdir === 'newer')
            .map((call: any) => call.titles),
    ).toContain(title);
    expect(
        calls.some(
            (call: any) =>
                call.redirects || String(call.titles).includes('%27'),
        ),
    ).toBe(false);
    expect(
        calls.flatMap((call: any) => String(call.titles ?? '').split('|')),
    ).not.toContain(destination);
    expect(await getPosts(page)).toEqual([]);

    await dialog
        .locator('.cdx-dialog__footer')
        .getByRole('button', { name: "Don't stage", exact: true })
        .click();
    await expect(dialog).toHaveCount(0);
    expect(await getPosts(page)).toEqual([]);
});

test('saving a redirect assessment edits only its original talk page', async ({
    page,
}) => {
    const dialog = await openAssessor(page, {
        ...options,
        alreadyRegistered: true,
    });
    await chooseOption(page, 'Shared class', 'Stub');
    const reviewedSource = await dialog
        .getByRole('textbox', {
            name: 'Ready-to-save lead-section source',
            exact: true,
        })
        .inputValue();
    expect(await getPosts(page)).toEqual([]);

    await confirmAssessment(page);
    await expect.poll(() => getPosts(page), { timeout: 15000 }).toHaveLength(1);
    const posts = await getPosts(page);
    expect(posts[0].title).toBe(`Talk:${title}`);
    expect(posts[0].text).toBe(
        `${reviewedSource}\n\n== Discussion ==\nKeep this discussion exactly.\n`,
    );
    expect(
        await page.evaluate(() => (globalThis as any).__fixture.listText),
    ).toContain(`{{vgc|${title}}}`);
});
