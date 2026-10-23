/**
 * @file tests/vg-stub-creator/ui/creator.spec.ts
 * Purpose: Exercises creator review, source editing, and save interactions in local fixtures.
 *
 * Table of contents:
 * 1. Imports
 * 2. Constants and state
 * 3. Test scenarios
 * 4. inspectDialog
 * 5. addRelatedChoice
 * 6. setRelatedEnabled
 * 7. expectSourcesAtBottom
 * 8. getRedirectRow
 */

import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Locator } from '@playwright/test';

import english from '../../../src/vg-stub-creator/i18n/en.json' with { type: 'json' };
import japanese from '../../../src/vg-stub-creator/i18n/ja.json' with { type: 'json' };
import russian from '../../../src/vg-stub-creator/i18n/ru.json' with { type: 'json' };
import simplified from '../../../src/vg-stub-creator/i18n/zh-Hans.json' with { type: 'json' };
import traditional from '../../../src/vg-stub-creator/i18n/zh-Hant.json' with { type: 'json' };
import {
    installCreatorScript,
    loadCreator,
    openCreator,
    readResourceLoads,
    readTitleChecks,
    readWrites,
    releaseResourceLoader,
} from './fixture.ts';

const locales = {
    en: english,
    ja: japanese,
    ru: russian,
    'zh-Hans': simplified,
    'zh-Hant': traditional,
};
const tabKeys = [
    'metadata.tab',
    'titles.tab',
    'text.tab',
    'references.tab',
] as const;

test('page launchers retain native portlet links and open dialogs with Enter', async ({
    page,
}) => {
    await loadCreator(page);
    const launcher = page.getByRole('link', {
        name: english['launcher.createStub'],
        exact: true,
    });
    await expect(
        page.locator('#kanade-vg-stub-creator-launcher'),
    ).toHaveJSProperty('tagName', 'LI');
    await expect(launcher).toHaveJSProperty('tagName', 'A');
    await launcher.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL('https://vg-creator.test/wiki/Star_Harbor');
    await loadCreator(page, { database: 'enwiki', articleId: 123 });
    const crossWikiLauncher = page.locator('#ca-create-zhwiki-vg-stub a');
    await expect(crossWikiLauncher).toHaveAttribute(
        'href',
        /zh\.wikipedia\.org/u,
    );
    await expect(crossWikiLauncher).toHaveAttribute('target', '_blank');
    await expect(crossWikiLauncher).toHaveAttribute('rel', 'noopener');
});

test('creator uses page-tools links without a bottom-right action', async ({
    page,
}) => {
    await loadCreator(page);
    await expect(page.locator('#kanade-quick-access')).toHaveCount(0);
    const launcher = page.locator('#kanade-vg-stub-creator-launcher a');
    await expect(launcher).toHaveText(english['launcher.createStub']);
    await expect(launcher).toHaveJSProperty('tagName', 'A');
    await launcher.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
        .getByRole('dialog')
        .getByRole('button', { name: english['common.close'], exact: true })
        .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(launcher).toBeFocused();
    expect(await readWrites(page)).toEqual([]);
    await loadCreator(page, { database: 'enwiki', articleId: 123 });
    await expect(page.locator('#kanade-quick-access')).toHaveCount(0);
    const crossWikiLauncher = page.locator('#ca-create-zhwiki-vg-stub a');
    await expect(crossWikiLauncher).toHaveText(
        english['launcher.createZhwikiStub'],
    );
    await expect(crossWikiLauncher).toHaveJSProperty('tagName', 'A');
    await expect(crossWikiLauncher).toHaveAttribute(
        'href',
        /zh\.wikipedia\.org/u,
    );
    await expect(crossWikiLauncher).toHaveAttribute('target', '_blank');
    await expect(crossWikiLauncher).toHaveAttribute('rel', /noopener/u);
    await page.evaluate(() => {
        const fixture = globalThis as any;
        fixture.__creatorQuickAccessTabs = [];
        fixture.open = (url: string, target: string) => {
            const tab = { location: { href: url }, target };
            fixture.__creatorQuickAccessTabs.push(tab);
            return tab;
        };
    });
    await crossWikiLauncher.focus();
    await page.keyboard.press('Enter');
    await expect
        .poll(() =>
            page.evaluate(() =>
                (globalThis as any).__creatorQuickAccessTabs.map(
                    (tab: { location: { href: string }; target: string }) => ({
                        target: tab.target,
                        destination: new URL(tab.location.href).origin,
                        activated: new URL(tab.location.href).searchParams.get(
                            'vg-stub-creator',
                        ),
                    }),
                ),
            ),
        )
        .toEqual([
            {
                target: '_blank',
                destination: 'https://zh.wikipedia.org',
                activated: '1',
            },
        ]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await readWrites(page)).toEqual([]);
});

for (const [locale, messages] of Object.entries(locales)) {
    for (const width of [320, 390, 768, 1440]) {
        test(`${locale} workflow fits ${width}px and labels each editable control`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 900 });
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await loadCreator(page, { locale });
            await openCreator(page);
            const dialog = page.getByRole('dialog');
            await expect(dialog).toHaveAttribute('lang', locale);
            await expect(
                dialog.getByText(messages['metadata.lookupFailed'], {
                    exact: false,
                }),
            ).toHaveCount(0);
            for (const tabKey of tabKeys) {
                const tab = dialog.getByRole('tab', {
                    name: messages[tabKey],
                    exact: true,
                });
                await tab.click();
                await expect(tab).toHaveAttribute('aria-selected', 'true');
                const issues = await dialog.evaluate(inspectDialog);
                expect(issues, `${locale}: ${tabKey} at ${width}px`).toEqual(
                    [],
                );
                if (tabKey === 'metadata.tab') {
                    const developer = dialog.locator(
                        '[data-kanade-vg-stub-creator-field="developers"]',
                    );
                    await expect(developer).toHaveJSProperty(
                        'tagName',
                        'FIELDSET',
                    );
                    await expect(
                        developer.getByText(messages['form.itemOrUrl'], {
                            exact: true,
                        }),
                    ).toBeVisible();
                    const items = developer.getByRole('group', {
                        name: messages['form.items'],
                        exact: true,
                    });
                    await expect(items).toHaveJSProperty('tagName', 'FIELDSET');
                    await expect(items.locator(':scope > legend')).toHaveText(
                        messages['form.items'],
                    );
                    await expect(items).toHaveCSS('border-width', '0px');
                    const sources = developer.locator(
                        '[data-kanade-vg-stub-creator-metadata-sources]',
                    );
                    await expect(sources).toHaveJSProperty(
                        'tagName',
                        'FIELDSET',
                    );
                    await expect(sources).toBeVisible();
                    await expect(sources.locator(':scope > legend')).toHaveText(
                        messages['form.sources'],
                    );
                    await expect(sources).toHaveCSS('border-width', '0px');
                    await expect(
                        sources.locator(
                            '[data-kanade-vg-stub-creator-metadata-reference]',
                        ),
                    ).toHaveCount(0);
                    const sections = developer.locator(
                        '.kanade-vg-stub-creator-metadata-editor > .cdx-field',
                    );
                    await expect(sections).toHaveCount(3);
                    expect(
                        await developer.evaluate((fieldset) => {
                            const style = getComputedStyle(fieldset);
                            return (
                                style.borderTopStyle === 'solid' &&
                                parseFloat(style.borderTopWidth) > 0 &&
                                parseFloat(style.paddingInlineStart) > 0
                            );
                        }),
                    ).toBe(true);
                    expect(
                        await sections.evaluateAll((fields) =>
                            fields.map((field) =>
                                field
                                    .querySelector(':scope > .cdx-label')
                                    ?.textContent?.trim(),
                            ),
                        ),
                    ).toEqual([
                        messages['form.itemOrUrl'],
                        messages['form.items'],
                        messages['form.sources'],
                    ]);
                }
                if (tabKey === 'text.tab') {
                    for (const [key, label] of [
                        ['metacriticScore', 'text.metacriticScore'],
                        ['openCriticRecommend', 'text.openCritic'],
                        ['additionalProse', 'text.additionalProse'],
                    ] as const) {
                        const field = dialog.locator(
                            `[data-kanade-vg-stub-creator-field="${key}"]`,
                        );
                        await expect(field).toHaveJSProperty(
                            'tagName',
                            'FIELDSET',
                        );
                        await expect(
                            field.locator(':scope > legend'),
                        ).toHaveText(messages[label]);
                        await expect(
                            field.getByText(messages['common.value'], {
                                exact: true,
                            }),
                        ).toBeVisible();
                        await expect(
                            field.getByText(messages['form.sourceUrls'], {
                                exact: true,
                            }),
                        ).toBeVisible();
                        await expect(
                            field.getByRole('textbox', {
                                name: messages[label],
                                exact: true,
                            }),
                        ).toBeVisible();
                    }
                }
            }
            const footer = await dialog
                .locator('.kanade-vg-stub-creator-dialog-footer-actions')
                .evaluate((actions) => {
                    const buttons = [
                        ...actions.querySelectorAll<HTMLButtonElement>(
                            'button',
                        ),
                    ];
                    const primary = buttons.findIndex((button) =>
                        button.classList.contains('cdx-button--weight-primary'),
                    );
                    const first = buttons[0]?.getBoundingClientRect();
                    return {
                        primary,
                        count: buttons.length,
                        firstWidth: first?.width ?? 0,
                        actionsWidth: actions.getBoundingClientRect().width,
                    };
                });
            expect(footer.primary).toBe(width <= 639 ? 0 : footer.count - 1);
            if (width <= 639)
                expect(footer.firstWidth).toBeGreaterThanOrEqual(
                    footer.actionsWidth * 0.9,
                );
            expect(errors).toEqual([]);
            expect(await readWrites(page)).toEqual([]);
        });
    }
}

test('Facts stay in one column and name sources retain responsive reading order', async ({
    page,
}) => {
    await loadCreator(page, { locale: 'ru' });
    await openCreator(page);
    const main = page.getByRole('dialog');
    for (const width of [1366, 683, 375]) {
        await page.setViewportSize({
            width,
            height: width === 375 ? 667 : 768,
        });
        await main
            .getByRole('tab', { name: russian['metadata.tab'], exact: true })
            .click();
        const englishLookup = await main
            .locator('[data-kanade-vg-stub-creator-field="enwikiTitle"]')
            .boundingBox();
        let previous = englishLookup!;
        for (const field of [
            'developers',
            'publishers',
            'series',
            'platforms',
            'year',
            'genres',
        ]) {
            const bounds = await main
                .locator(`[data-kanade-vg-stub-creator-field="${field}"]`)
                .boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds!.x).toBeCloseTo(englishLookup!.x, 0);
            expect(bounds!.width).toBeCloseTo(englishLookup!.width, 0);
            expect(bounds!.y).toBeGreaterThanOrEqual(
                previous.y + previous.height,
            );
            previous = bounds!;
        }
        expect(await main.evaluate(inspectDialog)).toEqual([]);
        await main
            .getByRole('tab', { name: russian['titles.tab'], exact: true })
            .click();
        const name = main
            .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
            .first()
            .getByRole('textbox', {
                name: russian['names.localizedName'] + ' 1',
                exact: true,
            });
        const source = main
            .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
            .first()
            .getByRole('textbox', {
                name: russian['names.sourceUrls'] + ' 1',
                exact: true,
            });
        await name.focus();
        await page.keyboard.press('Tab');
        await expect(source).toBeFocused();
        const nameBounds = await name.boundingBox();
        const sourceBounds = await source.boundingBox();
        if (width >= 960) {
            expect(Math.abs(nameBounds!.y - sourceBounds!.y)).toBeLessThan(2);
            expect(sourceBounds!.x).toBeGreaterThanOrEqual(
                nameBounds!.x + nameBounds!.width,
            );
        } else {
            expect(Math.abs(nameBounds!.x - sourceBounds!.x)).toBeLessThan(2);
            expect(sourceBounds!.y).toBeGreaterThanOrEqual(
                nameBounds!.y + nameBounds!.height,
            );
        }
        expect(await main.evaluate(inspectDialog)).toEqual([]);
    }
    expect(await readWrites(page)).toEqual([]);
});

test('Names and Article text commit source URLs into removable vertical lists', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    for (const [tabKey, selector, inputName, prefix] of [
        [
            'titles.tab',
            '[data-kanade-vg-stub-creator-name-kind="localized"]',
            english['names.sourceUrls'] + ' 1',
            'name',
        ],
        [
            'text.tab',
            '[data-kanade-vg-stub-creator-field="additionalProse"]',
            english['form.sourceUrlsFor'].replace(
                '{field}',
                english['text.additionalProse'],
            ),
            'prose',
        ],
    ] as const) {
        await main
            .getByRole('tab', { name: english[tabKey], exact: true })
            .click();
        const field = main.locator(selector).first();
        const sources = field.locator(
            '[data-kanade-vg-stub-creator-source-input]',
        );
        const input = sources.getByRole('textbox', {
            name: inputName,
            exact: true,
        });
        const list = sources.locator('.kanade-vg-stub-creator-source-list');
        const rows = list.locator('[data-kanade-vg-stub-creator-source-url]');
        const firstUrl = `https://example.test/${prefix}/first`;
        const secondUrl = `https://example.test/${prefix}/second`;
        const thirdUrl = `https://example.test/${prefix}/${'long-source-path/'.repeat(8)}`;
        await expect(input).toHaveJSProperty('tagName', 'INPUT');
        await input.fill(firstUrl);
        await expect(rows).toHaveCount(0);
        await input.dispatchEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            isComposing: true,
        });
        await expect(input).toHaveValue(firstUrl);
        await expect(rows).toHaveCount(0);
        await input.press('Enter');
        await expect(input).toHaveValue('');
        await expect(rows.getByRole('link')).toHaveText([firstUrl]);
        const pastePrevented = await input.evaluate((element, value) => {
            const clipboardData = new DataTransfer();
            clipboardData.setData('text/plain', value);
            const event = new ClipboardEvent('paste', {
                clipboardData,
                bubbles: true,
                cancelable: true,
            });
            element.dispatchEvent(event);
            return event.defaultPrevented;
        }, `${firstUrl}\n${secondUrl}\n${secondUrl}`);
        expect(pastePrevented).toBe(true);
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('');
        await input.blur();
        await expect(rows.getByRole('link')).toHaveText([firstUrl, secondUrl]);
        await input.fill(thirdUrl);
        await input.blur();
        await expect(input).toHaveValue('');
        await expect(rows.getByRole('link')).toHaveText([
            firstUrl,
            secondUrl,
            thirdUrl,
        ]);
        await input.fill(firstUrl);
        await input.press('Enter');
        await expect(input).toHaveValue('');
        await expect(rows).toHaveCount(3);
        await rows
            .nth(1)
            .getByRole('button', {
                name: english['form.removeReference'].replace(
                    '{url}',
                    secondUrl,
                ),
                exact: true,
            })
            .click();
        await expect(rows.getByRole('link')).toHaveText([firstUrl, thirdUrl]);
        await expect(rows.last().getByRole('button')).toBeFocused();
        await expect(rows.getByRole('link').first()).toHaveAttribute(
            'href',
            firstUrl,
        );
        await expect(sources).toHaveCSS('border-width', '0px');
        await expect(list).toHaveCSS('border-width', '0px');
        for (const row of await rows.all())
            await expect(row).toHaveCSS('border-width', '0px');
        for (const width of [1366, 683, 375]) {
            await page.setViewportSize({
                width,
                height: width === 375 ? 667 : 768,
            });
            const first = await rows.first().boundingBox();
            const last = await rows.last().boundingBox();
            expect(first).not.toBeNull();
            expect(last).not.toBeNull();
            expect(last!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
            for (const button of await rows.getByRole('button').all()) {
                const bounds = await button.evaluate((element) => ({
                    scrollWidth: element.scrollWidth,
                    clientWidth: element.clientWidth,
                }));
                expect(
                    bounds.scrollWidth,
                    `${prefix} source Remove label fits at ${width}px`,
                ).toBeLessThanOrEqual(bounds.clientWidth);
            }
            expect(await main.evaluate(inspectDialog)).toEqual([]);
        }
        await main
            .getByRole('tab', {
                name: english['metadata.tab'],
                exact: true,
            })
            .click();
        await main
            .getByRole('tab', { name: english[tabKey], exact: true })
            .click();
        await expect(input).toHaveValue('');
        await expect(rows.getByRole('link')).toHaveText([firstUrl, thirdUrl]);
    }
    expect(await readWrites(page)).toEqual([]);
});

