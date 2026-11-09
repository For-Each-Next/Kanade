/**
 * @file tests/wpvg-assessor/assessment-summary.test.ts
 * Purpose: English assessment summaries preserve localized controls and source values.
 *
 * Table of contents:
 * 1. Imports
 * 2. Locale and assessment fixtures
 * 3. Test scenarios
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultAssessment } from '../../src/wpvg-assessor/domain/assessment.ts';
import projectConfig from '../../src/wpvg-assessor/domain/project-config.ts';
import { NOT_VIDEO_GAME_IMPORTANCE } from '../../src/wpvg-assessor/domain/types.ts';

const originalMw = Reflect.get(globalThis, 'mw');
Reflect.set(globalThis, 'mw', {
    config: { get: () => 'zh-TW' },
});
const { buildEditSummary } =
    await import('../../src/wpvg-assessor/features/assessment/assessment-summary.ts');
const {
    IMPORTANCE_OPTIONS,
    KNOWN_CLASS_OPTIONS,
    MAINTENANCE_OPTIONS,
    OTHER_PROJECT_OPTIONS,
    TASK_FORCE_OPTIONS,
} =
    await import('../../src/wpvg-assessor/features/assessment/assessment-options.ts');
if (originalMw === undefined) {
    Reflect.deleteProperty(globalThis, 'mw');
} else {
    Reflect.set(globalThis, 'mw', originalMw);
}

const sourceLink =
    '[[:m:User:For Each ... Next/global.js/vg page assessor.js|🍄]]';

test('all configured summary labels stay English in a Traditional Chinese interface', () => {
    const assessment = createDefaultAssessment(projectConfig);
    assessment.className = 'FA';
    assessment.importance = 'Top';
    for (const option of OTHER_PROJECT_OPTIONS) {
        assessment.otherProjects[option.id] = true;
    }
    for (const option of TASK_FORCE_OPTIONS) {
        assessment.taskForces[option.id] = true;
    }
    assessment.maintenance = {
        cover: true,
        needsInfobox: true,
        reassess: true,
        screenshot: true,
    };

    assert.equal(
        buildEditSummary(assessment),
        'Tag project banners (FA): Video games (Top; ' +
            'Pokemon, Minecraft, Square Enix, Sega, Nintendo, miHoYo; ' +
            'Reassess, Needs infobox, Needs cover/image, Needs screenshot), ' +
            'Fictional Characters, ACG, Biography, Company, Films, Music ' +
            sourceLink,
    );
    assert.equal(
        KNOWN_CLASS_OPTIONS.find((option) => option.value === 'FA')?.label,
        '典範',
    );
    assert.equal(
        IMPORTANCE_OPTIONS.find((option) => option.value === 'Top')?.label,
        '極高',
    );
    assert.equal(TASK_FORCE_OPTIONS[0]?.label, '寶可夢');
    assert.equal(OTHER_PROJECT_OPTIONS[0]?.label, '虛構角色');
    assert.equal(MAINTENANCE_OPTIONS[0]?.label, '重新評級');
});

test('summary translates supplied known project labels and preserves unknown source names and values', () => {
    const assessment = createDefaultAssessment(projectConfig);
    assessment.className = '未來等級';
    assessment.importance = '來源重要度';
    assessment.otherProjects.biography = true;
    assessment.otherProjects['existing:來源專題'] = true;

    assert.equal(
        buildEditSummary(assessment, [
            { id: 'biography', label: '傳記' },
            { id: 'existing:來源專題', label: '來源專題' },
        ]),
        'Tag project banners (未來等級): ' +
            'Video games (來源重要度), Biography, 來源專題 ' +
            sourceLink,
    );
});

test('out-of-scope shared assessment and actual banner removal stay English', () => {
    const source = '{{WikiProject Video games|class=Start|importance=Low}}';
    const assessment = createDefaultAssessment(projectConfig, source);
    assessment.className = 'B';
    assessment.importance = NOT_VIDEO_GAME_IMPORTANCE;
    assessment.otherProjects.biography = true;

    assert.equal(
        buildEditSummary(assessment, undefined, source),
        'Update assessment: Start→B; remove Video games banner; add Biography ' +
            sourceLink,
    );
    assert.equal(
        buildEditSummary(assessment, undefined, ''),
        `Update shared assessment (B): Biography ${sourceLink}`,
    );
});

test('summaries describe changed values and flags without repeating unchanged selections', () => {
    const source =
        '{{WPVG|class=Start|importance=Low|Nintendo=yes|reassess=yes}}';
    const assessment = createDefaultAssessment(projectConfig, source);
    assessment.className = 'B';
    assessment.importance = 'High';
    assessment.maintenance.reassess = false;
    assessment.maintenance.cover = true;
    assert.equal(
        buildEditSummary(assessment, undefined, source),
        `Update assessment: Start→B; Video games (Low→High; remove Reassess; add Needs cover/image) ${sourceLink}`,
    );
    assert.equal(
        buildEditSummary(
            createDefaultAssessment(projectConfig, source),
            undefined,
            source,
        ),
        `Update assessment ${sourceLink}`,
    );
});

test('summaries retain removed unknown project names and omit an invented previous class', () => {
    const source = '{{WPBS|1={{WPVG|importance=Low}}{{WikiProject 來源專題}}}}';
    const assessment = createDefaultAssessment(projectConfig, source);
    assessment.className = 'C';
    assessment.otherProjects['existing:wikiproject 來源專題'] = false;
    assert.equal(
        buildEditSummary(assessment, undefined, source),
        `Update assessment: C; remove 來源專題 ${sourceLink}`,
    );
});

test('adding a VG banner reports only the added assessment and preserves the source marker once', () => {
    const source = '{{WPBS|class=B|1={{WikiProject Biography}}}}';
    const assessment = createDefaultAssessment(projectConfig, source);
    assessment.importance = 'Mid';
    assert.equal(
        buildEditSummary(assessment, undefined, source),
        `Update assessment: add Video games (Mid) ${sourceLink}`,
    );
});
