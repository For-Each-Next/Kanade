/**
 * @file src/source-editor/platform/browser/regex-replacement.ts
 * Purpose: Run untrusted regular expressions in a disposable, time-limited worker.
 * Contents: Task contract and worker lifecycle.
 */

import {
    executeRegexReplacement,
    type RegexReplacementDraft,
    type RegexReplacementResult,
    type RegexReplacementTask,
} from '../../domain/regex-replacement.ts';

export function startRegexReplacement(
    request: RegexReplacementDraft & { source: string },
): RegexReplacementTask {
    let finish: (result: RegexReplacementResult) => void = () => undefined;
    const result = new Promise<RegexReplacementResult>((resolve) => {
        finish = resolve;
    });
    let worker: Worker | undefined;
    let workerUrl: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    function complete(value: RegexReplacementResult): void {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker?.terminate();
        if (workerUrl) URL.revokeObjectURL(workerUrl);
        finish(value);
    }
    try {
        const script = `onmessage = function(event) { postMessage((${executeRegexReplacement.toString()})(event.data)); };`;
        workerUrl = URL.createObjectURL(
            new Blob([script], { type: 'text/javascript' }),
        );
        worker = new Worker(workerUrl);
        worker.onmessage = (
            event: MessageEvent<RegexReplacementResult>,
        ): void => {
            complete(event.data);
        };
        worker.onerror = (): void =>
            complete({ ok: false, error: 'unavailable' });
        worker.onmessageerror = (): void =>
            complete({ ok: false, error: 'unavailable' });
        timer = setTimeout(
            () => complete({ ok: false, error: 'timeout' }),
            1500,
        );
        worker.postMessage(request);
    } catch {
        complete({ ok: false, error: 'unavailable' });
    }
    return {
        result,
        cancel: () => complete({ ok: false, error: 'cancelled' }),
    };
}