function inspectDialog(dialog: HTMLElement): string[] {
    const issues: string[] = [];
    const rect = dialog.getBoundingClientRect();
    if (rect.left < -1 || rect.right > innerWidth + 1)
        issues.push('horizontal dialog overflow');
    if (rect.top < -1 || rect.bottom > innerHeight + 1)
        issues.push('vertical dialog overflow');
    if (document.documentElement.scrollWidth > innerWidth + 1)
        issues.push('horizontal page overflow');
    const body = dialog.querySelector<HTMLElement>('.cdx-dialog__body');
    if (body && body.scrollWidth > body.clientWidth + 1)
        issues.push('horizontal body overflow');
    const controls = dialog.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('input:not([type=hidden]), textarea, select');
    for (const control of controls) {
        if (
            !control.getClientRects().length ||
            control.closest('[aria-hidden=true]')
        )
            continue;
        const ids = (control.getAttribute('aria-labelledby') ?? '').split(
            /\s+/u,
        );
        const referenced = ids
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join('');
        const labels = [...(control.labels ?? [])]
            .map((label) => label.textContent)
            .join('');
        const name =
            control.getAttribute('aria-label') ||
            referenced.trim() ||
            labels.trim();
        if (!name) issues.push(`missing accessible name: ${control.tagName}`);
    }
    const primary = dialog.querySelectorAll('.cdx-button--weight-primary');
    if (primary.length !== 1) issues.push('expected one primary action');
    return issues;
}

async function addRelatedChoice(
    field: Locator,
    value: string,
    owner?: Locator,
): Promise<void> {
    await (owner ?? field)
        .locator('[data-kanade-vg-stub-creator-related-add-button]')
        .first()
        .click();
    const input = field.locator('[data-kanade-vg-stub-creator-related-entry]');
    await expect(input).toBeFocused();
    await input.fill(value);
    await input.blur();
}

async function setRelatedEnabled(
    link: Locator,
    enabled: boolean,
): Promise<void> {
    await expect(link).toHaveAttribute(
        'data-kanade-vg-stub-creator-enabled',
        /^(?:true|false)$/u,
    );
    if (
        (await link.getAttribute('data-kanade-vg-stub-creator-enabled')) !==
        String(enabled)
    ) {
        await link.click();
    }
    await expect(link).toHaveAttribute(
        'data-kanade-vg-stub-creator-enabled',
        String(enabled),
    );
}

async function expectSourcesAtBottom(field: Locator): Promise<void> {
    await expect(
        field.locator('[data-kanade-vg-stub-creator-metadata-sources]'),
    ).toBeVisible();
    expect(
        await field.evaluate((card) => {
            const sources = card.querySelector(
                '[data-kanade-vg-stub-creator-metadata-sources]',
            );
            const items = [
                ...card.querySelectorAll(
                    '[data-kanade-vg-stub-creator-metadata-item]',
                ),
            ];
            return (
                sources !== null &&
                items.length > 0 &&
                items.every((item) =>
                    Boolean(
                        item.compareDocumentPosition(sources) &
                        Node.DOCUMENT_POSITION_FOLLOWING,
                    ),
                )
            );
        }),
    ).toBe(true);
}

test('review remains editable and requires confirmation before any write', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    await main
        .getByRole('textbox', {
            name: english['metadata.developers'],
            exact: true,
        })
        .fill('Nintendo');
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    const preview = page.getByRole('dialog').filter({
        has: page.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    });
    await expect(preview).toBeVisible();
    const wikitext = preview.getByRole('textbox', {
        name: english['preview.wikitext'],
        exact: true,
    });
    await expect(wikitext).toHaveValue(
        /^\{\{NoteTA-lite\n\| G1 = Games\n\}\}/u,
    );
    await expect(wikitext).toHaveValue(/\{\{Infobox VG/u);
    await wikitext.fill('   ');
    await preview
        .getByRole('button', { name: english['preview.continue'], exact: true })
        .click();
    await expect(
        preview.getByText(english['validation.required'], { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('dialog', {
            name: english['presave.title'],
            exact: true,
        }),
    ).toHaveCount(0);
    expect(await readWrites(page)).toEqual([]);
    await wikitext.fill('Reviewed article text from the editor.');
    await preview
        .getByRole('button', { name: english['preview.continue'], exact: true })
        .click();
    const confirmation = page.getByRole('dialog', {
        name: english['presave.title'],
        exact: true,
    });
    await expect(confirmation).toBeVisible();
    await expect(
        confirmation.getByRole('button', {
            name: english['presave.save'],
            exact: true,
        }),
    ).toBeVisible();
    expect(await readWrites(page)).toEqual([]);
    await confirmation
        .getByRole('button', { name: english['common.close'], exact: true })
        .click();
    expect(await readWrites(page)).toEqual([]);
});

test('each metadata field counts names and routes URLs to its sources', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    for (const [fieldKey, messageKey, value] of [
        ['publishers', 'metadata.publishers', 'Unlisted publisher'],
        ['developers', 'metadata.developers', 'Nintendo'],
        ['series', 'metadata.series', 'Example series'],
        ['platforms', 'metadata.platforms', 'Nintendo Switch'],
        ['year', 'metadata.releaseYear', '2024'],
        ['genres', 'metadata.genres', 'music'],
    ] as const) {
        const field = main.locator(
            `[data-kanade-vg-stub-creator-field="${fieldKey}"]`,
        );
        await expect(
            field.locator('.kanade-vg-stub-creator-metadata-entry-help'),
        ).toHaveCount(0);
        const label = english[messageKey];
        const input = field.getByRole('textbox', { name: label, exact: true });
        await expect(
            field.getByText(`${label} (0)`, { exact: true }),
        ).toBeVisible();
        await input.fill(value);
        await input.press('Enter');
        await expect(input).toHaveValue('');
        await expect(
            field.locator('[data-kanade-vg-stub-creator-metadata-item]'),
        ).toHaveCount(1);
        await expect(
            field.getByText(`${label} (1)`, { exact: true }),
        ).toBeVisible();
        const sourceUrl = `https://example.test/${fieldKey}`;
        await input.fill(sourceUrl);
        await input.blur();
        await expect(input).toHaveValue('');
        await expect(
            field.locator('[data-kanade-vg-stub-creator-metadata-item]'),
        ).toHaveCount(1);
        const reference = field.locator(
            '[data-kanade-vg-stub-creator-metadata-reference]',
        );
        await expect(reference.getByRole('link')).toHaveAttribute(
            'href',
            sourceUrl,
        );
        await expectSourcesAtBottom(field);
        await reference.getByRole('button').click();
        await expect(reference).toHaveCount(0);
        await expect(
            field.getByText(`${label} (1)`, { exact: true }),
        ).toBeVisible();
    }
    expect(await readWrites(page)).toEqual([]);
});

test('pasting metadata immediately adds names and sources while typing waits for commit', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    const field = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    const entry = field.getByRole('textbox', {
        name: english['metadata.developers'],
        exact: true,
    });
    await entry.focus();
    const wasDefaultPrevented = await entry.evaluate((element) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData(
            'text/plain',
            'Nintendo; Unlisted Studio\nhttps://example.test/pasted-source',
        );
        const event = new ClipboardEvent('paste', {
            clipboardData,
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(event);
        return event.defaultPrevented;
    });
    expect(wasDefaultPrevented).toBe(true);
    await expect(entry).toBeFocused();
    await expect(entry).toHaveValue('');
    await expect(
        field.locator('[data-kanade-vg-stub-creator-metadata-item]'),
    ).toHaveCount(2);
    await expect(
        field
            .locator('[data-kanade-vg-stub-creator-metadata-reference]')
            .getByRole('link'),
    ).toHaveAttribute('href', 'https://example.test/pasted-source');
    await entry.fill('Typed Studio');
    await expect(
        field.locator('[data-kanade-vg-stub-creator-metadata-item]'),
    ).toHaveCount(2);
    await entry.blur();
    await expect(
        field.locator('[data-kanade-vg-stub-creator-metadata-item]'),
    ).toHaveCount(3);
    expect(await readWrites(page)).toEqual([]);
});

test('metadata rows preserve unchecked names, support editing and removal, and own their related pages', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    const publisher = main.getByRole('textbox', {
        name: english['metadata.publishers'],
        exact: true,
    });
    await publisher.fill('Independent publisher');
    await publisher.blur();
    const field = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    const entry = field.getByRole('textbox', {
        name: english['metadata.developers'],
        exact: true,
    });
    await entry.fill('Nintendo, Unlisted Studio');
    await entry.press('Enter');
    const items = field.locator('[data-kanade-vg-stub-creator-metadata-item]');
    await expect(items).toHaveCount(2);
    const nintendo = items.first();
    await expect(nintendo.getByRole('textbox')).toHaveValue('[[任天堂]]');
    await expect(
        nintendo.locator('.kanade-vg-stub-creator-metadata-item-link'),
    ).toHaveCount(0);
    await expect(
        nintendo
            .locator('.kanade-vg-stub-creator-metadata-name')
            .getByRole('button'),
    ).toHaveCount(0);
    await expect(
        nintendo.getByRole('link', { name: '任天堂游戏', exact: true }),
    ).toBeVisible();
    const unlisted = items.nth(1);
    await expect(unlisted.getByRole('textbox')).toHaveValue('Unlisted Studio');
    const nintendoBounds = await nintendo.boundingBox();
    const unlistedBounds = await unlisted.boundingBox();
    expect(nintendoBounds).not.toBeNull();
    expect(unlistedBounds).not.toBeNull();
    expect(unlistedBounds!.y).toBeGreaterThanOrEqual(
        nintendoBounds!.y + nintendoBounds!.height,
    );
    await expect(
        unlisted.locator('.kanade-vg-stub-creator-metadata-item-link'),
    ).toHaveCount(0);
    await expect(
        unlisted.getByRole('link', { name: '任天堂游戏', exact: true }),
    ).toHaveCount(0);
    const includeNintendo = nintendo.getByRole('checkbox', {
        name: '任天堂',
        exact: true,
    });
    await includeNintendo.uncheck();
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    const preview = page.getByRole('dialog').filter({
        has: page.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    });
    const wikitext = preview.getByRole('textbox', {
        name: english['preview.wikitext'],
        exact: true,
    });
    await expect(wikitext).toHaveValue(/Unlisted Studio/u);
    await expect(wikitext).not.toHaveValue(/\[\[任天堂\]\]/u);
    await preview
        .getByRole('button', { name: english['preview.dismiss'], exact: true })
        .click();
    await expect(nintendo.getByRole('textbox')).toHaveValue('[[任天堂]]');
    await expect(includeNintendo).not.toBeChecked();
    await includeNintendo.check();
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    await expect(wikitext).toHaveValue(/\[\[任天堂\]\]/u);
    await preview
        .getByRole('button', { name: english['preview.dismiss'], exact: true })
        .click();
    await unlisted.getByRole('textbox').fill('Renamed Studio');
    await unlisted.getByRole('textbox').blur();
    await expect(unlisted.getByRole('textbox')).toHaveValue('Renamed Studio');
    await unlisted.getByRole('textbox').fill('');
    await unlisted.getByRole('textbox').blur();
    await expect(items).toHaveCount(1);
    await expect(
        field.getByText('Developers (1)', { exact: true }),
    ).toBeVisible();
    await entry.fill('Replacement Studio');
    await entry.blur();
    await expect(items).toHaveCount(2);
    await expect(items.nth(1).getByRole('textbox')).toHaveValue(
        'Replacement Studio',
    );
    await items.nth(1).getByRole('textbox').fill('');
    await items.nth(1).getByRole('textbox').press('Enter');
    await expect(items).toHaveCount(1);
    expect(await readWrites(page)).toEqual([]);
});

test('renaming a metadata item drops its untouched automatic stub suggestion', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    const publisher = main.getByRole('textbox', {
        name: english['metadata.publishers'],
        exact: true,
    });
    await publisher.fill('Independent publisher');
    await publisher.blur();
    const field = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    const entry = field.getByRole('textbox', {
        name: english['metadata.developers'],
        exact: true,
    });
    await entry.fill('Nintendo');
    await entry.press('Enter');
    const item = field
        .locator('[data-kanade-vg-stub-creator-metadata-item]')
        .first();
    const stub = item.locator('.kanade-vg-stub-creator-related-item').filter({
        has: page.getByRole('link', { name: '{{Nintendo-stub}}', exact: true }),
    });
    await setRelatedEnabled(stub.getByRole('link'), true);
    await item.getByRole('textbox').fill('Unknown Studio');
    await item.getByRole('textbox').blur();
    await expect(item.getByRole('textbox')).toHaveValue('Unknown Studio');
    await expect(
        main.getByRole('link', { name: '{{Nintendo-stub}}', exact: true }),
    ).toHaveCount(0);
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    const wikitext = page.getByRole('textbox', {
        name: english['preview.wikitext'],
        exact: true,
    });
    await expect(wikitext).toHaveValue(/Unknown Studio/u);
    await expect(wikitext).not.toHaveValue(/Nintendo-stub|\[\[任天堂\]\]/u);
    expect(await readWrites(page)).toEqual([]);
});

test('duplicate metadata aliases reuse their row, clear the entry, and reenable an unchecked item', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    const field = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    const entry = field.getByRole('textbox', {
        name: english['metadata.developers'],
        exact: true,
    });
    await entry.fill('Nintendo');
    await entry.press('Enter');
    const items = field.locator('[data-kanade-vg-stub-creator-metadata-item]');
    await expect(items).toHaveCount(1);
    const originalId = await items
        .first()
        .getAttribute('data-kanade-vg-stub-creator-metadata-item');
    await expect(
        items.first().getByRole('link', { name: '任天堂游戏', exact: true }),
    ).toBeVisible();
    await entry.fill('任天堂');
    await entry.press('Enter');
    await expect(entry).toHaveValue('');
    await expect(items).toHaveCount(1);
    const included = items
        .first()
        .getByRole('checkbox', { name: '任天堂', exact: true });
    await included.uncheck();
    await entry.focus();
    await entry.evaluate((element) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', 'NINTENDO');
        element.dispatchEvent(
            new ClipboardEvent('paste', {
                clipboardData,
                bubbles: true,
                cancelable: true,
            }),
        );
    });
    await expect(entry).toHaveValue('');
    await expect(entry).toBeFocused();
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveAttribute(
        'data-kanade-vg-stub-creator-metadata-item',
        originalId!,
    );
    await expect(included).toBeChecked();
    expect(errors).toEqual([]);
    expect(await readWrites(page)).toEqual([]);
});

