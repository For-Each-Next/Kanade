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
        'Tag project banners (FA-Class): Video games (Top-importance; ' +
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
        'Tag project banners (未來等級-Class): ' +
            'Video games (來源重要度-importance), Biography, 來源專題 ' +
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
        'Update shared assessment (B-Class): Biography; ' +
            'remove Video games banner ' +
            sourceLink,
    );
    assert.equal(
        buildEditSummary(assessment, undefined, ''),
        `Update shared assessment (B-Class): Biography ${sourceLink}`,
    );
});
