/** @file stylelint.config.mjs
 * Purpose: Share CSS validation across the tool collection.
 */
export default {
    extends: ['stylelint-config-recommended'],
    rules: {
        'declaration-property-value-keyword-no-deprecated': null,
        'no-descending-specificity': null,
    },
};