test('related labels open name editors and blank names remove choices without restoring them', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    const field = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    const entry = field.getByRole('textbox', {
        name: english['metadata.developers'],
        exact: true,
    });
    await entry.fill('Nintendo');
    await entry.blur();
    const item = field
        .locator('[data-kanade-vg-stub-creator-metadata-item]')
        .first();
    await expect(
        item.locator('[data-kanade-vg-stub-creator-related-add-button]'),
    ).toHaveCount(1);
    await expect(
        item
            .locator('[data-kanade-vg-stub-creator-related-row]')
            .getByRole('checkbox'),
    ).toHaveCount(0);
    await expect(
        item.locator(
            '[data-related-edit-button], [data-related-remove-button], .kanade-vg-stub-creator-related-existence',
        ),
    ).toHaveCount(0);
    await field
        .getByRole('link', { name: '任天堂游戏', exact: true })
        .dblclick();
    const categoryInput = field.getByRole('textbox', {
        name: english['review.categoryName'],
        exact: true,
    });
    await expect(categoryInput).toBeFocused();
    await categoryInput.fill('');
    await categoryInput.blur();
    await expect(
        field.getByRole('link', { name: '任天堂游戏', exact: true }),
    ).toHaveCount(0);
    await field
        .getByRole('link', { name: '{{Nintendo-stub}}', exact: true })
        .dblclick();
    const stubInput = field.getByRole('textbox', {
        name: english['review.templateName'],
        exact: true,
    });
    await stubInput.fill('{{Reviewed-stub}}');
    await stubInput.press('Enter');
    await entry.focus();
    await expect(
        field.getByRole('link', { name: '{{Reviewed-stub}}', exact: true }),
    ).toBeVisible();
    await entry.fill('Unlisted Studio');
    await entry.blur();
    await expect(
        field.getByRole('link', { name: '任天堂游戏', exact: true }),
    ).toHaveCount(0);
    await expect(
        field.getByRole('link', { name: '{{Reviewed-stub}}', exact: true }),
    ).toBeVisible();
    await expect(
        field.getByRole('link', { name: '{{Nintendo-stub}}', exact: true }),
    ).toHaveCount(0);
    await field
        .getByRole('link', { name: '{{Reviewed-stub}}', exact: true })
        .dblclick();
    await stubInput.fill('');
    await expect(stubInput).toBeFocused();
    await stubInput.press('Escape');
    await expect(
        field.getByRole('link', { name: '{{Reviewed-stub}}', exact: true }),
    ).toBeVisible();
    await field
        .getByRole('link', { name: '{{Reviewed-stub}}', exact: true })
        .dblclick();
    await stubInput.fill('');
    await stubInput.press('Enter');
    await expect(
        field.getByRole('link', { name: '{{Reviewed-stub}}', exact: true }),
    ).toHaveCount(0);
    expect(await readWrites(page)).toEqual([]);
});

test('one related add control assigns plain names to categories and template calls to navboxes or stubs', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    await expect(main.getByRole('tab')).toHaveCount(4);
    for (const [key, value] of [
        ['metadata.developers', 'Nintendo'],
        ['metadata.platforms', 'Nintendo Switch'],
        ['metadata.genres', 'music'],
    ] as const) {
        const input = main.getByRole('textbox', {
            name: english[key],
            exact: true,
        });
        await input.fill(value);
        await input.blur();
    }
    const developer = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    const item = developer
        .locator('[data-kanade-vg-stub-creator-metadata-item]')
        .first();
    const nintendo = item
        .locator(
            '.kanade-vg-stub-creator-related-section[data-kanade-vg-stub-creator-kind="category"] .kanade-vg-stub-creator-related-item',
        )
        .filter({ hasText: '任天堂游戏' });
    await expect(nintendo.getByRole('link')).toHaveText('任天堂游戏');
    await setRelatedEnabled(nintendo.getByRole('link'), false);
    const platforms = main.locator(
        '[data-kanade-vg-stub-creator-field="platforms"]',
    );
    const platformCategory = platforms
        .locator(
            '.kanade-vg-stub-creator-related-section[data-kanade-vg-stub-creator-kind="category"]',
        )
        .getByRole('link');
    await setRelatedEnabled(platformCategory, true);
    const musicStub = main
        .locator(
            '[data-kanade-vg-stub-creator-field="genres"] .kanade-vg-stub-creator-related-item',
        )
        .filter({
            has: page.getByRole('link', {
                name: '{{music-videogame-stub}}',
                exact: true,
            }),
        });
    await setRelatedEnabled(musicStub.getByRole('link'), false);
    const platformInput = platforms.getByRole('textbox', {
        name: english['metadata.platforms'],
        exact: true,
    });
    await platformInput.fill('Nintendo Switch, iOS');
    await platformInput.blur();
    await expect(nintendo.getByRole('link')).toHaveAttribute(
        'data-kanade-vg-stub-creator-enabled',
        'false',
    );
    await expect(musicStub.getByRole('link')).toHaveAttribute(
        'data-kanade-vg-stub-creator-enabled',
        'false',
    );
    for (const [kind, value] of [
        ['category', 'Manual games'],
        ['navbox', '{{Manual navbox}}'],
        ['stubTag', '{{Manual-stub}}'],
    ] as const) {
        await addRelatedChoice(developer, value, item);
        const row = item
            .locator(
                '.kanade-vg-stub-creator-related-section[data-kanade-vg-stub-creator-kind="' +
                    kind +
                    '"] .kanade-vg-stub-creator-related-item',
            )
            .filter({
                has: page.getByRole('link', { name: value, exact: true }),
            });
        await expect(row.getByRole('link')).toBeVisible();
        await setRelatedEnabled(row.getByRole('link'), true);
    }
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    const wikitext = page.getByRole('textbox', {
        name: english['preview.wikitext'],
        exact: true,
    });
    await expect(wikitext).toHaveValue(/\[\[Category:Manual games\]\]/u);
    await expect(wikitext).toHaveValue(/\{\{Manual navbox\}\}/u);
    await expect(wikitext).toHaveValue(/\{\{Manual-stub\}\}/u);
    await expect(wikitext).toHaveValue(/\[\[Category:任天堂Switch游戏\]\]/u);
    await expect(wikitext).not.toHaveValue(/\[\[Category:任天堂游戏\]\]/u);
    await expect(wikitext).not.toHaveValue(/\{\{music-videogame-stub\}\}/u);
    expect(await readWrites(page)).toEqual([]);
});

test('related link colors reflect API-confirmed existing, missing, and failed title checks', async ({
    page,
}) => {
    await loadCreator(page, {
        existingTitles: [
            'Category:Known games',
            'Template:Known navbox',
            'Template:Known-stub',
        ],
        failedTitles: ['Category:Failed games'],
    });
    await openCreator(page);
    const main = page.getByRole('dialog');
    const field = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    for (const [value, label, title, existence, color] of [
        [
            'Known games',
            'Known games',
            'Category:Known games',
            'exists',
            'rgb(51, 102, 204)',
        ],
        [
            'Missing games',
            'Missing games',
            'Category:Missing games',
            'missing',
            'rgb(215, 51, 51)',
        ],
        [
            '{{Known navbox}}',
            '{{Known navbox}}',
            'Template:Known navbox',
            'exists',
            'rgb(51, 102, 204)',
        ],
        [
            '{{Missing navbox}}',
            '{{Missing navbox}}',
            'Template:Missing navbox',
            'missing',
            'rgb(215, 51, 51)',
        ],
        [
            '{{Known-stub}}',
            '{{Known-stub}}',
            'Template:Known-stub',
            'exists',
            'rgb(51, 102, 204)',
        ],
        [
            '{{Missing-stub}}',
            '{{Missing-stub}}',
            'Template:Missing-stub',
            'missing',
            'rgb(215, 51, 51)',
        ],
        [
            'Failed games',
            'Failed games',
            'Category:Failed games',
            'unchecked',
            'rgb(32, 33, 34)',
        ],
    ] as const) {
        await addRelatedChoice(field, value);
        const link = field.getByRole('link', { name: label, exact: true });
        await setRelatedEnabled(link, true);
        await expect(link).toHaveAttribute(
            'data-kanade-vg-stub-creator-existence',
            existence,
        );
        await expect.poll(() => readTitleChecks(page)).toContain(title);
        await expect(link).toHaveCSS('color', color);
    }
    expect(await readWrites(page)).toEqual([]);
});

test('bundled terminology suggestions receive actual API checks and modifier clicks retain navigation', async ({
    page,
}) => {
    await loadCreator(page, { existingTitles: ['Category:任天堂游戏'] });
    await openCreator(page);
    const main = page.getByRole('dialog');
    const field = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    const entry = field.getByRole('textbox', {
        name: english['metadata.developers'],
        exact: true,
    });
    await entry.fill('Nintendo');
    await entry.press('Enter');
    const category = field.getByRole('link', {
        name: '任天堂游戏',
        exact: true,
    });
    const stub = field.getByRole('link', {
        name: '{{Nintendo-stub}}',
        exact: true,
    });
    await setRelatedEnabled(category, true);
    await setRelatedEnabled(stub, true);
    await expect(category).toHaveAccessibleDescription(/included/iu);
    await expect(category).toHaveAttribute(
        'data-kanade-vg-stub-creator-existence',
        'exists',
    );
    await expect(stub).toHaveAttribute(
        'data-kanade-vg-stub-creator-existence',
        'missing',
    );
    await expect
        .poll(() => readTitleChecks(page))
        .toContain('Category:任天堂游戏');
    await expect
        .poll(() => readTitleChecks(page))
        .toContain('Template:Nintendo-stub');
    await expect(category).toHaveAttribute('href', /Category/u);
    for (const modifier of ['ctrlKey', 'metaKey'] as const) {
        const prevented = await category.evaluate((element, modifier) => {
            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                [modifier]: true,
            });
            let preventedByTool = false;
            element.addEventListener(
                'click',
                (event) => {
                    preventedByTool = event.defaultPrevented;
                    event.preventDefault();
                },
                { once: true },
            );
            element.dispatchEvent(event);
            return preventedByTool;
        }, modifier);
        expect(prevented).toBe(false);
        const keyboardPrevented = await category.evaluate(
            (element, modifier) => {
                const event = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    bubbles: true,
                    cancelable: true,
                    [modifier]: true,
                });
                element.dispatchEvent(event);
                return event.defaultPrevented;
            },
            modifier,
        );
        expect(keyboardPrevented).toBe(false);
        await expect(category).toHaveAttribute(
            'data-kanade-vg-stub-creator-enabled',
            'true',
        );
        await expect(
            field.getByRole('textbox', {
                name: english['review.categoryName'],
                exact: true,
            }),
        ).toHaveCount(0);
    }
    await category.click();
    await expect(category).toHaveAttribute(
        'data-kanade-vg-stub-creator-enabled',
        'false',
    );
    await expect(category).toHaveAccessibleDescription(/excluded/iu);
    await expect(category).toHaveCSS('color', 'rgb(84, 89, 93)');
    await expect(category).toHaveCSS('text-decoration-line', 'line-through');
    await category.focus();
    await category.press('Space');
    await expect(category).toHaveAttribute(
        'data-kanade-vg-stub-creator-enabled',
        'true',
    );
    await category.press('Enter');
    const categoryInput = field.getByRole('textbox', {
        name: english['review.categoryName'],
        exact: true,
    });
    await expect(categoryInput).toBeFocused();
    await categoryInput.fill('Discarded category');
    await categoryInput.press('Escape');
    await expect(category).toBeVisible();
    await expect(
        field.getByRole('link', { name: 'Discarded category', exact: true }),
    ).toHaveCount(0);
    await category.dblclick();
    await expect(
        field.getByRole('textbox', {
            name: english['review.categoryName'],
            exact: true,
        }),
    ).toBeFocused();
    expect(await readWrites(page)).toEqual([]);
});

test('dialog links underline only while a navigation modifier is held over them', async ({
    page,
}) => {
    await loadCreator(page, { existingTitles: ['Category:任天堂游戏'] });
    await openCreator(page);
    const main = page.getByRole('dialog');
    const enwiki = main.getByRole('textbox', {
        name: english['metadata.enwikiPage'],
        exact: true,
    });
    await enwiki.fill('Star Harbor');
    await enwiki.blur();
    const helperLink = main
        .locator('.kanade-vg-stub-creator-enwiki-help a')
        .first();
    await expect(helperLink).toBeVisible();
    const field = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    const entry = field.getByRole('textbox', {
        name: english['metadata.developers'],
        exact: true,
    });
    await entry.fill('Nintendo');
    await entry.press('Enter');
    const category = field.getByRole('link', {
        name: '任天堂游戏',
        exact: true,
    });
    await setRelatedEnabled(category, true);
    await entry.fill('https://example.test/developer-source');
    await entry.blur();
    const source = field
        .locator('[data-kanade-vg-stub-creator-metadata-reference]')
        .getByRole('link');
    await expectSourcesAtBottom(field);
    for (const link of [category, source, helperLink]) {
        await page.mouse.move(2, 2);
        await expect(link).toHaveCSS('text-decoration-line', 'none');
        await link.focus();
        await expect(link).toBeFocused();
        await expect(link).toHaveCSS('text-decoration-line', 'none');
        await link.hover();
        await expect(link).toHaveCSS('text-decoration-line', 'none');

        for (const modifier of ['Control', 'Meta'] as const) {
            // Key changes must update a link even when the pointer does not move.
            await page.keyboard.down(modifier);
            await expect(link).toHaveCSS('text-decoration-line', 'underline');
            await page.keyboard.up(modifier);
            await expect(link).toHaveCSS('text-decoration-line', 'none');

            await page.mouse.move(2, 2);
            await page.keyboard.down(modifier);
            await expect(link).toHaveCSS('text-decoration-line', 'none');
            await link.hover();
            await expect(link).toHaveCSS('text-decoration-line', 'underline');
            await page.mouse.move(2, 2);
            await expect(link).toHaveCSS('text-decoration-line', 'none');
            await link.hover();
            await expect(link).toHaveCSS('text-decoration-line', 'underline');
            await page.evaluate(() => window.dispatchEvent(new Event('blur')));
            await expect(link).toHaveCSS('text-decoration-line', 'none');
            await page.keyboard.up(modifier);
        }
    }

    await setRelatedEnabled(category, false);
    await category.focus();
    await expect(category).toHaveCSS('text-decoration-line', 'line-through');
    await category.hover();
    await expect(category).toHaveCSS('text-decoration-line', 'line-through');
    for (const modifier of ['Control', 'Meta'] as const) {
        await page.keyboard.down(modifier);
        await expect(category).toHaveCSS(
            'text-decoration-line',
            /^(?:underline line-through|line-through underline)$/u,
        );
        await page.keyboard.up(modifier);
        await expect(category).toHaveCSS(
            'text-decoration-line',
            'line-through',
        );
    }
    await expect(category).toHaveAttribute(
        'data-kanade-vg-stub-creator-enabled',
        'false',
    );
    expect(await readWrites(page)).toEqual([]);
});

