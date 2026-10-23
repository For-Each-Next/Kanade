/**
 * @file tests/rev-copy/browser.test.mjs
 * Purpose: Exercise startup, skin placement, clipboard errors, and revision lookup races.
 *
 * Table of contents:
 * 1. Imports
 * 2. Skin and copy tests
 * 3. Startup and supported views
 * 4. Failure and stale-response tests
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createHost, settle } from './helpers.mjs';

const skins = [
    [
        'Vector 2022',
        '<h1>Intel</h1><div class="vector-body-before-content"><span>Subtitle</span></div><div id="mw-content-text">Body</div>',
        '.vector-body-before-content',
    ],
    [
        'Vector legacy',
        '<div id="bodyContent"><div id="contentSub">Subtitle</div><div id="mw-content-text">Body</div></div>',
        '#bodyContent',
    ],
    [
        'MonoBook',
        '<div id="bodyContent"><div id="contentSub"></div><div id="mw-content-text">Body</div></div>',
        '#bodyContent',
    ],
    [
        'Timeless',
        '<div id="bodyContent"><div id="contentSub"></div><div id="mw-content-text">Body</div></div>',
        '#bodyContent',
    ],
    [
        'Modern',
        '<div id="content"><div id="contentSub"></div><div id="mw-content-text">Body</div></div>',
        '#content',
    ],
    [
        'CologneBlue',
        '<div id="content"><div id="topbar">Top</div><div id="article"><h1>Intel</h1><p class="tagline">Subtitle</p><div id="mw-content-text">Body</div></div></div>',
        '#article',
    ],
    [
        'Minerva',
        '<div id="content"><div class="pre-content"><h1>Intel</h1></div><div id="bodyContent"><div id="mw-content-text">Body</div></div></div>',
        '.pre-content',
    ],
];
for (const [skin, html, parent] of skins) {
    test(`${skin} places exactly one row at its content boundary`, async () => {
        const host = createHost({ html });
        try {
            host.start();
            await settle();
            const row = host.document.getElementById('kanade-rev-copy-row');
            assert.equal(
                row.parentElement,
                host.document.querySelector(parent),
            );
            if (!['Vector 2022', 'Minerva'].includes(skin))
                assert.equal(row.nextElementSibling.id, 'mw-content-text');
            host.fireContent();
            host.start();
            await settle();
            assert.equal(
                host.document.querySelectorAll('#kanade-rev-copy-row').length,
                1,
            );
            assert.equal(host.requests.length, 1);
        } finally {
            host.dom.window.close();
        }
    });
}

test('the row has no margin at the content boundary', async () => {
    const host = createHost({
        html: '<h1>Intel</h1><div class="vector-body-before-content"><div id="siteSub">From Wikipedia</div><div id="contentSub">Revision notice</div></div><div id="mw-content-text">Body</div>',
    });
    try {
        host.start();
        await settle();
        const row = host.document.getElementById('kanade-rev-copy-row');
        assert.equal(row.previousElementSibling.id, 'contentSub');
        assert.equal(host.window.getComputedStyle(row).margin, '0px');
    } finally {
        host.dom.window.close();
    }
});

test('page-title controls survive hooks and remount with the current page identity', async () => {
    const host = createHost({
        html: '<h1 id="firstHeading"><span>Intel 1103</span></h1><div class="vector-body-before-content"></div><div id="mw-content-text"><h1>Article heading</h1><h2 id="History">History</h2></div>',
    });
    try {
        host.start();
        await settle();
        const original = host.document.getElementById('firstHeading');
        let trigger = original.querySelector(
            '.kanade-rev-copy-section-trigger',
        );
        assert.equal(trigger.getAttribute('href'), '#top');
        assert.equal(
            host.window.getComputedStyle(
                original.querySelector('.kanade-rev-copy-section-control'),
            ).position,
            'absolute',
        );
        trigger.click();
        await settle();
        assert.deepEqual(host.copies, ['[[:Intel 1103#top]]']);
        const replacement = host.document.createElement('h1');
        replacement.id = 'firstHeading';
        replacement.textContent = 'Renamed heading';
        original.replaceWith(replacement);
        host.fireContent();
        await settle();
        assert.equal(host.requests.length, 1);
        assert.equal(
            original.querySelector('.kanade-rev-copy-section-control'),
            null,
        );
        trigger = replacement.querySelector('.kanade-rev-copy-section-trigger');
        assert.equal(
            trigger.getAttribute('aria-label'),
            'Copy link to Renamed heading',
        );
        trigger.dispatchEvent(
            new host.window.KeyboardEvent('keydown', {
                key: 'ArrowDown',
                bubbles: true,
                cancelable: true,
            }),
        );
        const choices = host.document.querySelectorAll(
            '.kanade-rev-copy-section-popup a',
        );
        assert.deepEqual(
            [...choices].map((choice) => choice.textContent),
            ['Copy link', 'Copy permalink', 'Copy both', 'Advanced copy'],
        );
        choices[2].click();
        await settle();
        assert.equal(
            host.copies[1],
            '[[:Intel 1103#top]] ([[:Special:PermaLink/123#top|2026年9月5日 12:00:26]])',
        );
        host.values.wgPageName = 'New_article';
        host.values.wgRevisionId = 456;
        replacement.lastChild.textContent = 'New article';
        host.document.getElementById('mw-content-text').outerHTML =
            '<div id="mw-content-text"><h2 id="New_section">New section</h2></div>';
        host.fireContent();
        await settle();
        assert.equal(
            replacement.querySelectorAll('.kanade-rev-copy-section-control')
                .length,
            1,
        );
        trigger.click();
        await settle();
        assert.equal(host.copies.length, 2);
        replacement.querySelector('.kanade-rev-copy-section-trigger').click();
        await settle();
        assert.equal(host.copies[2], '[[:New article#top]]');
        assert.equal(
            host.document.querySelectorAll('.kanade-rev-copy-section-control')
                .length,
            2,
        );
    } finally {
        host.dom.window.close();
    }
});

test('one copy action copies both links pinned to the displayed revision', async () => {
    const host = createHost();
    try {
        host.start();
        await settle();
        assert.equal(host.requests[0].revids, 123);
        assert.equal(
            host.document.querySelector('.kanade-rev-copy-page').tagName,
            'CODE',
        );
        assert.equal(
            host.document.querySelector('.kanade-rev-copy-page').textContent,
            '[[:Intel 1103]]',
        );
        assert.equal(
            host.document.querySelectorAll('#kanade-rev-copy-row button')
                .length,
            0,
        );
        assert.equal(host.requests[0].rvprop, 'ids|timestamp');
        assert.equal(
            host.document
                .querySelector('.kanade-rev-copy-actions')
                .textContent.replaceAll('\u00a0', ' '),
            '[ copy | tools ]',
        );
        assert.equal(
            host.document.querySelectorAll('.kanade-rev-copy-action').length,
            2,
        );
        host.document
            .querySelector('[data-kanade-rev-copy-action="copy"]')
            .click();
        await settle();
        const page = '[[:Intel 1103]]';
        const revision = '[[:Special:PermaLink/123|2026年9月5日 12:00:26]]';
        assert.deepEqual(host.copies, [`${page} (${revision})`]);
        assert.equal(host.notifications.length, 1);
        assert.ok(
            host.notifications.every(({ options }) => options.type !== 'error'),
        );
    } finally {
        host.dom.window.close();
    }
});

test('literal code selects page and inner revision separately without writing to the clipboard', async () => {
    const host = createHost();
    try {
        host.start();
        await settle();
        const page = host.document.querySelector('.kanade-rev-copy-page');
        const revision = host.document.querySelector(
            '.kanade-rev-copy-permalink',
        );
        for (const code of [page, revision]) {
            assert.equal(code.getAttribute('role'), 'button');
            assert.equal(code.tabIndex, 0);
            host.window.getSelection().removeAllRanges();
            code.click();
            assert.equal(
                host.window.getSelection().toString(),
                code.textContent,
            );
            host.window.getSelection().removeAllRanges();
            code.dispatchEvent(
                new host.window.KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                    cancelable: true,
                }),
            );
            assert.equal(
                host.window.getSelection().toString(),
                code.textContent,
            );
            host.window.getSelection().removeAllRanges();
            code.dispatchEvent(
                new host.window.KeyboardEvent('keydown', {
                    key: ' ',
                    bubbles: true,
                    cancelable: true,
                }),
            );
            assert.equal(
                host.window.getSelection().toString(),
                code.textContent,
            );
        }
        assert.equal(
            host.window.getSelection().toString(),
            '[[:Special:PermaLink/123|2026年9月5日 12:00:26]]',
        );
        const range = host.document.createRange();
        range.setStart(page.firstChild, 3);
        range.setEnd(page.firstChild, 8);
        const selection = host.window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        page.click();
        assert.equal(selection.toString(), 'Intel');
        assert.deepEqual(host.copies, []);
        assert.deepEqual(host.notifications, []);
    } finally {
        host.dom.window.close();
    }
});

test('ordinary labels remain real navigation anchors without selection handlers', async () => {
    const host = createHost({ gadgetConfig: { displayWikitext: false } });
    try {
        host.start();
        await settle();
        for (const anchor of host.document.querySelectorAll(
            '.kanade-rev-copy-page, .kanade-rev-copy-permalink',
        )) {
            assert.equal(anchor.tagName, 'A');
            assert.equal(anchor.hasAttribute('role'), false);
            assert.ok(anchor.getAttribute('href').startsWith('/wiki/'));
            const click = new host.window.MouseEvent('click', {
                bubbles: true,
                cancelable: true,
            });
            // Prevent jsdom navigation only after the gadget's handlers have run.
            anchor.addEventListener(
                'click',
                (event) => {
                    assert.equal(event.defaultPrevented, false);
                    event.preventDefault();
                },
                { once: true },
            );
            anchor.dispatchEvent(click);
        }
        assert.equal(host.window.getSelection().toString(), '');
        assert.deepEqual(host.copies, []);
    } finally {
        host.dom.window.close();
    }
});

test('comparison views pin both revision IDs and use the newer revision timestamp', async () => {
    const host = createHost({
        config: { wgRevisionId: 0, wgDiffOldId: 88, wgDiffNewId: 123 },
        url: 'https://zh.wikipedia.org/w/index.php?title=Intel_1103&diff=123&oldid=88',
    });
    try {
        host.start();
        await settle();
        assert.equal(host.requests[0].revids, 123);
        assert.equal(
            host.document.querySelector('.kanade-rev-copy-permalink')
                .textContent,
            '[[:Special:Diff/88/123|2026年9月5日 12:00:26]]',
        );
        host.document
            .querySelector('[data-kanade-rev-copy-action="copy"]')
            .click();
        await settle();
        assert.equal(
            host.copies[0],
            '[[:Intel 1103]] ([[:Special:Diff/88/123|2026年9月5日 12:00:26]])',
        );
        // Comparing the same newer revision against a different old revision must refresh.
        host.values.wgDiffOldId = 77;
        host.fireContent();
        await settle();
        assert.equal(
            host.document.querySelector('.kanade-rev-copy-permalink')
                .textContent,
            '[[:Special:Diff/77/123|2026年9月5日 12:00:26]]',
        );
    } finally {
        host.dom.window.close();
    }
});

test('Japanese timestamp ignores English interface preference and permits literal display', async () => {
    const host = createHost({
        config: {
            wgServerName: 'ja.wikipedia.org',
            wgContentLanguage: 'ja',
            wgUserLanguage: 'en',
            wgPageName: 'インテル_1103',
        },
        gadgetConfig: { displayWikitext: true },
    });
    try {
        host.start();
        await settle();
        const anchors = host.document.querySelectorAll(
            '.kanade-rev-copy-page, .kanade-rev-copy-permalink',
        );
        assert.equal(anchors[0].textContent, '[[:w:ja:インテル 1103]]');
        assert.equal(
            anchors[1].textContent,
            '[[:w:ja:Special:PermaLink/123|2026年9月5日 12:00:26]]',
        );
        assert.equal(
            host.document.querySelector('[data-kanade-rev-copy-action="copy"]')
                .textContent,
            'copy',
        );
        assert.equal(
            host.document.querySelectorAll('#kanade-rev-copy-row script')
                .length,
            0,
        );
    } finally {
        host.dom.window.close();
    }
});

test('bootstrapping can precede ResourceLoader readiness', async () => {
    const host = createHost({ ready: false });
    try {
        host.start();
        await settle();
        assert.equal(host.requests.length, 0);
        host.queue.forEach((callback) => callback());
        await settle();
        assert.equal(host.requests.length, 1);
        assert.ok(host.document.getElementById('kanade-rev-copy-row'));
    } finally {
        host.dom.window.close();
    }
});

for (const [label, config, url] of [
    ['edit', { wgAction: 'edit' }],
    ['history', { wgAction: 'history' }],
    ['unsupported site', { wgServerName: 'example.org' }],
]) {
    test(`${label} does not add a row or query a revision`, async () => {
        const host = createHost({ config, url });
        try {
            host.start();
            await settle();
            assert.equal(
                host.document.getElementById('kanade-rev-copy-row'),
                null,
            );
            assert.equal(host.requests.length, 0);
        } finally {
            host.dom.window.close();
        }
    });
}

for (const [label, config, url] of [
    ['special page', { wgNamespaceNumber: -1, wgPageName: 'Special:Version' }],
    ['missing page', { wgRevisionId: 0 }],
    [
        'diff without comparison IDs',
        {},
        'https://zh.wikipedia.org/w/index.php?title=Intel_1103&diff=prev&oldid=123',
    ],
]) {
    test(`${label} copies the page with the same two row actions`, async () => {
        const host = createHost({ config, url });
        try {
            host.start();
            await settle();
            assert.ok(host.document.getElementById('kanade-rev-copy-row'));
            assert.equal(host.requests.length, 0);
            assert.equal(
                host.document.querySelector('.kanade-rev-copy-revision').hidden,
                true,
            );
            assert.equal(
                host.document.querySelectorAll('.kanade-rev-copy-action')
                    .length,
                2,
            );
            assert.equal(
                [
                    ...host.document.querySelector('.kanade-rev-copy-actions')
                        .children,
                ]
                    .filter((child) => !child.hidden)
                    .map((child) => child.textContent)
                    .join('')
                    .replaceAll('\u00a0', ' '),
                '[ copy | tools ]',
            );
            host.document
                .querySelector('[data-kanade-rev-copy-action="copy"]')
                .click();
            await settle();
            assert.equal(host.copies.length, 1);
            assert.equal(
                host.copies[0],
                host.document.querySelector('.kanade-rev-copy-page')
                    .textContent,
            );
        } finally {
            host.dom.window.close();
        }
    });
}

test('clipboard rejection reports failure and leaves the copy link usable', async () => {
    const host = createHost({ clipboardError: true });
    try {
        host.start();
        await settle();
        const button = host.document.querySelector(
            '[data-kanade-rev-copy-action="copy"]',
        );
        button.click();
        await settle();
        assert.equal(host.copies.length, 0);
        assert.equal(host.notifications.length, 1);
        assert.equal(host.notifications[0].options.type, 'error');
        assert.equal(button.getAttribute('aria-disabled'), 'false');
    } finally {
        host.dom.window.close();
    }
});

test('the complete row mounts after revision lookup and copy waits for clipboard success', async () => {
    let resolveRevision;
    const revision = new Promise((resolve) => {
        resolveRevision = resolve;
    });
    let resolveClipboard;
    const clipboard = new Promise((resolve) => {
        resolveClipboard = resolve;
    });
    const host = createHost({
        html: '<h1 id="firstHeading">Intel 1103</h1><div class="vector-body-before-content"></div><div id="mw-content-text"><h2 id="History">History</h2></div>',
        response: () => revision,
    });
    let attempts = 0;
    host.window.navigator.clipboard.writeText = async (text) => {
        attempts++;
        await clipboard;
        host.copies.push(text);
    };
    try {
        host.start();
        await settle();
        assert.equal(host.document.getElementById('kanade-rev-copy-row'), null);
        assert.equal(
            host.document.querySelectorAll('.kanade-rev-copy-section-control')
                .length,
            0,
        );
        host.fireContent();
        host.fireContent();
        host.start();
        await settle();
        assert.equal(host.requests.length, 1);
        assert.equal(host.document.getElementById('kanade-rev-copy-row'), null);
        assert.equal(attempts, 0);
        assert.deepEqual(host.notifications, []);
        resolveRevision({
            query: {
                pages: [
                    {
                        revisions: [
                            { revid: 123, timestamp: '2026-09-05T12:00:26Z' },
                        ],
                    },
                ],
            },
        });
        await settle();
        assert.equal(
            host.document.querySelectorAll('#kanade-rev-copy-row').length,
            1,
        );
        assert.equal(
            host.document.querySelector('.kanade-rev-copy-page').textContent,
            '[[:Intel 1103]]',
        );
        assert.equal(
            host.document.querySelector('.kanade-rev-copy-revision').hidden,
            false,
        );
        assert.equal(
            host.document.querySelector('.kanade-rev-copy-permalink')
                .textContent,
            '[[:Special:PermaLink/123|2026年9月5日 12:00:26]]',
        );
        assert.equal(
            host.document.querySelectorAll('.kanade-rev-copy-section-control')
                .length,
            2,
        );
        const copy = host.document.querySelector(
            '[data-kanade-rev-copy-action="copy"]',
        );
        copy.click();
        copy.click();
        assert.equal(attempts, 1);
        assert.equal(copy.getAttribute('aria-disabled'), 'true');
        assert.deepEqual(host.notifications, []);
        resolveClipboard();
        await settle();
        assert.deepEqual(host.copies, [
            '[[:Intel 1103]] ([[:Special:PermaLink/123|2026年9月5日 12:00:26]])',
        ]);
        assert.equal(host.notifications.length, 1);
        assert.equal(copy.getAttribute('aria-disabled'), 'false');
        copy.click();
        await settle();
        assert.equal(
            host.copies[1],
            '[[:Intel 1103]] ([[:Special:PermaLink/123|2026年9月5日 12:00:26]])',
        );
    } finally {
        host.dom.window.close();
    }
});

test('a delayed revision failure mounts the usable page-only row once', async () => {
    let rejectRevision;
    const revision = new Promise((_resolve, reject) => {
        rejectRevision = reject;
    });
    const host = createHost({ response: () => revision });
    try {
        host.start();
        await settle();
        assert.equal(host.document.getElementById('kanade-rev-copy-row'), null);
        host.fireContent();
        await settle();
        assert.equal(host.requests.length, 1);
        assert.equal(host.document.getElementById('kanade-rev-copy-row'), null);
        rejectRevision(new Error('The revision API is unavailable.'));
        await settle();
        const row = host.document.getElementById('kanade-rev-copy-row');
        assert.ok(row);
        assert.equal(
            row.querySelector('.kanade-rev-copy-revision').hidden,
            true,
        );
        assert.equal(row.querySelectorAll('.kanade-rev-copy-action').length, 2);
        const copy = row.querySelector('[data-kanade-rev-copy-action="copy"]');
        assert.equal(copy.getAttribute('aria-disabled'), 'false');
        copy.click();
        await settle();
        assert.deepEqual(host.copies, ['[[:Intel 1103]]']);
        host.fireContent();
        await settle();
        assert.equal(host.document.getElementById('kanade-rev-copy-row'), row);
        assert.equal(host.requests.length, 1);
    } finally {
        host.dom.window.close();
    }
});

for (const hookBeforeResolution of [false, true]) {
    test(`same-page content replacement reuses revision metadata resolved ${hookBeforeResolution ? 'after' : 'before'} its content hook`, async () => {
        let resolveRevision;
        const revision = new Promise((resolve) => {
            resolveRevision = resolve;
        });
        const host = createHost({
            html: '<h1 id="firstHeading">Intel 1103</h1><div class="vector-body-before-content"></div><div id="mw-content-text"><h2 id="History">History</h2></div>',
            response: () => revision,
        });
        const response = (timestamp) => ({
            query: {
                pages: [{ revisions: [{ revid: 123, timestamp }] }],
            },
        });
        try {
            host.start();
            await settle();
            const content = host.document.getElementById('mw-content-text');
            content.replaceWith(content.cloneNode(true));
            if (hookBeforeResolution) host.fireContent();
            await settle();
            assert.equal(
                host.document.getElementById('kanade-rev-copy-row'),
                null,
            );
            assert.equal(host.requests.length, 1);
            resolveRevision(response('2026-09-05T12:00:26Z'));
            await settle();
            if (!hookBeforeResolution) {
                assert.equal(
                    host.document.getElementById('kanade-rev-copy-row'),
                    null,
                );
                assert.equal(
                    host.document.querySelectorAll(
                        '.kanade-rev-copy-section-control',
                    ).length,
                    0,
                );
            }
            host.fireContent();
            host.fireContent();
            await settle();
            assert.equal(host.requests.length, 1);
            assert.equal(
                host.document.querySelectorAll('#kanade-rev-copy-row').length,
                1,
            );
            assert.equal(
                host.document.querySelector('.kanade-rev-copy-permalink')
                    .textContent,
                '[[:Special:PermaLink/123|2026年9月5日 12:00:26]]',
            );
            assert.equal(
                host.document.querySelectorAll(
                    '.kanade-rev-copy-section-control',
                ).length,
                2,
            );
            host.document
                .querySelector('[data-kanade-rev-copy-action="copy"]')
                .click();
            await settle();
            assert.deepEqual(host.copies, [
                '[[:Intel 1103]] ([[:Special:PermaLink/123|2026年9月5日 12:00:26]])',
            ]);
        } finally {
            host.dom.window.close();
        }
    });
}

test('revision failure keeps page copy and hides the unavailable revision', async () => {
    const host = createHost({
        response: (_params, count) =>
            count === 1
                ? { query: { pages: [] } }
                : {
                      query: {
                          pages: [
                              {
                                  revisions: [
                                      {
                                          revid: 123,
                                          timestamp: '2026-03-07T16:05:03Z',
                                      },
                                  ],
                              },
                          ],
                      },
                  },
    });
    try {
        host.start();
        await settle();
        assert.equal(
            host.document
                .querySelector('[data-kanade-rev-copy-action="copy"]')
                .getAttribute('aria-disabled'),
            'false',
        );
        assert.equal(
            host.document.querySelector('.kanade-rev-copy-revision').hidden,
            true,
        );
        assert.equal(
            host.document.querySelectorAll('.kanade-rev-copy-action').length,
            2,
        );
        host.document
            .querySelector('[data-kanade-rev-copy-action="copy"]')
            .click();
        await settle();
        assert.equal(host.requests.length, 1);
        assert.equal(host.copies[0], '[[:Intel 1103]]');
    } finally {
        host.dom.window.close();
    }
});

test('a mismatched returned revision is rejected', async () => {
    const host = createHost({
        response: () => ({
            query: {
                pages: [
                    {
                        revisions: [
                            { revid: 999, timestamp: '2026-03-07T16:05:03Z' },
                        ],
                    },
                ],
            },
        }),
    });
    try {
        host.start();
        await settle();
        assert.equal(
            host.document
                .querySelector('[data-kanade-rev-copy-action="copy"]')
                .getAttribute('aria-disabled'),
            'false',
        );
        assert.equal(
            host.document.querySelector('.kanade-rev-copy-revision').hidden,
            true,
        );
    } finally {
        host.dom.window.close();
    }
});

test('content replacement discards an old revision lookup that completes later', async () => {
    let resolveOld;
    const oldResponse = new Promise((resolve) => {
        resolveOld = resolve;
    });
    const host = createHost({
        response: ({ revids }) =>
            revids === 123
                ? oldResponse
                : {
                      query: {
                          pages: [
                              {
                                  revisions: [
                                      {
                                          revid: revids,
                                          timestamp: '2026-03-07T16:05:03Z',
                                      },
                                  ],
                              },
                          ],
                      },
                  },
    });
    try {
        host.start();
        await settle();
        host.values.wgRevisionId = 456;
        host.values.wgPageName = 'New_article';
        host.fireContent();
        await settle();
        resolveOld({
            query: {
                pages: [
                    {
                        revisions: [
                            { revid: 123, timestamp: '2001-01-01T00:00:00Z' },
                        ],
                    },
                ],
            },
        });
        await settle();
        assert.equal(
            host.document.querySelectorAll('#kanade-rev-copy-row').length,
            1,
        );
        assert.equal(
            host.document.querySelector('.kanade-rev-copy-page').textContent,
            '[[:New article]]',
        );
        host.document
            .querySelector('[data-kanade-rev-copy-action="copy"]')
            .click();
        await settle();
        assert.equal(
            host.copies[0],
            '[[:New article]] ([[:Special:PermaLink/456|2026年3月7日 16:05:03]])',
        );
    } finally {
        host.dom.window.close();
    }
});
