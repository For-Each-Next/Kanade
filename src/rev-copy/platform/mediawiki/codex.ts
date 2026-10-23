/**
 * @file src/rev-copy/platform/mediawiki/codex.ts
 * Purpose: Load MediaWiki's Vue and Codex runtime only when advanced copy is opened.
 *
 * Contents: Minimal host contracts and lazy ResourceLoader adapter.
 */

import type { CodexRuntime } from '../../app/contracts/advanced-copy.ts';
import { loadHostModules } from '../../../library/mediawiki-runtime/modules.ts';

export async function loadCodex(): Promise<CodexRuntime> {
    const require = await loadHostModules(mw.loader, [
        'vue',
        '@wikimedia/codex',
    ]);
    const vue = require('vue') as Omit<CodexRuntime, 'components'>;
    const components = require('@wikimedia/codex') as Record<string, unknown>;
    for (const name of [
        'CdxDialog',
        'CdxField',
        'CdxToggleButtonGroup',
        'CdxRadio',
        'CdxCheckbox',
        'CdxTextInput',
        'CdxTextArea',
        'CdxMessage',
        'CdxProgressBar',
    ]) {
        if (!components[name])
            throw new Error(`Codex component missing: ${name}`);
    }
    if (!vue.h || !vue.render || !vue.nextTick) {
        throw new Error('MediaWiki Vue runtime is unavailable.');
    }
    return { ...vue, components };
}