test('inline related-page editing stages reviewed source without writing', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    const field = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    await addRelatedChoice(field, '{{Reviewed navbox}}');
    const section = field.locator(
        '.kanade-vg-stub-creator-related-section[data-kanade-vg-stub-creator-kind="navbox"]',
    );
    const row = section.locator('.kanade-vg-stub-creator-related-item').first();
    await row
        .getByRole('link', { name: '{{Reviewed navbox}}', exact: true })
        .dblclick();
    const pageAction = row.getByRole('button', {
        name: 'create page',
        exact: true,
    });
    for (const width of [1024, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await expect(pageAction).toBeVisible();
        const inputBox = await row.getByRole('textbox').boundingBox();
        const actionBox = await pageAction.boundingBox();
        expect(inputBox).not.toBeNull();
        expect(actionBox).not.toBeNull();
        if (inputBox && actionBox) {
            expect(actionBox.x).toBeGreaterThanOrEqual(
                inputBox.x + inputBox.width,
            );
            expect(
                Math.abs(
                    actionBox.y +
                        actionBox.height / 2 -
                        (inputBox.y + inputBox.height / 2),
                ),
            ).toBeLessThanOrEqual(2);
        }
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await pageAction.click();
    const editor = page.getByRole('dialog').filter({
        has: page.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    });
    await expect(editor).toBeVisible();
    await editor
        .getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        })
        .fill('Reviewed navbox source from the editor.');
    await editor
        .getByRole('button', { name: english['preview.stage'], exact: true })
        .click();
    await expect(editor).toHaveCount(0);
    if (!(await row.getByRole('textbox').isVisible())) {
        await row
            .getByRole('link', { name: '{{Reviewed navbox}}', exact: true })
            .dblclick();
    }
    await row
        .getByRole('button', { name: 'pending page', exact: true })
        .click();
    await expect(
        editor.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    ).toHaveValue('Reviewed navbox source from the editor.');
    expect(await readWrites(page)).toEqual([]);
    await editor
        .getByRole('button', { name: english['preview.cancel'], exact: true })
        .click();
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    const preview = page.getByRole('dialog').filter({
        has: page.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    });
    await preview
        .getByRole('button', { name: english['preview.continue'], exact: true })
        .click();
    const confirmation = page.getByRole('dialog', {
        name: english['presave.title'],
        exact: true,
    });
    await expect(
        confirmation.getByText(/Reviewed navbox/u).first(),
    ).toBeVisible();
    expect(await readWrites(page)).toEqual([]);
});

test('Names usage rows toggle from the label, chips, and row area while cards stay independent', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    await main
        .getByRole('tab', { name: english['titles.tab'], exact: true })
        .click();
    const card = main
        .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
        .first();
    const name = card.getByRole('textbox', {
        name: english['names.localizedName'] + ' 1',
        exact: true,
    });
    await name.fill('Star Harbor');
    await name.blur();
    const usage = card.locator('[data-kanade-vg-stub-creator-name-set-uses]');
    const panel = card.locator('[data-kanade-vg-stub-creator-name-roles]');
    await expect(usage).toHaveJSProperty('tagName', 'BUTTON');
    await expect(
        usage.getByText(english['names.expandUses'], { exact: true }),
    ).toBeVisible();
    await expect(
        card.locator(
            '.kanade-vg-stub-creator-name-card-heading [data-kanade-vg-stub-creator-name-set-uses], .kanade-vg-stub-creator-name-card-heading [data-kanade-vg-stub-creator-name-use-chip]',
        ),
    ).toHaveCount(0);
    await usage.getByText(english['names.uses'], { exact: true }).click();
    await expect(usage).toHaveAttribute('aria-expanded', 'true');
    await expect(
        usage.getByText(english['names.collapseUses'], { exact: true }),
    ).toBeVisible();
    await expect(panel).toHaveAttribute(
        'id',
        (await usage.getAttribute('aria-controls'))!,
    );
    await expect(panel).toBeVisible();
    await expect(
        panel.locator('.kanade-vg-stub-creator-name-role-help'),
    ).toHaveCount(0);
    await usage
        .locator('[data-kanade-vg-stub-creator-name-use-chip]')
        .first()
        .click();
    await expect(usage).toHaveAttribute('aria-expanded', 'false');
    await expect(
        usage.getByText(english['names.expandUses'], { exact: true }),
    ).toBeVisible();
    await expect(panel).not.toBeVisible();
    const usageBounds = await usage.boundingBox();
    expect(usageBounds).not.toBeNull();
    await usage.click({
        position: { x: usageBounds!.width - 3, y: usageBounds!.height / 2 },
    });
    await expect(usage).toHaveAttribute('aria-expanded', 'true');

    const emptyCard = main
        .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
        .last();
    const emptyUsage = emptyCard.locator(
        '[data-kanade-vg-stub-creator-name-set-uses]',
    );
    await expect(
        emptyUsage.locator('[data-kanade-vg-stub-creator-name-use-chip]'),
    ).toHaveCount(0);
    await emptyUsage.focus();
    await emptyUsage.press('Enter');
    await expect(emptyUsage).toHaveAttribute('aria-expanded', 'true');
    await expect(usage).toHaveAttribute('aria-expanded', 'true');
    await emptyUsage.press('Space');
    await expect(emptyUsage).toHaveAttribute('aria-expanded', 'false');
    await expect(emptyUsage).toBeFocused();
    await expect(usage).toHaveAttribute('aria-expanded', 'true');
    expect(await readWrites(page)).toEqual([]);
});

