/**
 * @file tests/build/capture-request.test.mjs
 * Purpose: Verify live screenshot requests cannot submit wiki writes.
 * Contents: Real request shapes for read APIs, native forms, and REST writes.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { isWikiWriteRequest } from '../../scripts/capture-request.mjs';

function request(
    path,
    method = 'GET',
    body = null,
    contentType = 'application/x-www-form-urlencoded',
) {
    return {
        url: () => `https://en.wikipedia.org${path}`,
        method: () => method,
        postData: () => body,
        headers: () => ({ 'content-type': contentType }),
    };
}

test('permits real read APIs and native assets without replacing responses', () => {
    for (const action of [
        'query',
        'parse',
        'languagesearch',
        'opensearch',
        'wbgetentities',
        'wbsearchentities',
    ]) {
        assert.equal(
            isWikiWriteRequest(request(`/w/api.php?action=${action}`)),
            false,
        );
        assert.equal(
            isWikiWriteRequest(
                request('/w/api.php', 'POST', `action=${action}&format=json`),
            ),
            false,
        );
    }
    assert.equal(isWikiWriteRequest(request('/w/api.php')), false);
    assert.equal(
        isWikiWriteRequest(request('/w/load.php?modules=mediawiki.util')),
        false,
    );
    assert.equal(
        isWikiWriteRequest(request('/api/rest_v1/page/summary/Eternal_Sonata')),
        false,
    );
    assert.equal(
        isWikiWriteRequest(request('/w/rest.php/v1/page/Eternal_Sonata/html')),
        false,
    );
});

test('blocks native, Action API, and multipart wiki saves', () => {
    for (const action of ['edit', 'move', 'delete', 'wbsetlabel']) {
        assert.equal(
            isWikiWriteRequest(request(`/w/api.php?action=${action}`)),
            true,
        );
        assert.equal(
            isWikiWriteRequest(
                request('/w/api.php', 'POST', `action=${action}&token=example`),
            ),
            true,
        );
    }
    assert.equal(
        isWikiWriteRequest(
            request('/w/index.php', 'POST', 'wpSave=Save&wpTextbox1=Text'),
        ),
        true,
    );
    assert.equal(
        isWikiWriteRequest(request('/w/index.php?action=submit', 'POST')),
        true,
    );
    assert.equal(
        isWikiWriteRequest(
            request(
                '/w/api.php',
                'POST',
                '--boundary\r\nContent-Disposition: form-data; name="action"\r\n\r\nedit\r\n--boundary--',
            ),
        ),
        true,
    );
    assert.equal(isWikiWriteRequest(request('/w/api.php', 'POST')), true);
});

test('rejects duplicated, conflicting, and PHP-normalized dispatch parameters before granting a read', () => {
    for (const [path, body] of [
        ['/w/api.php', 'action=query&action=edit'],
        ['/w/api.php', 'action=query&action=query'],
        ['/w/api.php?action=query&action=edit', 'title=Example'],
        ['/w/api.php?action=query', 'action=edit'],
        ['/w/api.php?action=edit', 'action=query'],
        ['/w/api.php', 'action=query&+action=edit'],
        ['/w/api.php', 'action=query&action%00=edit'],
        ['/w/api.php?action=query&action%00=edit', 'title=Example'],
        ['/w/index.php?action=submit&action=delete', 'wpPreview=Show'],
        ['/w/index.php?action=submit&+action=delete', 'wpPreview=Show'],
        ['/w/index.php?action=submit', 'wpPreview=Show&wpPreview[]=shadow'],
        ['/w/index.php?action=submit', 'wpDiff=Show&wpDiff[]=shadow'],
        ['/w/index.php?action=submit', 'wpPreview=Show&wpPreview=Duplicate'],
        ['/w/index.php?action=submit', 'wpPreview=Show&action%00=delete'],
    ]) {
        assert.equal(
            isWikiWriteRequest(request(path, 'POST', body)),
            true,
            `${path}: ${body}`,
        );
    }
    assert.equal(
        isWikiWriteRequest(
            request('/w/api.php?action=query', 'POST', 'action=query'),
        ),
        false,
    );
});

test('permits explicit native preview and diff requests while blocking ambiguous saves', () => {
    for (const button of ['wpPreview', 'wpDiff']) {
        assert.equal(
            isWikiWriteRequest(
                request(
                    '/w/index.php?action=submit',
                    'POST',
                    `${button}=Show&wpTextbox1=Draft`,
                ),
            ),
            false,
        );
        assert.equal(
            isWikiWriteRequest(
                request(
                    '/w/index.php?action=submit',
                    'POST',
                    `${button}=Show&wpSave=Save`,
                ),
            ),
            true,
        );
    }
    assert.equal(
        isWikiWriteRequest(
            request(
                '/w/index.php?action=submit',
                'POST',
                'wpPreview=Show',
                'multipart/form-data',
            ),
        ),
        true,
    );
    const multipart = (fields) =>
        fields
            .map(
                ([name, value]) =>
                    `--native-preview\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
            )
            .join('') + '--native-preview--\r\n';
    const previewFields = [
        ['wpTextbox1', 'Text containing name="wpSave"'],
        ['wpPreview', 'Show preview'],
    ];
    assert.equal(
        isWikiWriteRequest(
            request(
                '/w/index.php?action=submit',
                'POST',
                multipart(previewFields),
                'multipart/form-data; boundary=native-preview',
            ),
        ),
        false,
    );
    for (const extra of [
        ['wpSave', 'Save'],
        ['wpPreview', 'Duplicate'],
        ['action', 'delete'],
        ['wpPreview[]', 'shadow'],
        [' action', 'delete'],
        ['action\u0000', 'delete'],
    ])
        assert.equal(
            isWikiWriteRequest(
                request(
                    '/w/index.php?action=submit',
                    'POST',
                    multipart([...previewFields, extra]),
                    'multipart/form-data; boundary=native-preview',
                ),
            ),
            true,
        );
    assert.equal(
        isWikiWriteRequest(
            request('/w/index.php?action=delete', 'POST', 'wpPreview=Show'),
        ),
        true,
    );
});

test('blocks REST page writes and permits ordinary telemetry', () => {
    assert.equal(
        isWikiWriteRequest(
            request(
                '/w/rest.php/confirmedit/v0/hcaptcha/blocktoken',
                'POST',
                '{}',
                'application/json',
            ),
        ),
        false,
    );
    assert.equal(
        isWikiWriteRequest(
            request(
                '/w/rest.php/confirmedit/v0/hcaptcha/blocktoken/other',
                'POST',
                '{}',
                'application/json',
            ),
        ),
        true,
    );
    assert.equal(
        isWikiWriteRequest(
            request(
                '/w/api.php?action=query',
                'POST',
                'multipart body',
                'multipart/form-data; boundary=example',
            ),
        ),
        true,
    );
    assert.equal(
        isWikiWriteRequest(
            request(
                '/w/api.php?action=query',
                'POST',
                '{"action":"edit"}',
                'application/json',
            ),
        ),
        true,
    );
    assert.equal(
        isWikiWriteRequest(
            request('/w/rest.php/v1/page', 'POST', '{"source":"Text"}'),
        ),
        true,
    );
    assert.equal(
        isWikiWriteRequest(
            request('/api/rest_v1/page/title/Text', 'POST', '{}'),
        ),
        true,
    );
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
        assert.equal(
            isWikiWriteRequest(request('/w/rest.php/v1/page/Text', method)),
            true,
        );
    }
    assert.equal(
        isWikiWriteRequest(request('/beacon/event', 'POST', '{}')),
        false,
    );
});
