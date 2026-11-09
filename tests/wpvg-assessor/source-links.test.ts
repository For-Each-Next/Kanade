/**
 * @file tests/wpvg-assessor/source-links.test.ts
 * Purpose: Verify assessment-list identity and safe destination URL marking.
 * Contents: Supported sources, view routes, exclusions, and query preservation.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getAssessorDestinationHref,
    getAssessorSourceKind,
    isAssessorExternalSource,
} from '../../src/wpvg-assessor/domain/source-links.ts';

const LIST = 'https://zh.wikipedia.org/wiki/WikiProject:电子游戏/新进条目';

test('recognizes both PetScan hosts and localized project list routes only', () => {
    for (const origin of [
        'https://petscan.toolforge.org',
        'https://petscan.wmcloud.org',
    ]) {
        for (const path of ['/', '/index.php?psid=12']) {
            assert.equal(getAssessorSourceKind(origin + path), 'petscan');
            assert.equal(isAssessorExternalSource(origin + path), true);
        }
        assert.equal(getAssessorSourceKind(`${origin}/other`), null);
    }
    for (const page of [
        LIST,
        'https://zh.wikipedia.org/zh-tw/維基專題:電子遊戲/新進條目',
        'https://zh.wikipedia.org/w/index.php?title=PJ:电子游戏/新进条目&oldid=12',
    ]) {
        assert.equal(getAssessorSourceKind(page), 'wiki');
        assert.equal(isAssessorExternalSource(page), false);
    }
    for (const page of [
        'https://en.wikipedia.org/wiki/WikiProject:电子游戏/新进条目',
        'https://zh.wikipedia.org/wiki/User:电子游戏/新进条目',
        `${LIST}/2025`,
        'https://petscan.toolforge.org.example.test/',
        'http://petscan.toolforge.org/',
        'not a URL',
    ]) {
        assert.equal(getAssessorSourceKind(page), null);
    }
});

test('marks current article and talk views without changing targets or encodings', () => {
    for (const path of [
        '/wiki/Game',
        '/zh/Game',
        '/zh-hant/Game',
        '/zh-cn/Game',
        '/wiki/Star_Trek:_Voyager',
        '/wiki/Talk:Game',
        '/wiki/討論:Game',
        '/w/index.php?title=Game',
    ]) {
        const actual = getAssessorDestinationHref(path, LIST);
        assert.ok(actual);
        const url = new URL(actual);
        assert.equal(url.searchParams.get('wpvg-assessor'), '1');
        assert.equal(url.pathname, new URL(path, LIST).pathname);
        assert.equal(getAssessorDestinationHref(actual, LIST), actual);
    }
    assert.equal(
        getAssessorDestinationHref(
            '/wiki/Game?foo=a%20b&bar=%2f#History',
            LIST,
        ),
        'https://zh.wikipedia.org/wiki/Game?foo=a%20b&bar=%2f&wpvg-assessor=1#History',
    );
    assert.equal(
        getAssessorDestinationHref(
            '/wiki/Game?foo=%2f&wpvg-assessor=0&wpvg%2Dassessor=2&bar=a+b',
            LIST,
        ),
        'https://zh.wikipedia.org/wiki/Game?foo=%2f&bar=a+b&wpvg-assessor=1',
    );
});

test('ignores unsafe hosts, non-view actions, revisions, namespaces, and local fragments', () => {
    for (const href of [
        null,
        '',
        '#History',
        `${LIST}#History`,
        'javascript:alert(1)',
        'https://user:pass@zh.wikipedia.org/wiki/Game',
        'https://zh.wikipedia.org.example.test/wiki/Game',
        'https://en.wikipedia.org/wiki/Game',
        'http://zh.wikipedia.org/wiki/Game',
        '/wiki/Game?oldid=1',
        '/wiki/Game?diff=2',
        '/wiki/Game?curid=2',
        '/wiki/Game?redlink=1',
        '/wiki/Game?veaction=edit',
        '/wiki/Game?action=view&action=edit',
        '/wiki/Game?title=Other',
        '/w/index.php?title=Game&title=Other',
        '/w/index.php?oldid=2',
        '/wiki/Special:RecentChanges',
        '/wiki/User:Game',
        '/wiki/模板:Game',
        '/wiki/Category:Game',
        '/wiki/File:Game',
        '/wiki/%00Game',
        '/wiki/%E0%A4%A',
        '/wiki/%5BGame%5D',
    ]) {
        assert.equal(
            getAssessorDestinationHref(href, LIST),
            null,
            String(href),
        );
    }
    assert.ok(getAssessorDestinationHref('/wiki/Game?action=view', LIST));
});