for (const width of [320, 1024]) {
    test(`Names keeps active-use chips visible and independent overrides at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await loadCreator(page);
        await openCreator(page);
        const main = page.getByRole('dialog');
        await main
            .getByRole('tab', { name: english['titles.tab'], exact: true })
            .click();
        await expect(main.getByRole('table')).toHaveCount(0);
        const card = main
            .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
            .first();
        const name = card.getByRole('textbox', {
            name: english['names.localizedName'] + ' 1',
            exact: true,
        });
        await name.fill('攝影冒險');
        await name.blur();
        await card
            .getByRole('checkbox', {
                name: english['names.official'],
                exact: true,
            })
            .check();
        await card.getByRole('checkbox', { name: 'Hans', exact: true }).check();
        await card.getByRole('checkbox', { name: 'Hant', exact: true }).check();
        const setUses = card.locator(
            '[data-kanade-vg-stub-creator-name-set-uses]',
        );
        await setUses.focus();
        await setUses.press('Space');
        await expect(setUses).toHaveAttribute('aria-expanded', 'true');
        const uses = card.getByRole('group', {
            name: english['names.useThisName'],
            exact: true,
        });
        await expect(uses).toHaveJSProperty('tagName', 'FIELDSET');
        await expect(uses.locator(':scope > legend')).toHaveText(
            english['names.useThisName'],
        );
        await expect(uses).toHaveAttribute(
            'id',
            (await setUses.getAttribute('aria-controls'))!,
        );
        expect(
            await card.evaluate((element) => {
                const source = element.querySelector(
                    '.kanade-vg-stub-creator-name-source-row',
                )!;
                const usage = element.querySelector(
                    '[data-kanade-vg-stub-creator-name-set-uses]',
                )!;
                const panel = element.querySelector(
                    '[data-kanade-vg-stub-creator-name-roles]',
                )!;
                const properties = element.querySelector(
                    '.kanade-vg-stub-creator-name-properties',
                )!;
                const rows = [source, properties, usage, panel];
                return {
                    ordered: rows
                        .slice(1)
                        .every((row, index) =>
                            Boolean(
                                rows[index]!.compareDocumentPosition(row) &
                                Node.DOCUMENT_POSITION_FOLLOWING,
                            ),
                        ),
                    stacked: rows
                        .slice(1)
                        .every(
                            (row, index) =>
                                row.getBoundingClientRect().top >=
                                rows[index]!.getBoundingClientRect().bottom,
                        ),
                    fullWidth:
                        usage.getBoundingClientRect().width >=
                        source.getBoundingClientRect().width - 2,
                };
            }),
        ).toEqual({ ordered: true, stacked: true, fullWidth: true });
        const properties = card.getByRole('group', {
            name: english['names.properties'],
            exact: true,
        });
        await expect(properties).toHaveJSProperty('tagName', 'FIELDSET');
        await expect(properties.locator('legend')).toHaveText(
            english['names.properties'],
        );
        await expect(
            properties.getByRole('checkbox', {
                name: english['names.official'],
                exact: true,
            }),
        ).toBeChecked();
        expect(
            await card
                .locator('[data-kanade-vg-stub-creator-name-role]')
                .evaluateAll((roles) =>
                    roles.map((role) =>
                        role.getAttribute(
                            'data-kanade-vg-stub-creator-name-role',
                        ),
                    ),
                ),
        ).toEqual([
            'pageName',
            'redirect',
            'noteTa',
            'sortKey',
            'displayTitle',
        ]);
        const role = (key: string) =>
            card.locator(`[data-kanade-vg-stub-creator-name-role="${key}"]`);
        const override = (key: string, label: string) =>
            role(key).getByRole('textbox', {
                name: english['names.roleValue'].replace('{role}', label),
                exact: true,
            });
        for (const [key, label] of [
            ['pageName', english['names.useAsPageName']],
            ['redirect', english['names.useAsRedirect']],
            ['sortKey', english['names.useAsSortKey']],
            ['displayTitle', english['names.useAsDisplayTitle']],
        ]) {
            await override(key!, label!).fill('');
            await override(key!, label!).press('Enter');
            await role(key!).getByRole('checkbox').first().check();
        }
        const conversion = role('noteTa');
        const rule = override('noteTa', english['names.useAsNoteTA']);
        await expect(
            conversion
                .locator('.kanade-vg-stub-creator-name-role-control')
                .getByRole('textbox'),
        ).toHaveCount(1);
        await rule.fill('');
        await rule.press('Enter');
        await conversion.getByRole('checkbox').check();
        await expect(conversion.getByRole('textbox')).toHaveCount(1);
        await expect(conversion.getByRole('button')).toHaveCount(0);
        await expect(
            conversion.locator(
                '[data-kanade-vg-stub-creator-name-conversion-chip="zh-tw"]',
            ),
        ).toHaveText('[tw] 攝影冒險');
        await expect(
            main.locator(
                '[data-kanade-vg-stub-creator-name-role="noteTa"] [data-name-note-ta-row="G1"]',
            ),
        ).toHaveCount(0);
        const chips = card.locator(
            '[data-kanade-vg-stub-creator-name-use-chip]',
        );
        const chip = (key: string) =>
            card.locator(
                `[data-kanade-vg-stub-creator-name-use-chip="${key}"]`,
            );
        await expect(chips).toHaveCount(6);
        expect(
            await chips.evaluateAll((items) =>
                items.map((item) =>
                    item.getAttribute(
                        'data-kanade-vg-stub-creator-name-use-chip',
                    ),
                ),
            ),
        ).toEqual([
            'pageName',
            'redirect',
            'noteTa:zh-cn',
            'noteTa:zh-tw',
            'sortKey',
            'displayTitle',
        ]);
        for (const [key, label] of [
            ['pageName', english['names.usagePageName']],
            ['redirect', english['names.usageRedirect']],
            ['noteTa:zh-cn', english['names.usageNoteTaCn']],
            ['noteTa:zh-tw', english['names.usageNoteTaTw']],
            ['sortKey', english['names.usageSortKey']],
            ['displayTitle', english['names.usageDisplayTitle']],
        ]) {
            await expect(chip(key!)).toHaveText(label!);
            await expect(chip(key!)).not.toHaveAttribute('tabindex');
            await expect(chip(key!)).not.toHaveAttribute('role');
        }
        await expect(
            setUses.locator('[data-kanade-vg-stub-creator-name-use-chip]'),
        ).toHaveCount(6);
        await expect(chip('pageName')).toHaveAttribute('title', '攝影冒險');
        await expect(chip('noteTa:zh-cn')).toHaveAttribute(
            'title',
            'zh-cn:攝影冒險;',
        );
        const redirect = override('redirect', english['names.useAsRedirect']);
        await redirect.fill('攝影冒險（遊戲）');
        await redirect.press('Enter');
        await rule.fill('zh-cn:摄影之旅');
        await rule.press('Enter');
        await expect(chip('redirect')).toHaveText(
            english['names.usageRedirect'] + '*',
        );
        await expect(chip('noteTa:zh-cn')).toHaveText(
            english['names.usageNoteTaCn'] + '*',
        );
        await expect(chip('noteTa:zh-tw')).toHaveCount(0);
        await name.fill('攝影冒險2');
        await name.blur();
        for (const key of ['pageName', 'sortKey', 'displayTitle']) {
            await expect(chip(key)).toHaveAttribute('title', '攝影冒險2');
            await expect(chip(key)).not.toContainText('*');
        }
        await expect(chip('noteTa:zh-tw')).toHaveCount(0);
        await expect(chip('redirect')).toHaveAttribute(
            'title',
            '攝影冒險（遊戲）',
        );
        await expect(chip('noteTa:zh-cn')).toHaveAttribute(
            'title',
            'zh-cn:摄影之旅;',
        );
        await expect(redirect).toHaveValue('攝影冒險（遊戲）');
        await expect(rule).toHaveValue('zh-cn:摄影之旅');
        await setUses.focus();
        await setUses.press('Enter');
        await expect(setUses).toHaveAttribute('aria-expanded', 'false');
        await expect(
            card.locator('[data-kanade-vg-stub-creator-name-roles]'),
        ).not.toBeVisible();
        for (const current of await chips.all())
            await expect(current).toBeVisible();
        await expect(setUses).toBeFocused();
        await expect(setUses).toHaveAccessibleDescription(
            /攝影冒險（遊戲）.*zh-cn:摄影之旅;/u,
        );
        expect(await main.evaluate(inspectDialog)).toEqual([]);
        await setUses.focus();
        await setUses.press('Space');
        await conversion.getByRole('checkbox').uncheck();
        await role('redirect').getByRole('checkbox').first().uncheck();
        await expect(chip('redirect')).toHaveCount(0);
        await expect(chip('noteTa:zh-cn')).toHaveCount(0);
        await expect(chip('noteTa:zh-tw')).toHaveCount(0);
        await expect(chips).toHaveCount(3);
        await role('redirect')
            .getByRole('button', {
                name: english['names.addRedirect'],
                exact: true,
            })
            .click();
        const manualAlias = role('redirect')
            .locator('[data-kanade-vg-stub-creator-name-redirect-row]')
            .getByRole('textbox')
            .last();
        await manualAlias.fill('Manual alias');
        await manualAlias.blur();
        const manualRow = await getRedirectRow(card, 'Manual alias');
        await expect(manualRow.getByRole('checkbox')).toBeChecked();
        await expect(
            role('redirect').getByRole('checkbox').first(),
        ).not.toBeChecked();
        await expect(chip('redirect')).toHaveText(
            english['names.usageRedirect'] + '*',
        );
        await expect(chip('redirect')).toHaveAttribute('title', 'Manual alias');
        await manualRow.getByRole('checkbox').uncheck();
        await expect(chip('redirect')).toHaveCount(0);
        await manualRow.getByRole('checkbox').check();
        await expect(chip('redirect')).toHaveAttribute('title', 'Manual alias');
        expect(await main.evaluate(inspectDialog)).toEqual([]);
        expect(await readWrites(page)).toEqual([]);
    });
}

test('Names preserves spaces while typing multiword localized and English names', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    await main
        .getByRole('tab', { name: english['titles.tab'], exact: true })
        .click();
    for (const [kind, nameLabel, use] of [
        ['localized', english['names.localizedName'] + ' 1', 'pageName'],
        ['english', english['titles.englishTitle'], 'displayTitle'],
    ] as const) {
        const card = main
            .locator(`[data-kanade-vg-stub-creator-name-kind="${kind}"]`)
            .first();
        await card
            .locator('[data-kanade-vg-stub-creator-name-set-uses]')
            .click();
        const selectedUse = card.locator(
            `[data-kanade-vg-stub-creator-name-role="${use}"]`,
        );
        await selectedUse.getByRole('textbox').fill('');
        await selectedUse.getByRole('textbox').press('Enter');
        await selectedUse.getByRole('checkbox').check();
        const input = card.getByRole('textbox', {
            name: nameLabel,
            exact: true,
        });
        await input.fill('');
        await input.pressSequentially('New ');
        await expect(input).toHaveValue('New ');
        const chip = card.locator(
            `[data-kanade-vg-stub-creator-name-use-chip="${use}"]`,
        );
        await expect(chip).toHaveAttribute('title', 'New');
        await input.pressSequentially('title ');
        await expect(input).toHaveValue('New title ');
        await expect(chip).toHaveAttribute('title', 'New title');
        await input.blur();
        await expect(input).toHaveValue('New title');
        await expect(chip).toHaveAttribute('title', 'New title');
        await expect(chip).not.toContainText('*');
    }
    expect(await readWrites(page)).toEqual([]);
});

test('Names sets five uses and reviews redirects inside each name card', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    await main
        .getByRole('tab', { name: english['titles.tab'], exact: true })
        .click();
    await expect(
        main.locator('[data-kanade-vg-stub-creator-field="pageName"]'),
    ).toHaveCount(0);
    await expect(
        main.locator('[data-kanade-vg-stub-creator-field="name"]'),
    ).toHaveCount(0);
    await expect(
        main.locator('[data-kanade-vg-stub-creator-field="sortKey"]'),
    ).toHaveCount(0);
    await expect(
        main.locator('.kanade-vg-stub-creator-redirect-table'),
    ).toHaveCount(0);
    const card = main
        .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
        .first();
    const setUses = card.locator('[data-kanade-vg-stub-creator-name-set-uses]');
    await expect(setUses).toHaveAccessibleName(english['names.uses']);
    await expect(setUses).toHaveAttribute('aria-expanded', 'false');
    await setUses.focus();
    await setUses.press('Enter');
    await expect(setUses).toHaveAttribute('aria-expanded', 'true');
    await expect(
        card.locator('[data-kanade-vg-stub-creator-name-role]'),
    ).toHaveCount(5);
    await expect(
        card
            .locator('[data-kanade-vg-stub-creator-name-role="pageName"]')
            .getByRole('textbox'),
    ).toHaveValue('Star Harbor');
    const redirects = card.locator(
        '[data-kanade-vg-stub-creator-name-role="redirect"]',
    );
    const addRedirect = redirects.getByRole('button', {
        name: english['names.addRedirect'],
        exact: true,
    });
    await expect(addRedirect).toHaveText('');
    await expect(addRedirect.locator('.cdx-icon svg')).toHaveAttribute(
        'aria-hidden',
        'true',
    );
    await redirects
        .getByRole('button', {
            name: english['names.addRedirect'],
            exact: true,
        })
        .click();
    const redirectInputs = redirects
        .locator('[data-kanade-vg-stub-creator-name-redirect-row]')
        .getByRole('textbox');
    const redirect = redirectInputs.last();
    await redirect.fill('Star Harbour');
    await redirect.blur();
    const row = await getRedirectRow(card, 'Star Harbour');
    await expect(row.getByRole('checkbox')).toBeChecked();
    await expect(row.getByRole('checkbox')).toHaveAccessibleName(
        english['names.useAsRedirectNumber'].replace('{number}', '2'),
    );
    await expect(redirect).toHaveAccessibleName(
        english['names.roleValue'].replace(
            '{role}',
            english['names.useAsRedirectNumber'].replace('{number}', '2'),
        ),
    );
    await expect(
        redirects.locator('.kanade-vg-stub-creator-name-role-check-button'),
    ).toHaveCount(0);
    await redirects
        .getByRole('button', {
            name: english['names.addRedirect'],
            exact: true,
        })
        .click();
    const thirdRedirect = redirects
        .locator('[data-kanade-vg-stub-creator-name-redirect-row]')
        .getByRole('textbox')
        .last();
    await thirdRedirect.focus();
    await thirdRedirect.evaluate((element) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', 'Star Harbor alias');
        element.dispatchEvent(
            new ClipboardEvent('paste', {
                clipboardData,
                bubbles: true,
                cancelable: true,
            }),
        );
    });
    await expect(thirdRedirect).toHaveValue('Star Harbor alias');
    await expect(thirdRedirect).toBeFocused();
    const thirdRow = await getRedirectRow(card, 'Star Harbor alias');
    await expect(thirdRow.getByRole('checkbox')).toHaveAccessibleName(
        english['names.useAsRedirectNumber'].replace('{number}', '3'),
    );
    await row.getByRole('checkbox').uncheck();
    await expect(thirdRow.getByRole('checkbox')).toBeChecked();
    await page.setViewportSize({ width: 320, height: 900 });
    expect(await main.evaluate(inspectDialog)).toEqual([]);
    await row.getByRole('button', { name: 'create page', exact: true }).click();
    const editor = page.getByRole('dialog').filter({
        has: page.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    });
    await expect(
        editor.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    ).toHaveValue(/#REDIRECT \[\[Star Harbor\]\]/u);
    await editor
        .getByRole('button', { name: english['preview.cancel'], exact: true })
        .click();
    await row
        .getByRole('button', { name: english['common.remove'], exact: true })
        .click();
    await expect(
        redirects.locator(
            '[data-kanade-vg-stub-creator-name-redirect-row="Star Harbour"]',
        ),
    ).toHaveCount(0);
    await expect(thirdRow.getByRole('textbox')).toHaveValue(
        'Star Harbor alias',
    );
    await expect(thirdRow.getByRole('checkbox')).toBeChecked();
    await expect(
        redirects
            .locator('[data-kanade-vg-stub-creator-name-primary-redirect]')
            .getByRole('textbox'),
    ).toHaveValue('');
    await setUses.click();
    await expect(setUses).toHaveAttribute('aria-expanded', 'false');
    await expect(
        card.locator('[data-kanade-vg-stub-creator-name-roles]'),
    ).not.toBeVisible();
    await main
        .getByRole('tab', { name: english['text.tab'], exact: true })
        .click();
    await expect(
        main.getByRole('textbox', {
            name: english['text.articleDisplayTitle'],
            exact: true,
        }),
    ).toHaveCount(0);
    await expect(
        main.locator('.kanade-vg-stub-creator-redirect-table'),
    ).not.toBeVisible();
    expect(await readWrites(page)).toEqual([]);
});

test('Names Google searches use only the English Wikipedia article title', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    const namesTab = main.getByRole('tab', {
        name: english['titles.tab'],
        exact: true,
    });
    const updateArticleTitle = async (value: string) => {
        await main
            .getByRole('tab', { name: english['metadata.tab'], exact: true })
            .click();
        const title = main.getByRole('textbox', {
            name: english['metadata.enwikiPage'],
            exact: true,
        });
        await title.fill(value);
        await title.blur();
        await namesTab.click();
    };
    const lookup = main.locator('.kanade-vg-stub-creator-name-lookup-group');
    const search = lookup.locator('.kanade-vg-stub-creator-name-search');
    const expectQuery = async (query: string) => {
        await expect(search.locator('li')).toHaveCount(1);
        await expect(search.locator('strong')).toHaveText(query);
        await expect(search.getByRole('link')).toHaveCount(3);
        for (const [label, suffix] of [
            [english['names.cnDomain'], ' site:*.cn'],
            [english['names.bahamut'], ' site:gnn.gamer.com.tw'],
            ['zhwp', ''],
        ]) {
            const link = search.getByRole('link', { name: label, exact: true });
            expect(
                new URL((await link.getAttribute('href'))!).searchParams.get(
                    'q',
                ),
            ).toBe(`"${query}"${suffix}`);
        }
    };

    await updateArticleTitle('Photo Adventure (video game)');
    await expectQuery('Photo Adventure');
    await expect(
        lookup.locator('.kanade-vg-stub-creator-name-query-field'),
    ).toHaveCount(0);
    await expect(
        lookup.getByRole('link', { name: 'Google', exact: true }),
    ).toHaveCount(0);
    await expect(
        lookup.getByRole('link', { name: 'Steam', exact: true }),
    ).toHaveCount(0);
    await expect(lookup.getByRole('textbox')).toHaveCount(1);
    await expect(
        lookup.getByRole('textbox', {
            name: english['names.steamHelper'],
            exact: true,
        }),
    ).toBeVisible();

    for (const [label, value] of [
        [english['titles.originalTitle'], 'ja:別の名前'],
        [english['titles.englishTitle'], 'Unrelated English name'],
    ]) {
        const input = main.getByRole('textbox', { name: label, exact: true });
        await input.fill(value!);
        await input.blur();
    }
    await expectQuery('Photo Adventure');
    await updateArticleTitle(
        'https://en.wikipedia.org/wiki/New_Adventure_(2026_video_game)',
    );
    await expectQuery('New Adventure');
    await updateArticleTitle('');
    await expect(search).toHaveCount(0);
    await expect(
        lookup.getByRole('textbox', {
            name: english['names.steamHelper'],
            exact: true,
        }),
    ).toBeVisible();
    expect(await readWrites(page)).toEqual([]);
});

test('Names offers inline checkbox uses and freshly checks Chinese title variants', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await loadCreator(page, {
        existingTitles: ['攝影冒險'],
        titleConversions: { 'zh-hant': { 摄影冒险: '攝影冒險' } },
        failedTitles: ['Uncertain alias'],
    });
    await openCreator(page);
    const main = page.getByRole('dialog');
    await main
        .getByRole('tab', { name: english['titles.tab'], exact: true })
        .click();
    await main
        .getByRole('textbox', {
            name: english['names.localizedName'] + ' 1',
            exact: true,
        })
        .fill('摄影冒险');
    await main
        .getByRole('textbox', {
            name: english['names.localizedName'] + ' 1',
            exact: true,
        })
        .blur();
    const card = main
        .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
        .first();
    await card.locator('[data-kanade-vg-stub-creator-name-set-uses]').click();
    const pageRole = card.locator(
        '[data-kanade-vg-stub-creator-name-role="pageName"]',
    );
    await pageRole.getByRole('checkbox').uncheck();
    await pageRole.getByRole('textbox').fill('');
    await pageRole.getByRole('textbox').press('Enter');
    await expect(
        pageRole.locator('.kanade-vg-stub-creator-name-role-page-chip'),
    ).toHaveText(
        english['names.rolePageExists'].replace('{title}', '攝影冒險'),
    );
    const pageChip = pageRole.locator(
        '.kanade-vg-stub-creator-name-role-page-chip',
    );
    await expect(pageChip).toHaveClass(/cdx-info-chip--warning/u);
    await expect(pageChip.locator('.cdx-info-chip__icon--vue')).toBeVisible();
    await expect(
        pageChip.locator('.cdx-info-chip__icon--vue svg'),
    ).toHaveAttribute('aria-hidden', 'true');
    await expect(pageRole.getByRole('link')).toHaveAttribute(
        'href',
        'https://vg-creator.test/wiki/' + encodeURIComponent('攝影冒險'),
    );
    await expect(pageRole.getByRole('link')).toHaveAttribute(
        'target',
        '_blank',
    );
    await expect(pageRole.getByRole('link')).toHaveAttribute(
        'rel',
        'noopener noreferrer',
    );
    await expect(
        pageRole.locator('.kanade-vg-stub-creator-name-role-select-button'),
    ).toHaveCount(0);
    const before = (await readTitleChecks(page)).filter(
        (title) => title === '摄影冒险',
    ).length;
    await expect(
        pageRole.locator('.kanade-vg-stub-creator-name-role-check-button'),
    ).toHaveCount(0);
    await pageRole.getByRole('textbox').press('Enter');
    await expect(
        pageRole.locator('.kanade-vg-stub-creator-name-role-page-chip'),
    ).toHaveText(
        english['names.rolePageExists'].replace('{title}', '攝影冒險'),
    );
    expect(
        (await readTitleChecks(page)).filter((title) => title === '摄影冒险')
            .length,
    ).toBeGreaterThan(before);
    const override = pageRole.getByRole('textbox');
    await override.fill('摄影冒险 (游戏)');
    await override.press('Enter');
    await expect(
        pageRole.locator('.kanade-vg-stub-creator-name-role-page-chip'),
    ).toHaveText(english['names.rolePageMissing']);
    await expect(pageChip).toHaveClass(/cdx-info-chip--success/u);
    await expect(pageChip.locator('.cdx-info-chip__icon--vue')).toBeVisible();
    await expect(pageRole.getByRole('link')).toHaveAttribute(
        'href',
        'https://vg-creator.test/wiki/' + encodeURIComponent('摄影冒险 (游戏)'),
    );
    await expect(pageRole.getByRole('link')).toHaveAccessibleName(
        english['names.openPage'].replace('{title}', '摄影冒险 (游戏)'),
    );
    await expect(
        pageRole.getByRole('link').locator('.cdx-icon svg').last(),
    ).toHaveAttribute('aria-hidden', 'true');
    await expect(pageRole.getByRole('link')).toHaveText('');
    await expect(
        pageRole.getByRole('link').locator('.cdx-info-chip'),
    ).toHaveCount(0);
    const pageOpeningOrder = await pageRole.evaluate((role) => {
        const input = role.querySelector('.cdx-text-input');
        const link = role.querySelector(
            '.kanade-vg-stub-creator-name-role-page-link',
        );
        const chip = role.querySelector(
            '.kanade-vg-stub-creator-name-role-page-chip',
        );
        if (!input || !link || !chip) throw new Error('Missing title controls');
        const inputBounds = input.getBoundingClientRect();
        const linkBounds = link.getBoundingClientRect();
        const chipBounds = chip.getBoundingClientRect();
        return {
            directlyAfterInput: Boolean(
                input.nextElementSibling?.contains(link),
            ),
            beforeStatus: Boolean(
                link.compareDocumentPosition(chip) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            ),
            inputRight: inputBounds.right,
            linkLeft: linkBounds.left,
            linkRight: linkBounds.right,
            statusLeft: chipBounds.left,
        };
    });
    expect(pageOpeningOrder.directlyAfterInput).toBe(true);
    expect(pageOpeningOrder.beforeStatus).toBe(true);
    expect(pageOpeningOrder.linkLeft).toBeGreaterThanOrEqual(
        pageOpeningOrder.inputRight,
    );
    expect(pageOpeningOrder.statusLeft).toBeGreaterThanOrEqual(
        pageOpeningOrder.linkRight,
    );
    await pageRole
        .locator('.kanade-vg-stub-creator-name-role-select-button')
        .click();
    await expect(pageRole.getByRole('checkbox')).toBeChecked();
    await expect(
        pageRole.locator('.kanade-vg-stub-creator-name-role-select-button'),
    ).toHaveCount(0);
    const rowBounds = await pageRole.evaluate((role) =>
        [
            role.querySelector('.cdx-checkbox'),
            role.querySelector('.cdx-text-input'),
            role.querySelector('.kanade-vg-stub-creator-name-role-page-chip'),
        ].map((element) => {
            const rect = element!.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom };
        }),
    );
    expect(Math.max(...rowBounds.map((bounds) => bounds.top))).toBeLessThan(
        Math.min(...rowBounds.map((bounds) => bounds.bottom)),
    );
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    const preview = page.getByRole('dialog', {
        name: english['preview.createPageTitle'].replace(
            '{title}',
            '摄影冒险 (游戏)',
        ),
        exact: true,
    });
    await expect(preview).toBeVisible();
    await preview
        .getByRole('button', { name: english['preview.dismiss'], exact: true })
        .click();
    await expect(
        card.getByRole('textbox', {
            name: english['names.localizedName'] + ' 1',
            exact: true,
        }),
    ).toHaveValue('摄影冒险');
    await override.fill('');
    await override.press('Enter');
    await expect(override).toHaveValue('');
    await expect(override).toHaveAttribute('placeholder', /摄影冒险/u);
    await override.fill('Uncertain alias');
    await override.press('Enter');
    await expect(
        pageRole.locator('.kanade-vg-stub-creator-name-role-page-chip'),
    ).toHaveText(
        english['names.rolePageUnknown'].replace('{title}', 'Uncertain alias'),
    );
    await expect(pageChip).toHaveClass(/cdx-info-chip--notice/u);
    await expect(pageChip.locator('.cdx-info-chip__icon--vue')).toHaveCount(0);
    await expect(
        pageRole.locator('.kanade-vg-stub-creator-name-role-select-button'),
    ).toHaveCount(0);
    const redirectRole = card.locator(
        '[data-kanade-vg-stub-creator-name-role="redirect"]',
    );
    const redirectOverride = redirectRole.getByRole('textbox', {
        name: english['names.roleValue'].replace(
            '{role}',
            english['names.useAsRedirect'],
        ),
        exact: true,
    });
    await redirectOverride.fill('摄影冒险; 新别名');
    await redirectOverride.press('Enter');
    const redirectStatus = redirectRole.locator(
        '[data-kanade-vg-stub-creator-name-primary-redirect]',
    );
    await expect(redirectStatus.getByRole('link')).toHaveCount(2);
    await expect(
        redirectStatus
            .locator('.kanade-vg-stub-creator-name-role-page-chip')
            .first(),
    ).toHaveText(
        english['names.rolePageExists'].replace('{title}', '攝影冒險'),
    );
    await expect(
        redirectStatus
            .locator('.kanade-vg-stub-creator-name-role-page-chip')
            .last(),
    ).toHaveText(english['names.rolePageMissing']);
    await expect(
        redirectStatus
            .locator('.kanade-vg-stub-creator-name-role-page-chip')
            .first(),
    ).toHaveClass(/cdx-info-chip--warning/u);
    await expect(
        redirectStatus
            .locator('.kanade-vg-stub-creator-name-role-page-chip')
            .last(),
    ).toHaveClass(/cdx-info-chip--success/u);
    await page.setViewportSize({ width: 390, height: 844 });
    await override.fill('摄影冒险'.repeat(20));
    await override.press('Enter');
    await expect(pageChip).toHaveText(english['names.rolePageMissing']);
    await expect(pageRole.getByRole('link')).toHaveAccessibleName(
        english['names.openPage'].replace('{title}', '摄影冒险'.repeat(20)),
    );
    expect(await main.evaluate(inspectDialog)).toEqual([]);
    await main.evaluate((dialog) => dialog.setAttribute('dir', 'rtl'));
    expect(await main.evaluate(inspectDialog)).toEqual([]);
    expect(await readWrites(page)).toEqual([]);
});

test('Names checks pasted and committed page titles and redirects without changing selection', async ({
    page,
    context,
}) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await loadCreator(page, { failedTitles: ['Uncertain pasted alias'] });
    await openCreator(page);
    const main = page.getByRole('dialog');
    await main
        .getByRole('tab', { name: english['titles.tab'], exact: true })
        .click();
    const card = main
        .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
        .first();
    await card.locator('[data-kanade-vg-stub-creator-name-set-uses]').click();
    for (const role of ['pageName', 'redirect']) {
        const roleContainer = card.locator(
            `[data-kanade-vg-stub-creator-name-role="${role}"]`,
        );
        const row =
            role === 'redirect'
                ? roleContainer.locator(
                      '[data-kanade-vg-stub-creator-name-primary-redirect]',
                  )
                : roleContainer;
        const checkbox = row.getByRole('checkbox');
        const input = row.getByRole('textbox');
        await checkbox.uncheck();
        await input.fill('');
        await input.focus();
        const pastedTitle = `${role} pasted alias`;
        await page.evaluate(
            (title) => navigator.clipboard.writeText(title),
            pastedTitle,
        );
        await input.press('ControlOrMeta+V');
        await expect(input).toHaveValue(pastedTitle);
        await expect(input).toBeFocused();
        await expect(
            row.locator('.kanade-vg-stub-creator-name-role-page-chip'),
        ).toHaveText(english['names.rolePageMissing']);
        await expect(row.getByRole('link')).toHaveAttribute(
            'href',
            'https://vg-creator.test/wiki/' + encodeURIComponent(pastedTitle),
        );
        await expect(checkbox).not.toBeChecked();

        await checkbox.check();
        const enteredTitle = `${role} entered alias`;
        await input.fill(enteredTitle);
        await input.press('Enter');
        await expect(row.getByRole('link')).toHaveAttribute(
            'href',
            'https://vg-creator.test/wiki/' + encodeURIComponent(enteredTitle),
        );
        await expect(
            row.locator('.kanade-vg-stub-creator-name-role-page-chip'),
        ).toHaveText(english['names.rolePageMissing']);
        await expect(checkbox).toBeChecked();

        await input.fill('Uncertain pasted alias');
        await input.blur();
        await expect(
            row.locator('.kanade-vg-stub-creator-name-role-page-chip'),
        ).toHaveText(
            english['names.rolePageUnknown'].replace(
                '{title}',
                'Uncertain pasted alias',
            ),
        );
        const countBefore = (await readTitleChecks(page)).filter(
            (title) => title === 'Uncertain pasted alias',
        ).length;
        await input.focus();
        await input.press('Enter');
        await expect
            .poll(
                async () =>
                    (await readTitleChecks(page)).filter(
                        (title) => title === 'Uncertain pasted alias',
                    ).length,
            )
            .toBeGreaterThan(countBefore);
        await expect(
            row.locator('.kanade-vg-stub-creator-name-role-page-chip'),
        ).toHaveText(
            english['names.rolePageUnknown'].replace(
                '{title}',
                'Uncertain pasted alias',
            ),
        );
        await expect(checkbox).toBeChecked();

        const blurredTitle = `${role} blurred alias`;
        await input.fill(blurredTitle);
        await input.blur();
        await expect(
            row.locator('.kanade-vg-stub-creator-name-role-page-chip'),
        ).toHaveText(english['names.rolePageMissing']);
        await expect(row.getByRole('link')).toHaveAttribute(
            'href',
            'https://vg-creator.test/wiki/' + encodeURIComponent(blurredTitle),
        );
        expect(await readTitleChecks(page)).toContain(blurredTitle);
        await expect(checkbox).toBeChecked();
        await expect(
            row.locator('.kanade-vg-stub-creator-name-role-check-button'),
        ).toHaveCount(0);
    }
    expect(await readWrites(page)).toEqual([]);
});

test('Names shows the singleton choice that checking another name will replace', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    await main
        .getByRole('tab', { name: english['titles.tab'], exact: true })
        .click();
    const original = main.locator(
        '[data-kanade-vg-stub-creator-name-kind="original"]',
    );
    await original
        .getByRole('textbox', {
            name: english['titles.originalTitle'],
            exact: true,
        })
        .fill('ja:Chosen title');
    await original
        .locator('[data-kanade-vg-stub-creator-name-set-uses]')
        .click();
    const localized = main
        .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
        .first();
    await localized
        .locator('[data-kanade-vg-stub-creator-name-set-uses]')
        .click();
    for (const [role, usageLabel] of [
        ['pageName', english['names.usagePageName']],
        ['displayTitle', english['names.usageDisplayTitle']],
        ['sortKey', english['names.usageSortKey']],
    ] as const) {
        const selected = original.locator(
            '[data-kanade-vg-stub-creator-name-role="' + role + '"]',
        );
        await selected.getByRole('textbox').fill('Chosen title');
        await selected.getByRole('textbox').press('Enter');
        await selected.getByRole('checkbox').check();
        const candidate = localized.locator(
            '[data-kanade-vg-stub-creator-name-role="' + role + '"]',
        );
        const candidateTitle = 'Alternative ' + role;
        await candidate.getByRole('textbox').fill(candidateTitle);
        await candidate.getByRole('textbox').press('Enter');
        if (role === 'pageName') {
            await expect(
                candidate.locator(
                    '.kanade-vg-stub-creator-name-role-page-chip',
                ),
            ).toHaveText(english['names.rolePageMissing']);
        }
        const otherUse = candidate.locator(
            '[data-kanade-vg-stub-creator-name-role-other-use="' + role + '"]',
        );
        await expect(otherUse).toHaveText(
            english['names.otherUse']
                .replace('{source}', english['titles.originalTitle'])
                .replace('{role}', usageLabel)
                .replace('{value}', 'Chosen title'),
        );
        await expect(otherUse).toHaveAttribute(
            'title',
            english['names.otherUseHint']
                .replace('{source}', english['titles.originalTitle'])
                .replace('{role}', usageLabel),
        );
        expect(
            await otherUse.evaluate((chip) =>
                Boolean(
                    chip.closest('.kanade-vg-stub-creator-name-role-choice') &&
                    chip.previousElementSibling?.classList.contains(
                        'cdx-checkbox',
                    ),
                ),
            ),
        ).toBe(true);
        await candidate.getByRole('checkbox').check();
        await expect(otherUse).toHaveCount(0);
        await expect(selected.getByRole('checkbox')).not.toBeChecked();
        await expect(
            selected.locator(
                '[data-kanade-vg-stub-creator-name-role-other-use="' +
                    role +
                    '"]',
            ),
        ).toHaveText(
            english['names.otherUse']
                .replace(
                    '{source}',
                    english['names.nameNumber'].replace('{number}', '1'),
                )
                .replace('{role}', usageLabel)
                .replace('{value}', candidateTitle),
        );
    }
    await expect(
        main.locator(
            '[data-kanade-vg-stub-creator-name-role-other-use="redirect"]',
        ),
    ).toHaveCount(0);
    expect(await readWrites(page)).toEqual([]);
});

test('Names applies default NoteTA regions independently and keeps the selected region when another is disabled', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    await main
        .getByRole('tab', { name: english['titles.tab'], exact: true })
        .click();
    const cnCard = main
        .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
        .first();
    const cnName = cnCard.getByRole('textbox', {
        name: english['names.localizedName'] + ' 1',
        exact: true,
    });
    await cnName.fill('摄影冒险');
    await cnName.blur();
    await cnCard
        .getByRole('checkbox', { name: english['names.official'], exact: true })
        .check();
    await cnCard.getByRole('checkbox', { name: 'Hans', exact: true }).check();
    await cnCard.locator('[data-kanade-vg-stub-creator-name-set-uses]').click();
    const cnRole = cnCard.locator(
        '[data-kanade-vg-stub-creator-name-role="noteTa"]',
    );
    await expect(
        cnRole.getByRole('textbox', {
            name: english['names.roleValue'].replace(
                '{role}',
                english['names.useAsNoteTA'],
            ),
            exact: true,
        }),
    ).toHaveValue('');
    await cnRole.getByRole('checkbox').check();
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    const preview = page.locator('.kanade-vg-stub-creator-preview-dialog');
    const article = preview.getByRole('textbox', {
        name: english['preview.wikitext'],
        exact: true,
    });
    await expect(article).toHaveValue(/zh-cn:摄影冒险;/u);
    await expect(article).not.toHaveValue(/zh-tw:/u);
    await preview
        .getByRole('button', { name: english['preview.dismiss'], exact: true })
        .click();

    const twCard = main
        .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
        .nth(1);
    const twName = twCard.getByRole('textbox', {
        name: english['names.localizedName'] + ' 2',
        exact: true,
    });
    await twName.fill('攝影冒險');
    await twName.blur();
    await twCard
        .getByRole('checkbox', { name: english['names.official'], exact: true })
        .check();
    await twCard.getByRole('checkbox', { name: 'Hant', exact: true }).check();
    await twCard.locator('[data-kanade-vg-stub-creator-name-set-uses]').click();
    const twRole = twCard.locator(
        '[data-kanade-vg-stub-creator-name-role="noteTa"]',
    );
    await expect(
        twRole.getByRole('textbox', {
            name: english['names.roleValue'].replace(
                '{role}',
                english['names.useAsNoteTA'],
            ),
            exact: true,
        }),
    ).toHaveValue('');
    await twRole.getByRole('checkbox').uncheck();
    await twRole.getByRole('checkbox').check();
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    await expect(article).toHaveValue(/zh-cn:摄影冒险;\s*zh-tw:攝影冒險;/u);
    expect((await article.inputValue()).match(/^\|\s*\d+\s*=/gmu)).toHaveLength(
        1,
    );
    await preview
        .getByRole('button', { name: english['preview.dismiss'], exact: true })
        .click();

    await cnRole.getByRole('checkbox').uncheck();
    await twName.fill('攝影之旅');
    await twName.blur();
    await expect(cnName).toHaveValue('摄影冒险');
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    await expect(article).toHaveValue(/zh-tw:攝影之旅;/u);
    await expect(article).not.toHaveValue(/zh-cn:/u);
    expect(await readWrites(page)).toEqual([]);
});

test('Names combines full regional rules from one input or different names while preserving source values', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    const genre = main.locator('[data-kanade-vg-stub-creator-field="genres"]');
    await genre
        .getByRole('textbox', { name: english['metadata.genres'], exact: true })
        .fill('Adventure');
    await genre
        .getByRole('textbox', { name: english['metadata.genres'], exact: true })
        .press('Enter');
    await setRelatedEnabled(
        genre
            .locator(
                '[data-kanade-vg-stub-creator-kind="category"] .kanade-vg-stub-creator-related-link',
            )
            .first(),
        true,
    );
    await main
        .getByRole('tab', { name: english['titles.tab'], exact: true })
        .click();
    const original = main.locator(
        '[data-kanade-vg-stub-creator-name-kind="original"]',
    );
    await original
        .getByRole('textbox', {
            name: english['titles.originalTitle'],
            exact: true,
        })
        .fill('ja:写真冒険');
    await original
        .getByRole('textbox', {
            name: english['titles.originalTitle'],
            exact: true,
        })
        .blur();
    await original
        .locator('[data-kanade-vg-stub-creator-name-set-uses]')
        .click();
    const sort = original.locator(
        '[data-kanade-vg-stub-creator-name-role="sortKey"]',
    );
    await expect(sort.getByRole('textbox')).toHaveValue('');
    await sort.getByRole('textbox').fill('Shashin Bouken');
    await sort.getByRole('textbox').press('Enter');
    await sort.getByRole('checkbox').check();
    await original
        .locator('[data-kanade-vg-stub-creator-name-role="displayTitle"]')
        .getByRole('checkbox')
        .check();
    const conversion = original.locator(
        '[data-kanade-vg-stub-creator-name-role="noteTa"]',
    );
    const cn = conversion.getByRole('textbox', {
        name: english['names.roleValue'].replace(
            '{role}',
            english['names.useAsNoteTA'],
        ),
        exact: true,
    });
    await expect(
        conversion
            .locator('.kanade-vg-stub-creator-name-role-control')
            .getByRole('textbox'),
    ).toHaveCount(1);
    await cn.fill('zh-cn:摄影冒险');
    await cn.press('Enter');
    await conversion.getByRole('checkbox').check();
    const englishCard = main.locator(
        '[data-kanade-vg-stub-creator-name-kind="english"]',
    );
    await englishCard
        .getByRole('textbox', {
            name: english['titles.englishTitle'],
            exact: true,
        })
        .fill('Photo Adventure');
    await englishCard
        .getByRole('textbox', {
            name: english['titles.englishTitle'],
            exact: true,
        })
        .blur();
    await englishCard
        .locator('[data-kanade-vg-stub-creator-name-set-uses]')
        .click();
    const englishConversion = englishCard.locator(
        '[data-kanade-vg-stub-creator-name-role="noteTa"]',
    );
    const tw = englishConversion.getByRole('textbox', {
        name: english['names.roleValue'].replace(
            '{role}',
            english['names.useAsNoteTA'],
        ),
        exact: true,
    });
    await tw.fill('zh-tw:攝影冒險');
    await tw.press('Enter');
    await englishConversion.getByRole('checkbox').check();
    for (const row of [conversion, englishConversion]) {
        await expect(row.getByRole('textbox')).toHaveCount(1);
        await expect(row.getByRole('button')).toHaveCount(0);
        await expect(
            row.locator(
                '[data-kanade-vg-stub-creator-name-conversion-chip="zh-cn"]',
            ),
        ).toHaveText('[cn] 摄影冒险');
        await expect(
            row.locator(
                '[data-kanade-vg-stub-creator-name-conversion-chip="zh-tw"]',
            ),
        ).toHaveText('[tw] 攝影冒險');
        await expect(row.locator('[data-name-note-ta-row]')).toHaveCount(0);
    }
    await expect(cn).toHaveValue('zh-cn:摄影冒险');
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    const preview = page.locator('.kanade-vg-stub-creator-preview-dialog');
    const article = preview.getByRole('textbox', {
        name: english['preview.wikitext'],
        exact: true,
    });
    await expect(article).toHaveValue(/zh-cn:摄影冒险;\s*zh-tw:攝影冒險;/u);
    expect((await article.inputValue()).match(/^\|\s*\d+\s*=/gmu)).toHaveLength(
        1,
    );
    await preview
        .getByRole('button', { name: english['preview.dismiss'], exact: true })
        .click();

    await tw.fill('zh-tw:攝影之旅');
    await tw.press('Enter');
    await expect(cn).toHaveValue('zh-cn:摄影冒险');
    await expect(tw).toHaveValue('zh-tw:攝影之旅');
    await expect(
        conversion.locator(
            '[data-kanade-vg-stub-creator-name-conversion-chip="zh-tw"]',
        ),
    ).toHaveText('[tw] 攝影之旅');
    const combinedRule =
        'zh-cn:摄影冒险; zh-tw:攝影最後版本; zh-hk:攝影香港版本';
    await cn.fill(combinedRule);
    await cn.press('Enter');
    await expect(cn).toHaveValue(combinedRule);
    await expect(tw).toHaveValue('zh-tw:攝影之旅');
    await expect(
        conversion.locator(
            '[data-kanade-vg-stub-creator-name-conversion-chip="zh-tw"]',
        ),
    ).toHaveText('[tw] 攝影最後版本');
    await expect(
        conversion.locator(
            '[data-kanade-vg-stub-creator-name-conversion-chip="zh-hk"]',
        ),
    ).toHaveText('[hk] 攝影香港版本');
    const hkChip = original.locator(
        '[data-kanade-vg-stub-creator-name-use-chip="noteTa:zh-hk"]',
    );
    await expect(hkChip).toHaveText(
        english['names.usageNoteTaVariant'].replace('{variant}', 'zh-hk') + '*',
    );
    await expect(hkChip).toHaveAttribute('title', 'zh-hk:攝影香港版本;');
    const originalUsage = original.locator(
        '[data-kanade-vg-stub-creator-name-set-uses]',
    );
    await originalUsage.focus();
    await expect(originalUsage).toBeFocused();
    await expect(originalUsage).toHaveAccessibleDescription(
        /zh-hk:攝影香港版本;/u,
    );
    await original
        .getByRole('textbox', {
            name: english['titles.originalTitle'],
            exact: true,
        })
        .fill('ja:写真冒険2');
    await original
        .getByRole('textbox', {
            name: english['titles.originalTitle'],
            exact: true,
        })
        .blur();
    await expect(cn).toHaveValue(combinedRule);
    await expect(tw).toHaveValue('zh-tw:攝影之旅');
    await expect(
        original.getByRole('textbox', {
            name: english['titles.originalTitle'],
            exact: true,
        }),
    ).toHaveValue('ja:写真冒険2');
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    await expect(article).toHaveValue(/\{\{DEFAULTSORT:Shashin Bouken\}\}/u);
    await expect(article).toHaveValue(/写真冒険2/u);
    await expect(article).toHaveValue(
        /zh-cn:摄影冒险;\s*zh-tw:攝影最後版本;\s*zh-hk:攝影香港版本;/u,
    );
    expect((await article.inputValue()).match(/^\|\s*\d+\s*=/gmu)).toHaveLength(
        1,
    );
    await preview
        .getByRole('button', { name: english['preview.dismiss'], exact: true })
        .click();

    await cn.fill('zh-cn:摄影冒险; zh-hk:攝影香港版本');
    await cn.press('Enter');
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    await expect(article).toHaveValue(
        /zh-cn:摄影冒险;\s*zh-tw:攝影之旅;\s*zh-hk:攝影香港版本;/u,
    );
    await expect(article).not.toHaveValue(/攝影最後版本/u);
    await preview
        .getByRole('button', { name: english['preview.dismiss'], exact: true })
        .click();
    await cn.fill('');
    await cn.press('Enter');
    await expect(tw).toHaveValue('zh-tw:攝影之旅');
    await expect(
        original.getByRole('textbox', {
            name: english['titles.originalTitle'],
            exact: true,
        }),
    ).toHaveValue('ja:写真冒険2');
    await expect(
        englishCard.getByRole('textbox', {
            name: english['titles.englishTitle'],
            exact: true,
        }),
    ).toHaveValue('Photo Adventure');
    await main
        .getByRole('button', { name: english['form.review'], exact: true })
        .click();
    await expect(article).toHaveValue(/zh-tw:攝影之旅;/u);
    await expect(article).not.toHaveValue(/zh-cn:|zh-hk:/u);
    expect(await readWrites(page)).toEqual([]);
});

test('Names refreshes redirects as titles change and preserves manual review', async ({
    page,
}) => {
    await loadCreator(page);
    await openCreator(page);
    const main = page.getByRole('dialog');
    const namesTab = main.getByRole('tab', {
        name: english['titles.tab'],
        exact: true,
    });
    await namesTab.click();
    const redirects = main;
    const localizedCard = main
        .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
        .first();
    await localizedCard
        .locator('[data-kanade-vg-stub-creator-name-set-uses]')
        .click();
    await main
        .locator(
            '[data-kanade-vg-stub-creator-name-kind="original"] [data-kanade-vg-stub-creator-name-set-uses]',
        )
        .click();
    await main
        .locator(
            '[data-kanade-vg-stub-creator-name-kind="english"] [data-kanade-vg-stub-creator-name-set-uses]',
        )
        .click();
    const englishName = main.getByRole('textbox', {
        name: english['titles.englishTitle'],
        exact: true,
    });
    await englishName.fill('English alias');
    await englishName.blur();
    const englishRow = await getRedirectRow(redirects, 'English alias');
    await englishRow
        .getByRole('button', { name: 'create page', exact: true })
        .click();
    const englishEditor = page.getByRole('dialog').filter({
        has: page.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    });
    const reviewedEnglishSource =
        '#REDIRECT [[Star Harbor]]\n<!-- Reviewed English alias -->';
    await englishEditor
        .getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        })
        .fill(reviewedEnglishSource);
    await englishEditor
        .getByRole('button', { name: english['preview.stage'], exact: true })
        .click();
    await expect(englishRow.getByRole('checkbox')).toBeChecked();
    await englishRow.getByRole('checkbox').uncheck();
    await expect(englishRow.getByRole('checkbox')).not.toBeChecked();
    await expect(
        main.locator(
            '[data-kanade-vg-stub-creator-name-kind="english"] [data-kanade-vg-stub-creator-name-use-chip="redirect"]',
        ),
    ).toHaveCount(0);
    const manualRedirects = localizedCard.locator(
        '[data-kanade-vg-stub-creator-name-role="redirect"]',
    );
    await manualRedirects
        .getByRole('button', {
            name: english['names.addRedirect'],
            exact: true,
        })
        .click();
    const redirectInputs = manualRedirects
        .locator('[data-kanade-vg-stub-creator-name-redirect-row]')
        .getByRole('textbox');
    const manualInput = redirectInputs.nth((await redirectInputs.count()) - 1);
    await manualInput.fill('Manual alias');
    await manualInput.blur();
    const manualRow = await getRedirectRow(redirects, 'Manual alias');
    await manualRow
        .getByRole('button', { name: 'create page', exact: true })
        .click();
    const editor = page.getByRole('dialog').filter({
        has: page.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    });
    const reviewedSource = '#REDIRECT [[Star Harbor]]\n<!-- Reviewed alias -->';
    await editor
        .getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        })
        .fill(reviewedSource);
    await editor
        .getByRole('button', { name: english['preview.stage'], exact: true })
        .click();
    await manualRow.getByRole('checkbox').uncheck();

    const originalName = main.getByRole('textbox', {
        name: english['titles.originalTitle'],
        exact: true,
    });
    await originalName.fill('ja:Original alias');
    await originalName.blur();
    await getRedirectRow(redirects, 'Original alias');
    await englishName.fill('Updated English alias');
    await englishName.blur();
    await getRedirectRow(redirects, 'Updated English alias');
    const localizedName = main.getByRole('textbox', {
        name: `${english['names.localizedName']} 1`,
        exact: true,
    });
    await localizedName.fill('星港别名');
    await localizedName.blur();
    await getRedirectRow(redirects, '星港别名');
    await expect(namesTab).toHaveAttribute('aria-selected', 'true');
    await expect(
        (await getRedirectRow(redirects, 'English alias')).getByRole(
            'checkbox',
        ),
    ).not.toBeChecked();
    const preservedEnglish = await getRedirectRow(redirects, 'English alias');
    await preservedEnglish
        .getByRole('button', { name: 'pending page', exact: true })
        .click();
    await expect(
        englishEditor.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    ).toHaveValue(reviewedEnglishSource);
    await englishEditor
        .getByRole('button', { name: english['preview.cancel'], exact: true })
        .click();
    const preservedManual = await getRedirectRow(redirects, 'Manual alias');
    await expect(preservedManual.getByRole('checkbox')).not.toBeChecked();
    await preservedManual
        .getByRole('button', { name: 'pending page', exact: true })
        .click();
    await expect(
        editor.getByRole('textbox', {
            name: english['preview.wikitext'],
            exact: true,
        }),
    ).toHaveValue(reviewedSource);
    expect(await readWrites(page)).toEqual([]);
});

async function getRedirectRow(table: Locator, title: string): Promise<Locator> {
    const row = table.locator(
        `[data-kanade-vg-stub-creator-name-primary-redirect=${JSON.stringify(title)}], [data-kanade-vg-stub-creator-name-redirect-row=${JSON.stringify(title)}]`,
    );
    await expect(row).toHaveCount(1);
    return row;
}

for (const width of [390, 1024]) {
    test(`metadata item rows follow their entry and keep related controls inline at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await loadCreator(page);
        await openCreator(page);
        const main = page.getByRole('dialog');
        const input = main.getByRole('textbox', {
            name: english['metadata.developers'],
            exact: true,
        });
        await input.fill('Nintendo');
        await input.blur();
        const field = main.locator(
            '[data-kanade-vg-stub-creator-field="developers"]',
        );
        await expect(
            field.getByRole('link', { name: /任天堂游戏/u }),
        ).toBeVisible();
        const layout = await field.evaluate((card) => {
            const input = card.querySelector<HTMLInputElement>('input');
            const item = card.querySelector<HTMLElement>(
                '.kanade-vg-stub-creator-metadata-item',
            );
            const name =
                item?.querySelector<HTMLInputElement>('input[type=text]');
            const related = item?.querySelector<HTMLElement>(
                '.kanade-vg-stub-creator-related-item',
            );
            const inputRect = input?.getBoundingClientRect();
            const itemRect = item?.getBoundingClientRect();
            const nameRect = name?.getBoundingClientRect();
            const relatedRect = related?.getBoundingClientRect();
            if (!inputRect || !itemRect || !nameRect || !relatedRect)
                throw new Error('Missing metadata layout');
            return {
                inputBottom: inputRect.bottom,
                itemTop: itemRect.top,
                nameBottom: nameRect.bottom,
                nameRight: nameRect.right,
                related: { left: relatedRect.left, top: relatedRect.top },
                inputBeforeItem: Boolean(
                    input!.compareDocumentPosition(item!) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
                ),
                nameBeforeRelated: Boolean(
                    name!.compareDocumentPosition(related!) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
                ),
            };
        });
        expect(layout.inputBeforeItem).toBe(true);
        expect(layout.nameBeforeRelated).toBe(true);
        expect(layout.itemTop).toBeGreaterThanOrEqual(layout.inputBottom);
        if (width > 640) {
            expect(layout.related.left).toBeGreaterThan(layout.nameRight);
            expect(layout.related.top).toBeLessThan(layout.nameBottom);
        }
        expect(await main.evaluate(inspectDialog)).toEqual([]);
        expect(await readWrites(page)).toEqual([]);
    });
}

test('unsupported sites and namespaces expose no launcher', async ({
    page,
}) => {
    for (const options of [
        { database: 'dewiki' },
        { namespace: 14, title: 'Example games' },
    ]) {
        await loadCreator(page, options);
        await expect(
            page.locator('#kanade-vg-stub-creator-launcher'),
        ).toHaveCount(0);
        await expect(page.getByRole('dialog')).toHaveCount(0);
    }
});

for (const database of ['zhwiki', 'enwiki']) {
    test(`${database} shares one application when installations overlap`, async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const launcher = page.locator(
            database === 'zhwiki'
                ? '#kanade-vg-stub-creator-launcher'
                : '#ca-create-zhwiki-vg-stub',
        );
        await loadCreator(page, {
            database,
            articleId: database === 'enwiki' ? 123 : 0,
            deferResourceLoader: true,
        });
        const startupResources = await readResourceLoads(page);
        expect(startupResources).toHaveLength(1);
        await expect(launcher).toHaveCount(0);
        await installCreatorScript(page, 'vg_stub_creator.user.js');
        expect(await readResourceLoads(page)).toHaveLength(1);
        await releaseResourceLoader(page);
        await expect(launcher).toHaveCount(1);
        expect(await readResourceLoads(page)).toEqual(startupResources);
        await installCreatorScript(page);
        expect(await readResourceLoads(page)).toEqual(startupResources);
        await expect(launcher).toHaveCount(1);
        if (database === 'zhwiki') {
            await openCreator(page);
            expect(await readResourceLoads(page)).toEqual(startupResources);
            await expect(page.getByRole('dialog')).toHaveCount(1);
            await expect(page.locator('[data-v-app]')).toHaveCount(1);
        } else {
            await expect(page.locator('[data-v-app]')).toHaveCount(0);
        }
        expect(await readWrites(page)).toEqual([]);
        expect(errors).toEqual([]);
    });
}

test('documentation screenshots', async ({ page }, testInfo) => {
    test.skip(process.env.DOCUMENTATION_SCREENSHOTS !== '1');
    const example = JSON.parse(
        await readFile(
            resolve('tests/vg-stub-creator/fixtures/toem-2.screenshot.json'),
            'utf8',
        ),
    );
    await page.setViewportSize({ width: 1024, height: 768 });
    await loadCreator(page, {
        locale: 'zh-Hans',
        title: example.pageName,
        existingTitles: [
            'Category:Windows游戏',
            'Category:MacOS遊戲',
            'Category:冒險遊戲',
            'Template:TOEM',
            'Template:adventure-videogame-stub',
        ],
        citationMetadata: Object.fromEntries(
            [
                [example.localizedName.sourceUrl, 'Steam'],
                [example.metacriticScoreSourceUrl, 'Metacritic'],
                [example.openCriticRecommendSourceUrl, 'OpenCritic'],
            ].map(([url, websiteTitle]) => [
                url,
                {
                    itemType: 'webpage',
                    title: example.englishName,
                    url,
                    websiteTitle,
                },
            ]),
        ),
    });
    await openCreator(page);
    const main = page.getByRole('dialog');
    const directory = testInfo.outputPath('documentation-screenshots');
    await mkdir(directory, { recursive: true });
    const enwiki = main.getByRole('textbox', {
        name: simplified['metadata.enwikiPage'],
        exact: true,
    });
    await enwiki.fill(example.enwikiTitle);
    await enwiki.blur();
    for (const [fieldKey, messageKey] of [
        ['developers', 'metadata.developers'],
        ['publishers', 'metadata.publishers'],
        ['platforms', 'metadata.platforms'],
        ['year', 'metadata.releaseYear'],
        ['genres', 'metadata.genres'],
    ] as const) {
        const field = main.locator(
            '[data-kanade-vg-stub-creator-field="' + fieldKey + '"]',
        );
        const input = field.getByRole('textbox', {
            name: simplified[messageKey],
            exact: true,
        });
        await input.fill(example[fieldKey]);
        await input.blur();
        await expect(input).toHaveValue('');
        if (fieldKey !== 'year') {
            await input.fill(example.localizedName.sourceUrl);
            await input.blur();
            await expect(input).toHaveValue('');
            await expectSourcesAtBottom(field);
        }
    }
    const developers = main.locator(
        '[data-kanade-vg-stub-creator-field="developers"]',
    );
    const developerCategory = developers
        .locator(
            '[data-kanade-vg-stub-creator-kind="category"] .kanade-vg-stub-creator-related-link',
        )
        .first();
    await setRelatedEnabled(developerCategory, true);
    const platforms = main.locator(
        '[data-kanade-vg-stub-creator-field="platforms"]',
    );
    const platformItems = platforms.locator(
        '[data-kanade-vg-stub-creator-metadata-item]',
    );
    await expect(platformItems).toHaveCount(6);
    const windows = platformItems.first();
    await addRelatedChoice(platforms, '{{TOEM}}', windows);
    await setRelatedEnabled(
        windows.getByRole('link', { name: '{{TOEM}}', exact: true }),
        false,
    );
    for (const stub of await platforms
        .locator(
            '[data-kanade-vg-stub-creator-kind="stubTag"] .kanade-vg-stub-creator-related-link',
        )
        .all())
        await setRelatedEnabled(stub, false);
    for (const [index, enabled] of [
        [0, true],
        [1, false],
        [2, false],
        [3, false],
        [4, true],
        [5, false],
    ] as const) {
        await setRelatedEnabled(
            platformItems
                .nth(index)
                .locator(
                    '[data-kanade-vg-stub-creator-kind="category"] .kanade-vg-stub-creator-related-link',
                )
                .first(),
            enabled,
        );
    }
    const genres = main.locator('[data-kanade-vg-stub-creator-field="genres"]');
    const adventure = genres.getByRole('link', {
        name: '{{adventure-videogame-stub}}',
        exact: true,
    });
    await setRelatedEnabled(adventure, true);
    await expect(adventure).toHaveAttribute(
        'data-kanade-vg-stub-creator-existence',
        'exists',
    );
    await expect(
        windows.getByRole('link', {
            name: '{{Windows-videogame-stub}}',
            exact: true,
        }),
    ).toHaveAttribute('data-kanade-vg-stub-creator-enabled', 'false');

    await main
        .getByRole('tab', { name: simplified['titles.tab'], exact: true })
        .click();
    for (const [fieldKey, key, value] of [
        ['englishName', 'titles.englishTitle', example.englishName],
    ] as const) {
        const input = main
            .locator('[data-kanade-vg-stub-creator-field="' + fieldKey + '"]')
            .getByRole('textbox', {
                name: simplified[key],
                exact: true,
            });
        await input.fill(value);
        await input.blur();
    }
    const nameCard = main.locator('.kanade-vg-stub-creator-name-card').first();
    await nameCard
        .getByRole('textbox', {
            name: simplified['names.localizedName'] + ' 1',
            exact: true,
        })
        .fill(example.localizedName.name);
    await nameCard
        .getByRole('textbox', {
            name: simplified['names.localizedName'] + ' 1',
            exact: true,
        })
        .blur();
    await nameCard
        .getByRole('checkbox', {
            name: simplified['names.official'],
            exact: true,
        })
        .setChecked(example.localizedName.official);
    await nameCard
        .getByRole('checkbox', { name: 'Hans', exact: true })
        .setChecked(example.localizedName.hans);
    const localizedSource = nameCard.getByRole('textbox', {
        name: simplified['names.sourceUrls'] + ' 1',
        exact: true,
    });
    await localizedSource.fill(example.localizedName.sourceUrl);
    await localizedSource.blur();

    await main
        .getByRole('tab', { name: simplified['text.tab'], exact: true })
        .click();
    for (const [fieldKey, messageKey, sourceKey] of [
        ['metacriticScore', 'text.metacriticScore', 'metacriticScoreSourceUrl'],
        [
            'openCriticRecommend',
            'text.openCritic',
            'openCriticRecommendSourceUrl',
        ],
        ['additionalProse', 'text.additionalProse', null],
    ] as const) {
        const field = main.locator(
            '[data-kanade-vg-stub-creator-field="' + fieldKey + '"]',
        );
        const input = field.getByRole('textbox', {
            name: simplified[messageKey],
            exact: true,
        });
        await input.fill(example[fieldKey]);
        await input.blur();
        if (sourceKey) {
            const source = field.locator(
                '.kanade-vg-stub-creator-source-url input',
            );
            await source.fill(example[sourceKey]);
            await source.blur();
        }
    }

    await main
        .getByRole('tab', { name: simplified['metadata.tab'], exact: true })
        .click();
    await page.mouse.move(0, 0);
    await main.locator('.cdx-dialog__body').evaluate((body) => {
        body.scrollTop = 0;
    });
    await expect(main.getByRole('tab').first()).toBeInViewport({ ratio: 1 });
    await expect(main.getByRole('tab').last()).toBeInViewport({ ratio: 1 });
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                );
            }),
    );
    await page.screenshot({ path: resolve(directory, 'creator-desktop.png') });
    await platforms.evaluate((field) => {
        const body = field.closest<HTMLElement>('.cdx-dialog__body');
        if (body)
            body.scrollTop +=
                field.getBoundingClientRect().top -
                body.getBoundingClientRect().top -
                16;
    });
    await expect(
        platforms.locator('[data-kanade-vg-stub-creator-metadata-sources]'),
    ).toBeInViewport({
        ratio: 1,
    });
    const navbox = windows.getByRole('link', { name: '{{TOEM}}', exact: true });
    await expect(navbox).toHaveAttribute(
        'data-kanade-vg-stub-creator-existence',
        'exists',
    );
    await page.mouse.move(0, 0);
    await page.screenshot({
        path: resolve(directory, 'creator-related-items.png'),
    });
    await navbox.dblclick();
    const tagInput = windows.getByRole('textbox', {
        name: simplified['review.templateName'],
        exact: true,
    });
    await expect(tagInput).toHaveValue('{{TOEM}}');
    await expect(
        windows.getByRole('button', {
            name: simplified['presave.editPage'],
            exact: true,
        }),
    ).toBeVisible();
    await tagInput.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await developers.evaluate((field) => {
        const body = field.closest<HTMLElement>('.cdx-dialog__body');
        if (body)
            body.scrollTop +=
                field.getBoundingClientRect().top -
                body.getBoundingClientRect().top -
                16;
    });
    await expect(
        developers.locator('[data-kanade-vg-stub-creator-metadata-sources]'),
    ).toBeInViewport({
        ratio: 1,
    });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: resolve(directory, 'creator-mobile.png') });

    await page.setViewportSize({ width: 1024, height: 768 });
    await main
        .getByRole('tab', { name: simplified['titles.tab'], exact: true })
        .click();
    await main.locator('.cdx-dialog__body').evaluate((body) => {
        body.scrollTop = 0;
    });
    await expect(
        main.locator('.kanade-vg-stub-creator-name-lookup-group'),
    ).toBeInViewport();
    await page.screenshot({
        path: resolve(directory, 'creator-name-lookup.png'),
    });
    const localizedCard = main
        .locator('[data-kanade-vg-stub-creator-name-kind="localized"]')
        .first();
    await localizedCard
        .locator('[data-kanade-vg-stub-creator-name-set-uses]')
        .click();
    for (const role of ['pageName', 'displayTitle']) {
        const value = localizedCard
            .locator('[data-kanade-vg-stub-creator-name-role="' + role + '"]')
            .getByRole('textbox');
        await value.fill('');
        await value.press('Enter');
    }
    await localizedCard
        .locator('[data-kanade-vg-stub-creator-name-role="pageName"]')
        .getByRole('checkbox')
        .check();
    await localizedCard
        .locator('[data-kanade-vg-stub-creator-name-role="displayTitle"]')
        .getByRole('checkbox')
        .check();
    await localizedCard
        .locator('[data-kanade-vg-stub-creator-name-role="redirect"]')
        .getByRole('checkbox', {
            name: simplified['names.useAsRedirect'],
            exact: true,
        })
        .uncheck();
    await localizedCard
        .locator('[data-kanade-vg-stub-creator-name-role="noteTa"]')
        .getByRole('checkbox')
        .check();
    await expect(
        localizedCard.locator(
            '[data-kanade-vg-stub-creator-name-role="pageName"] .kanade-vg-stub-creator-name-role-select-button',
        ),
    ).toHaveCount(0);
    await expect(
        localizedCard.locator(
            '[data-kanade-vg-stub-creator-name-role="pageName"] .kanade-vg-stub-creator-name-role-page-link',
        ),
    ).toHaveAccessibleName(
        simplified['names.openPage'].replace('{title}', example.pageName),
    );
    await localizedCard.evaluate((card) => {
        const body = card.closest<HTMLElement>('.cdx-dialog__body');
        if (body)
            body.scrollTop +=
                card.getBoundingClientRect().top -
                body.getBoundingClientRect().top -
                16;
    });
    await page.screenshot({ path: resolve(directory, 'creator-names.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await localizedCard.evaluate((card) => {
        const body = card.closest<HTMLElement>('.cdx-dialog__body');
        if (body)
            body.scrollTop +=
                card.getBoundingClientRect().top -
                body.getBoundingClientRect().top -
                16;
    });
    expect(await main.evaluate(inspectDialog)).toEqual([]);
    await page.screenshot({
        path: resolve(directory, 'creator-names-mobile.png'),
    });
    await page.setViewportSize({ width: 1024, height: 768 });
    const englishCard = main.locator(
        '[data-kanade-vg-stub-creator-name-kind="english"]',
    );
    await englishCard
        .locator('[data-kanade-vg-stub-creator-name-set-uses]')
        .click();
    const redirects = englishCard.locator(
        '[data-kanade-vg-stub-creator-name-role="redirect"]',
    );
    await expect(
        redirects
            .locator('[data-kanade-vg-stub-creator-name-primary-redirect]')
            .getByRole('textbox'),
    ).toHaveValue('');
    await expect(
        redirects
            .locator('[data-kanade-vg-stub-creator-name-primary-redirect]')
            .getByRole('textbox'),
    ).toHaveAttribute('placeholder', new RegExp(example.englishName, 'u'));
    await redirects
        .getByRole('button', {
            name: simplified['names.addRedirect'],
            exact: true,
        })
        .click();
    const extraRedirect = redirects
        .locator('[data-kanade-vg-stub-creator-name-redirect-row]')
        .getByRole('textbox')
        .last();
    await extraRedirect.fill(example.englishName + ' (video game)');
    await extraRedirect.press('Enter');
    await expect(
        redirects.getByRole('checkbox', {
            name: simplified['names.useAsRedirectNumber'].replace(
                '{number}',
                '2',
            ),
            exact: true,
        }),
    ).toBeChecked();
    await englishCard.evaluate((card) => {
        const body = card.closest<HTMLElement>('.cdx-dialog__body');
        if (body)
            body.scrollTop +=
                card.getBoundingClientRect().top -
                body.getBoundingClientRect().top -
                16;
    });
    await page.screenshot({
        path: resolve(directory, 'creator-redirects.png'),
    });
    await main
        .getByRole('button', { name: simplified['form.review'], exact: true })
        .click();
    const article = page.getByRole('textbox', {
        name: simplified['preview.wikitext'],
        exact: true,
    });
    await expect(article).toHaveValue(/摄影冒险2/u);
    await expect(article).toHaveValue(/Something We Made/u);
    await expect(article).toHaveValue(/冒险|冒險/u);
    await expect(article).toHaveValue(/\{\{adventure-videogame-stub\}\}/u);
    await expect(article).not.toHaveValue(
        /\{\{(?:Windows|Mac|Nintendo|PlayStation)-videogame-stub\}\}|\{\{Nintendo-stub\}\}|\{\{PlayStation-stub\}\}/u,
    );
    await article.evaluate((textarea) => {
        textarea.scrollTop = 0;
    });
    await page.screenshot({ path: resolve(directory, 'creator-source.png') });
    expect(await readWrites(page)).toEqual([]);
});
