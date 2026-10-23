<!--
@file src/vg-stub-creator/features/creator/dialogs/main-dialog.vue
Purpose: Displays article fields, selectable metadata item rows, and related page controls.

Table of contents:
1. Template
-->

<template>
    <cdx-dialog
        class="kanade-vg-stub-creator-dialog"
        :class="{
            'kanade-vg-stub-creator-dialog--link-modifier':
                linkNavigationModifier,
        }"
        :lang="interfaceLocale"
        :title="getDialogTitle()"
        v-model:open="open"
        @update:open="!$event &amp;&amp; closeDialog()"
    >
        <div
            class="kanade-vg-stub-creator-dialog-body"
            @pointerenter="updateLinkNavigationModifier($event)"
            @pointermove="updateLinkNavigationModifier($event)"
            @pointerleave="resetLinkNavigationModifier"
            :aria-busy="previewLoading"
            v-bind:class="{
                'kanade-vg-stub-creator-dialog-body--masked': previewLoading,
            }"
        >
            <cdx-tabs v-model:active="activeTab">
                <cdx-tab
                    v-bind:key="group.key"
                    v-bind:label="group.label"
                    v-bind:name="group.key"
                    v-for="group in groups"
                >
                    <template v-if="group.nameGroupKey">
                        <section
                            class="kanade-vg-stub-creator-name-lookup-group"
                            :aria-label="msg('names.lookupGroup')"
                        >
                            <cdx-field
                                class="kanade-vg-stub-creator-name-detail-field"
                            >
                                <div
                                    class="kanade-vg-stub-creator-steam-helper"
                                >
                                    <div
                                        class="kanade-vg-stub-creator-steam-row"
                                    >
                                        <cdx-text-input
                                            :aria-label="
                                                msg('names.steamHelper')
                                            "
                                            placeholder="https://store.steampowered.com/app/..."
                                            v-bind:model-value="steamUrl"
                                            v-on:update:model-value="
                                                updateSteamUrl($event)
                                            "
                                        ></cdx-text-input>
                                        <cdx-button
                                            type="button"
                                            @click="addSteamNames"
                                            :disabled="sourceFetchState.loading"
                                        >
                                            {{ msg('names.check') }}
                                        </cdx-button>
                                    </div>
                                    <div
                                        class="kanade-vg-stub-creator-steam-row kanade-vg-stub-creator-steam-row--suggestions"
                                        v-if="fetchedSteamNameRows.length"
                                    >
                                        <ul
                                            class="kanade-vg-stub-creator-steam-suggestion kanade-vg-stub-creator-steam-links"
                                        >
                                            <li
                                                v-bind:key="suggestion.label"
                                                v-for="suggestion in getSteamNameSuggestions(
                                                    fetchedSteamNameRows,
                                                )"
                                            >
                                                <strong>
                                                    {{ suggestion.label }}
                                                </strong>
                                                <a
                                                    class="kanade-vg-stub-creator-external-link"
                                                    v-bind:href="suggestion.url"
                                                    rel="noopener noreferrer"
                                                    target="_blank"
                                                >
                                                    {{ suggestion.value }}
                                                    <cdx-icon
                                                        aria-hidden="true"
                                                        class="kanade-vg-stub-creator-external-link-icon"
                                                        :icon="externalLinkIcon"
                                                        size="x-small"
                                                    ></cdx-icon>
                                                </a>
                                            </li>
                                        </ul>
                                        <cdx-button-group
                                            class="kanade-vg-stub-creator-steam-actions"
                                            v-bind:buttons="steamNameButtons"
                                            v-on:click="applySteamNameChoice"
                                        ></cdx-button-group>
                                    </div>
                                </div>
                                <template v-slot:label>
                                    {{ msg('names.steamHelper') }}
                                </template>
                            </cdx-field>
                            <cdx-field
                                v-if="getNameSearchRows().length &gt; 0"
                                class="kanade-vg-stub-creator-name-detail-field"
                            >
                                <ul class="kanade-vg-stub-creator-name-search">
                                    <li
                                        v-bind:key="row.key"
                                        v-for="row in getNameSearchRows()"
                                    >
                                        <template
                                            v-for="part in msgParts(
                                                'names.searchSentence',
                                                {
                                                    query: '__vg_query_part__',
                                                    links: '__vg_links_part__',
                                                },
                                            )"
                                        >
                                            <strong
                                                v-if="
                                                    part === '__vg_query_part__'
                                                "
                                            >
                                                {{ row.query }}
                                            </strong>
                                            <span
                                                class="kanade-vg-stub-creator-horizontal-list"
                                                v-else-if="
                                                    part === '__vg_links_part__'
                                                "
                                            >
                                                <span
                                                    class="kanade-vg-stub-creator-horizontal-list-item"
                                                    v-bind:key="link.label"
                                                    v-for="link in row.links"
                                                >
                                                    <a
                                                        class="kanade-vg-stub-creator-external-link"
                                                        v-bind:href="link.url"
                                                        rel="noopener noreferrer"
                                                        target="_blank"
                                                    >
                                                        {{ link.label }}
                                                        <cdx-icon
                                                            aria-hidden="true"
                                                            class="kanade-vg-stub-creator-external-link-icon"
                                                            :icon="
                                                                externalLinkIcon
                                                            "
                                                            size="x-small"
                                                        ></cdx-icon>
                                                    </a>
                                                </span>
                                            </span>
                                            <template v-else>{{
                                                part
                                            }}</template>
                                        </template>
                                    </li>
                                </ul>
                                <template v-slot:label>
                                    {{ msg('names.googleLookup') }}
                                </template>
                            </cdx-field>
                        </section>
                        <div class="kanade-vg-stub-creator-name-fields">
                            <cdx-field
                                v-for="card in getNameCards()"
                                :key="card.id"
                                class="kanade-vg-stub-creator-name-card"
                                is-fieldset
                                :data-kanade-vg-stub-creator-name-card="card.id"
                                :data-kanade-vg-stub-creator-name-source="
                                    card.id
                                "
                                :data-kanade-vg-stub-creator-name-kind="
                                    card.kind
                                "
                                :data-kanade-vg-stub-creator-name-index="
                                    card.index
                                "
                                :data-kanade-vg-stub-creator-field="
                                    card.kind === 'localized'
                                        ? undefined
                                        : card.kind === 'original'
                                          ? 'originalName'
                                          : 'englishName'
                                "
                            >
                                <div
                                    class="kanade-vg-stub-creator-name-source-row"
                                >
                                    <div
                                        class="kanade-vg-stub-creator-field-column"
                                    >
                                        <cdx-field
                                            class="kanade-vg-stub-creator-name-detail-field"
                                        >
                                            <cdx-text-input
                                                :aria-label="
                                                    card.kind === 'localized'
                                                        ? msg(
                                                              'names.localizedName',
                                                          ) +
                                                          ' ' +
                                                          (card.index + 1)
                                                        : card.kind ===
                                                            'original'
                                                          ? msg(
                                                                'titles.originalTitle',
                                                            )
                                                          : msg(
                                                                'titles.englishTitle',
                                                            )
                                                "
                                                :placeholder="
                                                    card.kind === 'localized'
                                                        ? msg('names.title')
                                                        : card.kind ===
                                                            'original'
                                                          ? msg(
                                                                'titles.originalTitlePlaceholder',
                                                            )
                                                          : msg(
                                                                'titles.localizedTitlePlaceholder',
                                                            )
                                                "
                                                :model-value="card.name"
                                                @update:model-value="
                                                    updateNameCardValue(
                                                        card,
                                                        'name',
                                                        $event,
                                                    )
                                                "
                                                @blur="
                                                    commitNameCard(card, 'name')
                                                "
                                                @keydown.enter.prevent="
                                                    commitNameCard(card, 'name')
                                                "
                                            ></cdx-text-input>
                                            <template #label>{{
                                                msg('names.nameField')
                                            }}</template>
                                        </cdx-field>
                                    </div>
                                    <div
                                        class="kanade-vg-stub-creator-field-column"
                                    >
                                        <cdx-field
                                            class="kanade-vg-stub-creator-name-detail-field"
                                            :data-kanade-vg-stub-creator-source-input="
                                                getNameSourceEntryKey(card)
                                            "
                                        >
                                            <cdx-text-input
                                                class="kanade-vg-stub-creator-source-url"
                                                :aria-label="
                                                    card.kind === 'localized'
                                                        ? msg(
                                                              'names.sourceUrls',
                                                          ) +
                                                          ' ' +
                                                          (card.index + 1)
                                                        : msg(
                                                              'form.sourceUrlsFor',
                                                              {
                                                                  field:
                                                                      card.kind ===
                                                                      'original'
                                                                          ? msg(
                                                                                'titles.originalTitle',
                                                                            )
                                                                          : msg(
                                                                                'titles.englishTitle',
                                                                            ),
                                                              },
                                                          )
                                                "
                                                :placeholder="
                                                    msg('names.sourceUrls')
                                                "
                                                :model-value="
                                                    sourceEntryValues[
                                                        getNameSourceEntryKey(
                                                            card,
                                                        )
                                                    ] || ''
                                                "
                                                @update:model-value="
                                                    updateSourceEntry(
                                                        getNameSourceEntryKey(
                                                            card,
                                                        ),
                                                        $event,
                                                    )
                                                "
                                                @paste="
                                                    pasteSourceEntry(
                                                        getNameSourceEntryKey(
                                                            card,
                                                        ),
                                                        $event,
                                                    )
                                                "
                                                @blur="
                                                    commitSourceEntry(
                                                        getNameSourceEntryKey(
                                                            card,
                                                        ),
                                                    )
                                                "
                                                @keydown.enter="
                                                    commitSourceEntry(
                                                        getNameSourceEntryKey(
                                                            card,
                                                        ),
                                                        $event,
                                                    )
                                                "
                                            ></cdx-text-input>
                                            <ul
                                                class="kanade-vg-stub-creator-source-list"
                                            >
                                                <li
                                                    v-for="url in getSourceUrls(
                                                        getNameSourceEntryKey(
                                                            card,
                                                        ),
                                                    )"
                                                    :key="url"
                                                    data-kanade-vg-stub-creator-source-url
                                                >
                                                    <a
                                                        :href="
                                                            getSourceUrlHref(
                                                                url,
                                                            )
                                                        "
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        >{{ url }}</a
                                                    >
                                                    <cdx-button
                                                        type="button"
                                                        weight="quiet"
                                                        :aria-label="
                                                            msg(
                                                                'form.removeReference',
                                                                { url },
                                                            )
                                                        "
                                                        @click="
                                                            removeSourceUrl(
                                                                getNameSourceEntryKey(
                                                                    card,
                                                                ),
                                                                url,
                                                                $event,
                                                            )
                                                        "
                                                        >{{
                                                            msg('common.remove')
                                                        }}</cdx-button
                                                    >
                                                </li>
                                            </ul>
                                            <template #label>{{
                                                msg('names.sourceField')
                                            }}</template>
                                        </cdx-field>
                                    </div>
                                </div>
                                <cdx-field
                                    v-if="card.kind === 'localized'"
                                    class="kanade-vg-stub-creator-name-properties"
                                    :is-fieldset="true"
                                >
                                    <div
                                        class="kanade-vg-stub-creator-name-settings-row"
                                    >
                                        <cdx-checkbox
                                            class="kanade-vg-stub-creator-name-official-checkbox"
                                            :model-value="
                                                form[group.nameGroupKey][
                                                    card.index
                                                ].official
                                            "
                                            @update:model-value="
                                                updateNameOfficial(
                                                    group.nameGroupKey,
                                                    card.index,
                                                    $event,
                                                )
                                            "
                                            >{{
                                                msg('names.official')
                                            }}</cdx-checkbox
                                        >
                                        <div
                                            class="kanade-vg-stub-creator-name-markets"
                                            role="group"
                                            :aria-label="msg('names.regions')"
                                        >
                                            <cdx-checkbox
                                                v-for="market in nameMarkets"
                                                :key="market.key"
                                                :model-value="
                                                    form[group.nameGroupKey][
                                                        card.index
                                                    ][market.key]
                                                "
                                                @update:model-value="
                                                    updateNameMarket(
                                                        group.nameGroupKey,
                                                        card.index,
                                                        market.key,
                                                        $event,
                                                    )
                                                "
                                                >{{
                                                    market.label
                                                }}</cdx-checkbox
                                            >
                                        </div>
                                        <span
                                            v-if="
                                                isSteamNameHelperRow(
                                                    form[group.nameGroupKey][
                                                        card.index
                                                    ],
                                                )
                                            "
                                            class="kanade-vg-stub-creator-name-provenance"
                                            >{{
                                                msg('names.bySteamHelper')
                                            }}</span
                                        >
                                    </div>
                                    <template #label>{{
                                        msg('names.properties')
                                    }}</template>
                                </cdx-field>
                                <cdx-button
                                    type="button"
                                    weight="quiet"
                                    class="kanade-vg-stub-creator-name-usage-row"
                                    data-kanade-vg-stub-creator-name-set-uses
                                    :aria-label="msg('names.uses')"
                                    :aria-expanded="isNameUsesExpanded(card)"
                                    :aria-controls="
                                        nameUsageIdPrefix +
                                        '-name-uses-' +
                                        card.id
                                    "
                                    :aria-describedby="
                                        nameUsageIdPrefix +
                                        '-name-usage-summary-' +
                                        card.id
                                    "
                                    @click="toggleNameUses(card)"
                                >
                                    <span
                                        class="kanade-vg-stub-creator-name-detail-label"
                                        >{{ msg('names.uses') }}</span
                                    >
                                    <span
                                        class="kanade-vg-stub-creator-name-usage-content"
                                    >
                                        <span
                                            class="kanade-vg-stub-creator-name-usage-chips"
                                        >
                                            <span
                                                v-for="chip in getNameUsageChips(
                                                    card,
                                                )"
                                                :key="chip.key"
                                                class="kanade-vg-stub-creator-name-usage-chip"
                                                :data-kanade-vg-stub-creator-name-use-chip="
                                                    chip.key
                                                "
                                                :title="chip.value"
                                                >{{ chip.label
                                                }}{{
                                                    chip.modified ? '*' : ''
                                                }}</span
                                            >
                                        </span>
                                        <span
                                            class="kanade-vg-stub-creator-name-usage-hint"
                                            >{{
                                                msg(
                                                    isNameUsesExpanded(card)
                                                        ? 'names.collapseUses'
                                                        : 'names.expandUses',
                                                )
                                            }}</span
                                        >
                                    </span>
                                </cdx-button>
                                <span
                                    class="kanade-vg-stub-creator-visually-hidden"
                                    :id="
                                        nameUsageIdPrefix +
                                        '-name-usage-summary-' +
                                        card.id
                                    "
                                    >{{
                                        getNameUsageChips(card)
                                            .map((chip) => chip.accessibleLabel)
                                            .join('; ')
                                    }}</span
                                >
                                <cdx-field
                                    v-if="isNameUsesExpanded(card)"
                                    class="kanade-vg-stub-creator-name-roles"
                                    :is-fieldset="true"
                                    data-kanade-vg-stub-creator-name-roles
                                    :id="
                                        nameUsageIdPrefix +
                                        '-name-uses-' +
                                        card.id
                                    "
                                >
                                    <template #label>{{
                                        msg('names.useThisName')
                                    }}</template>
                                    <div
                                        class="kanade-vg-stub-creator-name-roles-grid"
                                    >
                                        <div
                                            v-for="role in nameRoleOptions"
                                            :key="role.key"
                                            class="kanade-vg-stub-creator-name-role"
                                            :data-kanade-vg-stub-creator-name-role="
                                                role.key
                                            "
                                        >
                                            <div
                                                v-if="
                                                    role.key !== 'redirect' ||
                                                    isNameRoleRedirectVisible(
                                                        card,
                                                    )
                                                "
                                                class="kanade-vg-stub-creator-name-role-main"
                                                :data-kanade-vg-stub-creator-name-primary-redirect="
                                                    role.key === 'redirect'
                                                        ? getNameRolePageState(
                                                              card,
                                                              role.key,
                                                          ).title
                                                        : null
                                                "
                                            >
                                                <div
                                                    class="kanade-vg-stub-creator-name-role-control"
                                                >
                                                    <div
                                                        class="kanade-vg-stub-creator-name-role-choice"
                                                    >
                                                        <cdx-checkbox
                                                            :model-value="
                                                                role.key ===
                                                                'redirect'
                                                                    ? (getNameRoleRedirectReviewRow(
                                                                          card,
                                                                      )
                                                                          ?.enabled ??
                                                                      getNameRole(
                                                                          card,
                                                                          role.key,
                                                                      ).enabled)
                                                                    : getNameRole(
                                                                          card,
                                                                          role.key,
                                                                      ).enabled
                                                            "
                                                            @update:model-value="
                                                                role.key ===
                                                                'redirect'
                                                                    ? updateNamePrimaryRedirectEnabled(
                                                                          card,
                                                                          $event,
                                                                      )
                                                                    : updateNameRoleEnabled(
                                                                          card,
                                                                          role.key,
                                                                          $event,
                                                                      )
                                                            "
                                                            >{{
                                                                role.label
                                                            }}</cdx-checkbox
                                                        >
                                                        <cdx-info-chip
                                                            v-for="other in getNameRoleOtherUses(
                                                                card,
                                                                role.key,
                                                            )"
                                                            :key="
                                                                other.sourceId
                                                            "
                                                            status="notice"
                                                            :title="other.hint"
                                                            :aria-label="
                                                                other.label +
                                                                ' ' +
                                                                other.hint
                                                            "
                                                            role="note"
                                                            tabindex="0"
                                                            class="kanade-vg-stub-creator-name-role-other-use-chip"
                                                            :data-kanade-vg-stub-creator-name-role-other-use="
                                                                role.key
                                                            "
                                                            >{{
                                                                other.label
                                                            }}</cdx-info-chip
                                                        >
                                                    </div>
                                                    <div
                                                        class="kanade-vg-stub-creator-name-role-value"
                                                    >
                                                        <cdx-text-input
                                                            :aria-label="
                                                                msg(
                                                                    'names.roleValue',
                                                                    {
                                                                        role: role.label,
                                                                    },
                                                                )
                                                            "
                                                            :placeholder="
                                                                getNameRole(
                                                                    card,
                                                                    role.key,
                                                                ).defaultValue
                                                                    ? msg(
                                                                          'names.overridePlaceholder',
                                                                          {
                                                                              value: getNameRole(
                                                                                  card,
                                                                                  role.key,
                                                                              )
                                                                                  .defaultValue,
                                                                          },
                                                                      )
                                                                    : msg(
                                                                          role.key ===
                                                                              'noteTa'
                                                                              ? 'names.noteTaPlaceholder'
                                                                              : 'names.overrideManual',
                                                                      )
                                                            "
                                                            :model-value="
                                                                getNameRole(
                                                                    card,
                                                                    role.key,
                                                                ).value
                                                            "
                                                            @update:model-value="
                                                                updateNameRoleValue(
                                                                    card,
                                                                    role.key,
                                                                    $event,
                                                                )
                                                            "
                                                            @paste="
                                                                pasteNameRole(
                                                                    card,
                                                                    role.key,
                                                                    $event,
                                                                )
                                                            "
                                                            @blur="
                                                                commitNameRole(
                                                                    card,
                                                                    role.key,
                                                                )
                                                            "
                                                            @keydown.enter.prevent="
                                                                commitNameRole(
                                                                    card,
                                                                    role.key,
                                                                    true,
                                                                )
                                                            "
                                                        ></cdx-text-input>
                                                        <template
                                                            v-if="
                                                                role.key ===
                                                                    'pageName' ||
                                                                role.key ===
                                                                    'redirect'
                                                            "
                                                        >
                                                            <template
                                                                v-for="state in [
                                                                    getNameRolePageState(
                                                                        card,
                                                                        role.key,
                                                                    ),
                                                                ]"
                                                                :key="role.key"
                                                            >
                                                                <a
                                                                    v-for="match in state.title
                                                                        ? state
                                                                              .matches
                                                                              ?.length
                                                                            ? state.matches
                                                                            : [
                                                                                  {
                                                                                      title:
                                                                                          state.matchedTitle ||
                                                                                          state.title,
                                                                                      exists: state.exists,
                                                                                  },
                                                                              ]
                                                                        : []"
                                                                    :key="
                                                                        match.title
                                                                    "
                                                                    :href="
                                                                        getNameRoleMatchPageUrl(
                                                                            match,
                                                                        )
                                                                    "
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    :title="
                                                                        match.title
                                                                    "
                                                                    :aria-label="
                                                                        msg(
                                                                            'names.openPage',
                                                                            {
                                                                                title: match.title,
                                                                            },
                                                                        )
                                                                    "
                                                                    class="kanade-vg-stub-creator-name-role-page-link"
                                                                    ><cdx-icon
                                                                        :icon="
                                                                            tableActionIcons.externalLink
                                                                        "
                                                                        size="small"
                                                                        class="kanade-vg-stub-creator-name-role-external-icon"
                                                                    ></cdx-icon
                                                                ></a>
                                                            </template>
                                                        </template>
                                                    </div>
                                                </div>
                                                <template
                                                    v-if="
                                                        role.key ===
                                                            'pageName' ||
                                                        role.key === 'redirect'
                                                    "
                                                >
                                                    <div
                                                        v-for="state in [
                                                            getNameRolePageState(
                                                                card,
                                                                role.key,
                                                            ),
                                                        ]"
                                                        :key="role.key"
                                                        class="kanade-vg-stub-creator-name-role-page-checks"
                                                        :aria-busy="
                                                            state.loading
                                                        "
                                                    >
                                                        <div
                                                            role="status"
                                                            class="kanade-vg-stub-creator-name-role-page-status"
                                                        >
                                                            <span
                                                                v-if="
                                                                    state.loading
                                                                "
                                                                >{{
                                                                    msg(
                                                                        'names.rolePageChecking',
                                                                    )
                                                                }}</span
                                                            >
                                                            <div
                                                                v-else-if="
                                                                    state.title
                                                                "
                                                                class="kanade-vg-stub-creator-name-role-page-matches"
                                                            >
                                                                <div
                                                                    v-for="match in state
                                                                        .matches
                                                                        ?.length
                                                                        ? state.matches
                                                                        : [
                                                                              {
                                                                                  title:
                                                                                      state.matchedTitle ||
                                                                                      state.title,
                                                                                  exists: state.exists,
                                                                              },
                                                                          ]"
                                                                    :key="
                                                                        match.title
                                                                    "
                                                                    :data-kanade-vg-stub-creator-name-role-match="
                                                                        match.title
                                                                    "
                                                                    :title="
                                                                        match.title
                                                                    "
                                                                    class="kanade-vg-stub-creator-name-role-page-match"
                                                                >
                                                                    <cdx-info-chip
                                                                        class="kanade-vg-stub-creator-name-role-page-chip"
                                                                        :status="
                                                                            match.exists ===
                                                                            true
                                                                                ? 'warning'
                                                                                : match.exists ===
                                                                                    false
                                                                                  ? 'success'
                                                                                  : 'notice'
                                                                        "
                                                                    >
                                                                        {{
                                                                            msg(
                                                                                match.exists ===
                                                                                    true
                                                                                    ? 'names.rolePageExists'
                                                                                    : match.exists ===
                                                                                        false
                                                                                      ? 'names.rolePageMissing'
                                                                                      : 'names.rolePageUnknown',
                                                                                {
                                                                                    title: match.title,
                                                                                },
                                                                            )
                                                                        }}
                                                                    </cdx-info-chip>
                                                                </div>
                                                            </div>
                                                            <span v-else>{{
                                                                msg(
                                                                    'names.rolePageUnspecified',
                                                                )
                                                            }}</span>
                                                        </div>
                                                        <cdx-button
                                                            v-if="
                                                                role.key ===
                                                                    'pageName' &&
                                                                state.exists ===
                                                                    false &&
                                                                !getNameRole(
                                                                    card,
                                                                    role.key,
                                                                ).enabled
                                                            "
                                                            type="button"
                                                            action="progressive"
                                                            weight="normal"
                                                            class="kanade-vg-stub-creator-name-role-select-button"
                                                            :aria-label="
                                                                msg(
                                                                    'names.selectMissingTitle',
                                                                    {
                                                                        role: role.label,
                                                                    },
                                                                )
                                                            "
                                                            @click="
                                                                updateNameRoleEnabled(
                                                                    card,
                                                                    role.key,
                                                                    true,
                                                                )
                                                            "
                                                            >{{
                                                                msg(
                                                                    'names.useAsPageName',
                                                                )
                                                            }}</cdx-button
                                                        >
                                                        <cdx-button
                                                            v-if="
                                                                role.key ===
                                                                    'pageName' &&
                                                                getNameRole(
                                                                    card,
                                                                    role.key,
                                                                ).enabled &&
                                                                canMovePageName()
                                                            "
                                                            type="button"
                                                            :disabled="
                                                                sourceFetchState.loading
                                                            "
                                                            @click="
                                                                openMoveDialog
                                                            "
                                                            >{{
                                                                msg('text.move')
                                                            }}</cdx-button
                                                        >
                                                        <cdx-button
                                                            v-if="
                                                                role.key ===
                                                                    'redirect' &&
                                                                getNameRoleRedirectReviewRow(
                                                                    card,
                                                                )?.title
                                                            "
                                                            type="button"
                                                            weight="quiet"
                                                            :aria-label="
                                                                getReviewPageActionAriaLabel(
                                                                    getNameRoleRedirectReviewRow(
                                                                        card,
                                                                    ),
                                                                    getNameRoleRedirectReviewRow(
                                                                        card,
                                                                    ).exists,
                                                                )
                                                            "
                                                            @click="
                                                                openRedirectEdit(
                                                                    getNameRoleRedirectReviewRow(
                                                                        card,
                                                                    ),
                                                                )
                                                            "
                                                        >
                                                            {{
                                                                getReviewPageActionLabel(
                                                                    getNameRoleRedirectReviewRow(
                                                                        card,
                                                                    ),
                                                                    getNameRoleRedirectReviewRow(
                                                                        card,
                                                                    ).exists,
                                                                )
                                                            }}
                                                        </cdx-button>
                                                    </div>
                                                </template>
                                                <div
                                                    v-if="role.key === 'noteTa'"
                                                    class="kanade-vg-stub-creator-name-conversion-chips"
                                                    role="status"
                                                >
                                                    <cdx-info-chip
                                                        v-for="chip in getNameConversionChips()"
                                                        :key="chip.key"
                                                        status="notice"
                                                        :data-kanade-vg-stub-creator-name-conversion-chip="
                                                            chip.variant ||
                                                            chip.key
                                                        "
                                                        :title="chip.value"
                                                        >{{
                                                            chip.label
                                                        }}</cdx-info-chip
                                                    >
                                                </div>
                                                <template
                                                    v-if="
                                                        role.key === 'redirect'
                                                    "
                                                >
                                                    <cdx-button
                                                        type="button"
                                                        weight="quiet"
                                                        class="kanade-vg-stub-creator-icon-button"
                                                        data-kanade-vg-stub-creator-name-add-redirect
                                                        :title="
                                                            msg(
                                                                'names.addRedirect',
                                                            )
                                                        "
                                                        :aria-label="
                                                            msg(
                                                                'names.addRedirect',
                                                            )
                                                        "
                                                        @click="
                                                            addNameCardRedirect(
                                                                card,
                                                            )
                                                        "
                                                        ><cdx-icon
                                                            :icon="
                                                                tableActionIcons.add
                                                            "
                                                            size="small"
                                                        ></cdx-icon
                                                    ></cdx-button>
                                                    <cdx-button
                                                        type="button"
                                                        weight="quiet"
                                                        class="kanade-vg-stub-creator-icon-button"
                                                        :aria-label="
                                                            msg('common.remove')
                                                        "
                                                        :title="
                                                            msg('common.remove')
                                                        "
                                                        @click="
                                                            removeNameRoleRedirect(
                                                                card,
                                                            )
                                                        "
                                                        ><cdx-icon
                                                            :icon="
                                                                tableActionIcons.remove
                                                            "
                                                            size="small"
                                                        ></cdx-icon
                                                    ></cdx-button>
                                                </template>
                                            </div>
                                            <template
                                                v-if="role.key === 'redirect'"
                                            >
                                                <div
                                                    v-for="(
                                                        row, index
                                                    ) in getNameCardExtraRedirectRows(
                                                        card,
                                                    )"
                                                    :key="
                                                        getNameReviewRowKey(row)
                                                    "
                                                    class="kanade-vg-stub-creator-name-redirect-row"
                                                    :data-kanade-vg-stub-creator-name-redirect-row="
                                                        row.title
                                                    "
                                                >
                                                    <div
                                                        class="kanade-vg-stub-creator-name-role-control"
                                                    >
                                                        <cdx-checkbox
                                                            :model-value="
                                                                row.enabled
                                                            "
                                                            @update:model-value="
                                                                updateNameCardRedirectEnabled(
                                                                    row,
                                                                    $event,
                                                                )
                                                            "
                                                            >{{
                                                                getNameCardRedirectLabel(
                                                                    card,
                                                                    index,
                                                                )
                                                            }}</cdx-checkbox
                                                        >
                                                        <div
                                                            class="kanade-vg-stub-creator-name-role-value"
                                                        >
                                                            <cdx-text-input
                                                                :aria-label="
                                                                    msg(
                                                                        'names.roleValue',
                                                                        {
                                                                            role: getNameCardRedirectLabel(
                                                                                card,
                                                                                index,
                                                                            ),
                                                                        },
                                                                    )
                                                                "
                                                                :model-value="
                                                                    row.title
                                                                "
                                                                :placeholder="
                                                                    msg(
                                                                        'names.overrideManual',
                                                                    )
                                                                "
                                                                @update:model-value="
                                                                    updateRedirectRowTitle(
                                                                        (
                                                                            form.redirectRows ||
                                                                            []
                                                                        ).indexOf(
                                                                            row,
                                                                        ),
                                                                        $event,
                                                                    )
                                                                "
                                                                @paste="
                                                                    pasteNameCardRedirect(
                                                                        row,
                                                                        $event,
                                                                    )
                                                                "
                                                                @blur="
                                                                    commitNameCardRedirect(
                                                                        row,
                                                                    )
                                                                "
                                                                @keydown.enter.prevent="
                                                                    commitNameCardRedirect(
                                                                        row,
                                                                        true,
                                                                    )
                                                                "
                                                            ></cdx-text-input>
                                                            <a
                                                                v-if="row.title"
                                                                :href="
                                                                    getRedirectPageUrl(
                                                                        row,
                                                                    )
                                                                "
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                :title="
                                                                    row.title
                                                                "
                                                                :aria-label="
                                                                    msg(
                                                                        'names.openPage',
                                                                        {
                                                                            title: row.title,
                                                                        },
                                                                    )
                                                                "
                                                                class="kanade-vg-stub-creator-name-role-page-link"
                                                                ><cdx-icon
                                                                    :icon="
                                                                        tableActionIcons.externalLink
                                                                    "
                                                                    size="small"
                                                                    class="kanade-vg-stub-creator-name-role-external-icon"
                                                                ></cdx-icon
                                                            ></a>
                                                        </div>
                                                    </div>
                                                    <div
                                                        class="kanade-vg-stub-creator-name-role-page-checks"
                                                        role="status"
                                                        :aria-busy="
                                                            reviewState.loading
                                                        "
                                                    >
                                                        <span
                                                            v-if="
                                                                reviewState.loading
                                                            "
                                                            >{{
                                                                msg(
                                                                    'names.rolePageChecking',
                                                                )
                                                            }}</span
                                                        >
                                                        <div
                                                            v-else-if="
                                                                row.title
                                                            "
                                                            :title="row.title"
                                                            class="kanade-vg-stub-creator-name-role-page-match"
                                                        >
                                                            <cdx-info-chip
                                                                class="kanade-vg-stub-creator-name-role-page-chip"
                                                                :status="
                                                                    getNameCardRedirectPageExistence(
                                                                        row,
                                                                    ) === null
                                                                        ? 'notice'
                                                                        : row.exists
                                                                          ? 'warning'
                                                                          : 'success'
                                                                "
                                                            >
                                                                {{
                                                                    msg(
                                                                        getNameCardRedirectPageExistence(
                                                                            row,
                                                                        ) ===
                                                                            null
                                                                            ? 'names.rolePageUnknown'
                                                                            : row.exists
                                                                              ? 'names.rolePageExists'
                                                                              : 'names.rolePageMissing',
                                                                        {
                                                                            title: row.title,
                                                                        },
                                                                    )
                                                                }}
                                                            </cdx-info-chip>
                                                        </div>
                                                        <span v-else>{{
                                                            msg(
                                                                'names.rolePageUnspecified',
                                                            )
                                                        }}</span>
                                                        <cdx-button
                                                            v-if="row.title"
                                                            type="button"
                                                            weight="quiet"
                                                            :aria-label="
                                                                getReviewPageActionAriaLabel(
                                                                    row,
                                                                    row.exists,
                                                                )
                                                            "
                                                            @click="
                                                                openRedirectEdit(
                                                                    row,
                                                                )
                                                            "
                                                            >{{
                                                                getReviewPageActionLabel(
                                                                    row,
                                                                    row.exists,
                                                                )
                                                            }}</cdx-button
                                                        >
                                                    </div>
                                                    <cdx-button
                                                        type="button"
                                                        weight="quiet"
                                                        class="kanade-vg-stub-creator-icon-button"
                                                        :aria-label="
                                                            msg('common.remove')
                                                        "
                                                        :title="
                                                            msg('common.remove')
                                                        "
                                                        @click="
                                                            removeNameCardRedirect(
                                                                row,
                                                            )
                                                        "
                                                    >
                                                        <cdx-icon
                                                            :icon="
                                                                tableActionIcons.remove
                                                            "
                                                            size="small"
                                                        ></cdx-icon>
                                                    </cdx-button>
                                                </div>
                                                <cdx-button
                                                    v-if="
                                                        !isNameRoleRedirectVisible(
                                                            card,
                                                        )
                                                    "
                                                    type="button"
                                                    weight="quiet"
                                                    class="kanade-vg-stub-creator-icon-button"
                                                    data-kanade-vg-stub-creator-name-add-redirect
                                                    :title="
                                                        msg('names.addRedirect')
                                                    "
                                                    :aria-label="
                                                        msg('names.addRedirect')
                                                    "
                                                    @click="
                                                        addNameCardRedirect(
                                                            card,
                                                        )
                                                    "
                                                    ><cdx-icon
                                                        :icon="
                                                            tableActionIcons.add
                                                        "
                                                        size="small"
                                                    ></cdx-icon
                                                ></cdx-button>
                                            </template>
                                        </div>
                                    </div>
                                    <cdx-message
                                        type="error"
                                        v-if="reviewState.error"
                                        >{{ reviewState.error }}</cdx-message
                                    >
                                </cdx-field>
                                <template #label
                                    ><span
                                        class="kanade-vg-stub-creator-name-card-heading"
                                    >
                                        <span>{{
                                            card.kind === 'localized'
                                                ? msg('names.nameNumber', {
                                                      number: card.index + 1,
                                                  })
                                                : card.kind === 'original'
                                                  ? msg('titles.originalTitle')
                                                  : msg('titles.englishTitle')
                                        }}</span>
                                        <span
                                            class="kanade-vg-stub-creator-name-card-actions"
                                        >
                                            <cdx-button
                                                v-if="card.kind === 'localized'"
                                                type="button"
                                                weight="quiet"
                                                class="kanade-vg-stub-creator-icon-button"
                                                :aria-label="
                                                    msg('names.remove')
                                                "
                                                :title="msg('names.remove')"
                                                @click="
                                                    removeNameRow(
                                                        group.nameGroupKey,
                                                        card.index,
                                                    )
                                                "
                                                ><cdx-icon
                                                    :icon="
                                                        tableActionIcons.remove
                                                    "
                                                    size="small"
                                                ></cdx-icon></cdx-button
                                        ></span> </span
                                ></template>
                            </cdx-field>
                        </div>
                    </template>
                    <template v-if="group.fields.length && !group.nameGroupKey">
                        <div>
                            <div
                                class="kanade-vg-stub-creator-fields-grid"
                                :class="{
                                    'kanade-vg-stub-creator-fields-grid--columns':
                                        group.key !== 'metadata',
                                }"
                            >
                                <div
                                    class="kanade-vg-stub-creator-field-column"
                                    :class="{
                                        'kanade-vg-stub-creator-form-field--wide':
                                            field.key === 'enwikiTitle' ||
                                            field.key === 'series' ||
                                            field.key === 'platforms' ||
                                            field.multiline,
                                    }"
                                    :key="field.key"
                                    v-for="field in group.fields"
                                >
                                    <cdx-field
                                        :class="{
                                            'kanade-vg-stub-creator-form-field--related':
                                                hasRelatedItems(field),
                                            'kanade-vg-stub-creator-form-field--sourced':
                                                !!field.sourceField,
                                        }"
                                        :data-kanade-vg-stub-creator-field="
                                            field.key
                                        "
                                        :is-fieldset="!!field.sourceField"
                                    >
                                        <div
                                            v-if="hasRelatedItems(field)"
                                            class="kanade-vg-stub-creator-metadata-editor"
                                            :aria-busy="
                                                categoryState.loading ||
                                                reviewState.loading
                                            "
                                        >
                                            <cdx-field>
                                                <template #label>{{
                                                    msg('form.itemOrUrl')
                                                }}</template>
                                                <cdx-text-input
                                                    class="kanade-vg-stub-creator-metadata-entry"
                                                    :aria-label="field.label"
                                                    :placeholder="
                                                        msg('form.itemOrUrl')
                                                    "
                                                    :model-value="
                                                        metadataEntryValues[
                                                            field.key
                                                        ]
                                                    "
                                                    @update:model-value="
                                                        updateMetadataEntry(
                                                            field,
                                                            $event,
                                                        )
                                                    "
                                                    @paste="
                                                        pasteMetadataEntry(
                                                            field,
                                                            $event,
                                                        )
                                                    "
                                                    @blur="
                                                        commitMetadataEntry(
                                                            field,
                                                        )
                                                    "
                                                    @keydown.enter.prevent="
                                                        commitMetadataEntry(
                                                            field,
                                                        )
                                                    "
                                                ></cdx-text-input>
                                            </cdx-field>
                                            <span
                                                class="kanade-vg-stub-creator-visually-hidden"
                                                :id="
                                                    'kanade-vg-stub-creator-' +
                                                    field.key +
                                                    '-related-help'
                                                "
                                                >{{
                                                    msg(
                                                        'form.relatedItemInteraction',
                                                    )
                                                }}</span
                                            >
                                            <cdx-field
                                                class="kanade-vg-stub-creator-metadata-section"
                                                :is-fieldset="true"
                                            >
                                                <template #label>{{
                                                    msg('form.items')
                                                }}</template>
                                                <ul
                                                    class="kanade-vg-stub-creator-metadata-list"
                                                >
                                                    <li
                                                        v-for="item in [
                                                            ...getMetadataItems(
                                                                field,
                                                            ),
                                                            null,
                                                        ]"
                                                        :key="
                                                            item
                                                                ? item.id
                                                                : 'additional-related'
                                                        "
                                                        :class="{
                                                            'kanade-vg-stub-creator-metadata-item':
                                                                item,
                                                            'kanade-vg-stub-creator-metadata-item--excluded':
                                                                item
                                                                    ? !item.enabled
                                                                    : false,
                                                        }"
                                                        :data-kanade-vg-stub-creator-metadata-item="
                                                            item
                                                                ? item.id
                                                                : undefined
                                                        "
                                                        :data-kanade-vg-stub-creator-metadata-field="
                                                            item
                                                                ? field.key
                                                                : undefined
                                                        "
                                                    >
                                                        <div
                                                            v-if="item"
                                                            class="kanade-vg-stub-creator-metadata-name"
                                                        >
                                                            <cdx-checkbox
                                                                :model-value="
                                                                    item.enabled
                                                                "
                                                                :aria-label="
                                                                    msg(
                                                                        'form.includeItem',
                                                                        {
                                                                            value: getMetadataItemLabel(
                                                                                item,
                                                                            ),
                                                                        },
                                                                    )
                                                                "
                                                                @update:model-value="
                                                                    setMetadataItemEnabled(
                                                                        field,
                                                                        item,
                                                                        $event,
                                                                    )
                                                                "
                                                            >
                                                                <span
                                                                    class="kanade-vg-stub-creator-visually-hidden"
                                                                    >{{
                                                                        getMetadataItemLabel(
                                                                            item,
                                                                        )
                                                                    }}</span
                                                                >
                                                            </cdx-checkbox>
                                                            <cdx-text-input
                                                                class="kanade-vg-stub-creator-metadata-item-name-input"
                                                                :aria-label="
                                                                    msg(
                                                                        'form.itemName',
                                                                        {
                                                                            field: field.label,
                                                                        },
                                                                    )
                                                                "
                                                                :model-value="
                                                                    getMetadataItemInputValue(
                                                                        item,
                                                                    )
                                                                "
                                                                @update:model-value="
                                                                    updateMetadataItem(
                                                                        field,
                                                                        item,
                                                                        $event,
                                                                    )
                                                                "
                                                                @blur="
                                                                    finishMetadataItemEdit(
                                                                        field,
                                                                        item,
                                                                    )
                                                                "
                                                                @keydown.enter.prevent="
                                                                    finishMetadataItemEdit(
                                                                        field,
                                                                        item,
                                                                    )
                                                                "
                                                            ></cdx-text-input>
                                                        </div>
                                                        <div
                                                            v-if="
                                                                item ||
                                                                !getMetadataItems(
                                                                    field,
                                                                ).length ||
                                                                getRelatedItems(
                                                                    field,
                                                                ).some(
                                                                    (section) =>
                                                                        section
                                                                            .rows
                                                                            .length,
                                                                )
                                                            "
                                                            :class="
                                                                item
                                                                    ? 'kanade-vg-stub-creator-metadata-related'
                                                                    : 'kanade-vg-stub-creator-metadata-extras'
                                                            "
                                                        >
                                                            <span
                                                                v-if="!item"
                                                                class="kanade-vg-stub-creator-visually-hidden"
                                                                >{{
                                                                    msg(
                                                                        'form.additionalRelated',
                                                                    )
                                                                }}</span
                                                            >
                                                            <section
                                                                v-for="section in getRelatedItems(
                                                                    field,
                                                                    item ||
                                                                        undefined,
                                                                )"
                                                                :key="
                                                                    section.kind
                                                                "
                                                                class="kanade-vg-stub-creator-related-section"
                                                                :data-kanade-vg-stub-creator-kind="
                                                                    section.kind
                                                                "
                                                            >
                                                                <h4
                                                                    class="kanade-vg-stub-creator-visually-hidden"
                                                                >
                                                                    {{
                                                                        section.label
                                                                    }}
                                                                </h4>
                                                                <ul
                                                                    v-if="
                                                                        section
                                                                            .rows
                                                                            .length
                                                                    "
                                                                    class="kanade-vg-stub-creator-related-list"
                                                                >
                                                                    <li
                                                                        v-for="(
                                                                            row,
                                                                            rowIndex
                                                                        ) in section.rows"
                                                                        :key="
                                                                            row
                                                                        "
                                                                        class="kanade-vg-stub-creator-related-item"
                                                                        data-kanade-vg-stub-creator-related-row
                                                                        :class="{
                                                                            'kanade-vg-stub-creator-related-item--pending':
                                                                                row.pendingEdit ||
                                                                                row.pendingCreation,
                                                                        }"
                                                                    >
                                                                        <span
                                                                            class="kanade-vg-stub-creator-visually-hidden"
                                                                            :id="
                                                                                'kanade-vg-stub-creator-' +
                                                                                field.key +
                                                                                '-' +
                                                                                (item
                                                                                    ? item.id
                                                                                    : 'additional') +
                                                                                '-' +
                                                                                section.kind +
                                                                                '-' +
                                                                                rowIndex +
                                                                                '-selection'
                                                                            "
                                                                            >{{
                                                                                msg(
                                                                                    row.enabled ===
                                                                                        false
                                                                                        ? 'form.relatedDisabled'
                                                                                        : 'form.relatedEnabled',
                                                                                )
                                                                            }}
                                                                            —
                                                                            {{
                                                                                getRelatedItemStatusLabel(
                                                                                    row,
                                                                                    section.kind,
                                                                                )
                                                                            }}</span
                                                                        >
                                                                        <div
                                                                            class="kanade-vg-stub-creator-related-value"
                                                                        >
                                                                            <cdx-text-input
                                                                                v-if="
                                                                                    isRelatedItemEditing(
                                                                                        row,
                                                                                    )
                                                                                "
                                                                                :ref="
                                                                                    (
                                                                                        control,
                                                                                    ) =>
                                                                                        setRelatedItemInput(
                                                                                            row,
                                                                                            control,
                                                                                        )
                                                                                "
                                                                                :aria-label="
                                                                                    section.kind ===
                                                                                    'category'
                                                                                        ? msg(
                                                                                              'review.categoryName',
                                                                                          )
                                                                                        : msg(
                                                                                              'review.templateName',
                                                                                          )
                                                                                "
                                                                                :aria-describedby="
                                                                                    'kanade-vg-stub-creator-' +
                                                                                    field.key +
                                                                                    '-related-help'
                                                                                "
                                                                                :data-kanade-vg-stub-creator-related-field="
                                                                                    field.key
                                                                                "
                                                                                :data-kanade-vg-stub-creator-related-kind="
                                                                                    section.kind
                                                                                "
                                                                                :model-value="
                                                                                    getRelatedItemValue(
                                                                                        row,
                                                                                        section.kind,
                                                                                    )
                                                                                "
                                                                                @update:model-value="
                                                                                    updateRelatedItem(
                                                                                        row,
                                                                                        section.kind,
                                                                                        $event,
                                                                                    )
                                                                                "
                                                                                @blur="
                                                                                    finishRelatedItemEdit(
                                                                                        row,
                                                                                        section.kind,
                                                                                        $event,
                                                                                    )
                                                                                "
                                                                                @keydown.enter.prevent="
                                                                                    finishRelatedItemEdit(
                                                                                        row,
                                                                                        section.kind,
                                                                                    )
                                                                                "
                                                                                @keydown.escape.prevent="
                                                                                    cancelRelatedItemEdit(
                                                                                        row,
                                                                                        section.kind,
                                                                                    )
                                                                                "
                                                                            ></cdx-text-input>
                                                                            <a
                                                                                v-else
                                                                                class="kanade-vg-stub-creator-related-link"
                                                                                :data-kanade-vg-stub-creator-enabled="
                                                                                    row.enabled !==
                                                                                    false
                                                                                "
                                                                                :href="
                                                                                    getRelatedItemUrl(
                                                                                        row,
                                                                                        section.kind,
                                                                                    )
                                                                                "
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                :title="
                                                                                    getRelatedItemStatusLabel(
                                                                                        row,
                                                                                        section.kind,
                                                                                    ) +
                                                                                    ' — ' +
                                                                                    msg(
                                                                                        'form.relatedItemInteraction',
                                                                                    )
                                                                                "
                                                                                :aria-describedby="
                                                                                    'kanade-vg-stub-creator-' +
                                                                                    field.key +
                                                                                    '-' +
                                                                                    (item
                                                                                        ? item.id
                                                                                        : 'additional') +
                                                                                    '-' +
                                                                                    section.kind +
                                                                                    '-' +
                                                                                    rowIndex +
                                                                                    '-selection' +
                                                                                    ' kanade-vg-stub-creator-' +
                                                                                    field.key +
                                                                                    '-related-help'
                                                                                "
                                                                                :data-kanade-vg-stub-creator-existence="
                                                                                    getRelatedItemPageExistence(
                                                                                        row,
                                                                                        section.kind,
                                                                                    )
                                                                                "
                                                                                :class="{
                                                                                    'kanade-vg-stub-creator-related-link--disabled':
                                                                                        row.enabled ===
                                                                                        false,
                                                                                    'kanade-vg-stub-creator-related-link--missing':
                                                                                        getRelatedItemPageExistence(
                                                                                            row,
                                                                                            section.kind,
                                                                                        ) ===
                                                                                        'missing',
                                                                                    'kanade-vg-stub-creator-related-link--unchecked':
                                                                                        getRelatedItemPageExistence(
                                                                                            row,
                                                                                            section.kind,
                                                                                        ) ===
                                                                                        'unchecked',
                                                                                }"
                                                                                @click="
                                                                                    activateRelatedItem(
                                                                                        $event,
                                                                                        row,
                                                                                        field,
                                                                                        section.kind,
                                                                                    )
                                                                                "
                                                                                @dblclick="
                                                                                    editRelatedItemOnDoubleClick(
                                                                                        $event,
                                                                                        row,
                                                                                        field,
                                                                                        section.kind,
                                                                                    )
                                                                                "
                                                                                @keydown.space.prevent="
                                                                                    toggleRelatedItem(
                                                                                        row,
                                                                                    )
                                                                                "
                                                                                @keydown.enter="
                                                                                    activateRelatedItemKeyboard(
                                                                                        $event,
                                                                                        row,
                                                                                        field,
                                                                                        section.kind,
                                                                                    )
                                                                                "
                                                                                >{{
                                                                                    getRelatedItemDisplayLabel(
                                                                                        row,
                                                                                        section.kind,
                                                                                    )
                                                                                }}</a
                                                                            >
                                                                            <cdx-button
                                                                                v-if="isRelatedItemEditing(row) &amp;&amp; getRelatedItemValue(row, section.kind)"
                                                                                class="kanade-vg-stub-creator-related-page-action"
                                                                                data-kanade-vg-stub-creator-related-page-action
                                                                                type="button"
                                                                                weight="quiet"
                                                                                :aria-label="
                                                                                    getRelatedItemActionLabel(
                                                                                        row,
                                                                                        section.kind,
                                                                                    )
                                                                                "
                                                                                @click="
                                                                                    openRelatedItemEdit(
                                                                                        row,
                                                                                        section.kind,
                                                                                    )
                                                                                "
                                                                                >{{
                                                                                    getRelatedItemActionLabel(
                                                                                        row,
                                                                                        section.kind,
                                                                                    )
                                                                                }}</cdx-button
                                                                            >
                                                                        </div>
                                                                    </li>
                                                                </ul>
                                                            </section>
                                                            <cdx-text-input
                                                                v-if="
                                                                    isRelatedEntryEditing(
                                                                        field,
                                                                        item ||
                                                                            undefined,
                                                                    )
                                                                "
                                                                :ref="
                                                                    (control) =>
                                                                        setRelatedEntryInput(
                                                                            field,
                                                                            item ||
                                                                                undefined,
                                                                            control,
                                                                        )
                                                                "
                                                                class="kanade-vg-stub-creator-related-entry"
                                                                :data-kanade-vg-stub-creator-related-entry="
                                                                    field.key
                                                                "
                                                                :aria-label="
                                                                    msg(
                                                                        'form.relatedItemOrTemplate',
                                                                    )
                                                                "
                                                                :placeholder="
                                                                    msg(
                                                                        'form.relatedItemOrTemplate',
                                                                    )
                                                                "
                                                                :model-value="
                                                                    relatedEntryValues[
                                                                        getRelatedEntryKey(
                                                                            field,
                                                                            item ||
                                                                                undefined,
                                                                        )
                                                                    ]
                                                                "
                                                                @update:model-value="
                                                                    updateRelatedEntry(
                                                                        field,
                                                                        $event,
                                                                        item ||
                                                                            undefined,
                                                                    )
                                                                "
                                                                @paste="
                                                                    pasteRelatedEntry(
                                                                        field,
                                                                        $event,
                                                                        item ||
                                                                            undefined,
                                                                    )
                                                                "
                                                                @blur="
                                                                    commitRelatedEntry(
                                                                        field,
                                                                        item ||
                                                                            undefined,
                                                                    )
                                                                "
                                                                @keydown.enter.prevent="
                                                                    commitRelatedEntry(
                                                                        field,
                                                                        item ||
                                                                            undefined,
                                                                    )
                                                                "
                                                            ></cdx-text-input>
                                                            <cdx-button
                                                                v-else
                                                                type="button"
                                                                weight="quiet"
                                                                class="kanade-vg-stub-creator-icon-button"
                                                                data-kanade-vg-stub-creator-related-add-button
                                                                :aria-label="
                                                                    msg(
                                                                        'form.addRelatedEntry',
                                                                        {
                                                                            field: field.label,
                                                                        },
                                                                    )
                                                                "
                                                                :title="
                                                                    msg(
                                                                        'form.addRelatedEntry',
                                                                        {
                                                                            field: field.label,
                                                                        },
                                                                    )
                                                                "
                                                                :disabled="
                                                                    item
                                                                        ? !item.enabled
                                                                        : false
                                                                "
                                                                @click="
                                                                    openRelatedEntry(
                                                                        field,
                                                                        item ||
                                                                            undefined,
                                                                    )
                                                                "
                                                            >
                                                                <cdx-icon
                                                                    :icon="
                                                                        tableActionIcons.add
                                                                    "
                                                                    size="small"
                                                                ></cdx-icon>
                                                            </cdx-button>
                                                        </div>
                                                    </li>
                                                </ul>
                                            </cdx-field>
                                            <cdx-field
                                                class="kanade-vg-stub-creator-metadata-section kanade-vg-stub-creator-metadata-references"
                                                :is-fieldset="true"
                                                data-kanade-vg-stub-creator-metadata-sources
                                            >
                                                <template #label>{{
                                                    msg('form.sources')
                                                }}</template>
                                                <ul
                                                    class="kanade-vg-stub-creator-metadata-reference-list"
                                                >
                                                    <li
                                                        v-for="url in getMetadataSources(
                                                            field,
                                                        )"
                                                        :key="url"
                                                        data-kanade-vg-stub-creator-metadata-reference
                                                    >
                                                        <a
                                                            class="kanade-vg-stub-creator-external-link"
                                                            :href="url"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            >{{ url
                                                            }}<cdx-icon
                                                                aria-hidden="true"
                                                                class="kanade-vg-stub-creator-external-link-icon"
                                                                :icon="
                                                                    externalLinkIcon
                                                                "
                                                                size="x-small"
                                                            ></cdx-icon
                                                        ></a>
                                                        <cdx-button
                                                            type="button"
                                                            weight="quiet"
                                                            class="kanade-vg-stub-creator-icon-button"
                                                            :aria-label="
                                                                msg(
                                                                    'form.removeReference',
                                                                    { url },
                                                                )
                                                            "
                                                            :title="
                                                                msg(
                                                                    'form.removeReference',
                                                                    { url },
                                                                )
                                                            "
                                                            @click="
                                                                removeMetadataSource(
                                                                    field,
                                                                    url,
                                                                )
                                                            "
                                                        >
                                                            {{
                                                                msg(
                                                                    'common.remove',
                                                                )
                                                            }}
                                                        </cdx-button>
                                                    </li>
                                                </ul>
                                            </cdx-field>
                                        </div>
                                        <div
                                            v-else
                                            class="kanade-vg-stub-creator-field-layout"
                                        >
                                            <div
                                                class="kanade-vg-stub-creator-field-inputs"
                                            >
                                                <component
                                                    :is="
                                                        field.sourceField
                                                            ? 'cdx-field'
                                                            : 'div'
                                                    "
                                                >
                                                    <template
                                                        #label
                                                        v-if="field.sourceField"
                                                        >{{
                                                            msg('common.value')
                                                        }}</template
                                                    >
                                                    <div
                                                        class="kanade-vg-stub-creator-field-controls"
                                                        :class="{
                                                            'kanade-vg-stub-creator-field-controls--with-move':
                                                                field.key ===
                                                                    'pageName' &&
                                                                canMovePageName(),
                                                        }"
                                                    >
                                                        <cdx-text-area
                                                            v-if="
                                                                field.multiline
                                                            "
                                                            :aria-label="
                                                                field.label
                                                            "
                                                            class="kanade-vg-stub-creator-article-field-text"
                                                            rows="4"
                                                            :placeholder="
                                                                getFieldPlaceholder(
                                                                    field,
                                                                ) ||
                                                                field.placeholder
                                                            "
                                                            :model-value="
                                                                form[field.key]
                                                            "
                                                            @change="normalizeFieldValue(field); hasRelatedItems(field) &amp;&amp; refreshRelatedItems()"
                                                            @update:model-value="
                                                                updateFieldValue(
                                                                    field,
                                                                    $event,
                                                                )
                                                            "
                                                        ></cdx-text-area>
                                                        <cdx-text-input
                                                            v-else
                                                            :aria-label="
                                                                field.label
                                                            "
                                                            :placeholder="
                                                                getFieldPlaceholder(
                                                                    field,
                                                                ) ||
                                                                field.placeholder
                                                            "
                                                            :readonly="
                                                                field.readonly
                                                            "
                                                            :model-value="
                                                                form[field.key]
                                                            "
                                                            @change="normalizeFieldValue(field); hasRelatedItems(field) &amp;&amp; refreshRelatedItems()"
                                                            @paste="
                                                                normalizePastedFieldValue(
                                                                    field,
                                                                    $event,
                                                                )
                                                            "
                                                            @update:model-value="
                                                                updateFieldValue(
                                                                    field,
                                                                    $event,
                                                                )
                                                            "
                                                        ></cdx-text-input>
                                                        <cdx-button
                                                            v-if="field.key === 'pageName' &amp;&amp; canMovePageName()"
                                                            type="button"
                                                            :disabled="
                                                                sourceFetchState.loading
                                                            "
                                                            @click="
                                                                openMoveDialog
                                                            "
                                                            >{{
                                                                msg('text.move')
                                                            }}</cdx-button
                                                        >
                                                    </div>
                                                </component>
                                                <cdx-field
                                                    class="kanade-vg-stub-creator-source-field"
                                                    v-if="field.sourceField"
                                                    :data-kanade-vg-stub-creator-source-input="
                                                        field.sourceField
                                                            .sourceKey
                                                    "
                                                >
                                                    <cdx-text-input
                                                        :aria-label="
                                                            msg(
                                                                'form.sourceUrlsFor',
                                                                {
                                                                    field: field.label,
                                                                },
                                                            )
                                                        "
                                                        class="kanade-vg-stub-creator-source-url"
                                                        :model-value="
                                                            sourceEntryValues[
                                                                field
                                                                    .sourceField
                                                                    .sourceKey
                                                            ] || ''
                                                        "
                                                        @blur="
                                                            commitSourceEntry(
                                                                field
                                                                    .sourceField
                                                                    .sourceKey,
                                                            )
                                                        "
                                                        @update:model-value="
                                                            updateSourceEntry(
                                                                field
                                                                    .sourceField
                                                                    .sourceKey,
                                                                $event,
                                                            )
                                                        "
                                                        @paste="
                                                            pasteSourceEntry(
                                                                field
                                                                    .sourceField
                                                                    .sourceKey,
                                                                $event,
                                                            )
                                                        "
                                                        @keydown.enter="
                                                            commitSourceEntry(
                                                                field
                                                                    .sourceField
                                                                    .sourceKey,
                                                                $event,
                                                            )
                                                        "
                                                        placeholder="https://…"
                                                    ></cdx-text-input>
                                                    <ul
                                                        class="kanade-vg-stub-creator-source-list"
                                                    >
                                                        <li
                                                            v-for="url in getSourceUrls(
                                                                field
                                                                    .sourceField
                                                                    .sourceKey,
                                                            )"
                                                            :key="url"
                                                            data-kanade-vg-stub-creator-source-url
                                                        >
                                                            <a
                                                                :href="
                                                                    getSourceUrlHref(
                                                                        url,
                                                                    )
                                                                "
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                >{{ url }}</a
                                                            >
                                                            <cdx-button
                                                                type="button"
                                                                weight="quiet"
                                                                :aria-label="
                                                                    msg(
                                                                        'form.removeReference',
                                                                        { url },
                                                                    )
                                                                "
                                                                @click="
                                                                    removeSourceUrl(
                                                                        field
                                                                            .sourceField
                                                                            .sourceKey,
                                                                        url,
                                                                        $event,
                                                                    )
                                                                "
                                                                >{{
                                                                    msg(
                                                                        'common.remove',
                                                                    )
                                                                }}</cdx-button
                                                            >
                                                        </li>
                                                    </ul>
                                                    <template #label>{{
                                                        msg('form.sourceUrls')
                                                    }}</template>
                                                </cdx-field>
                                            </div>
                                        </div>
                                        <template #label>{{
                                            field.heading ||
                                            getMetadataFieldLabel(field)
                                        }}</template>
                                        <template
                                            #help-text
                                            v-if="
                                                field.key === 'enwikiTitle' ||
                                                field.key === 'pageName' ||
                                                field.key === 'name'
                                            "
                                        >
                                            <template
                                                v-if="field.key === 'pageName'"
                                                >{{
                                                    msg('names.pageNameHelp')
                                                }}</template
                                            >
                                            <template
                                                v-else-if="field.key === 'name'"
                                                >{{
                                                    msg(
                                                        'names.displayTitleHelp',
                                                    )
                                                }}</template
                                            >
                                            <template
                                                v-else-if="
                                                    getEnwikiTipLinks().length
                                                "
                                            >
                                                <span
                                                    class="kanade-vg-stub-creator-enwiki-help kanade-vg-stub-creator-horizontal-list"
                                                >
                                                    <span
                                                        class="kanade-vg-stub-creator-horizontal-list-item"
                                                        :key="link.label"
                                                        v-for="link in getEnwikiTipLinks()"
                                                    >
                                                        {{ link.label }}
                                                        <a
                                                            class="kanade-vg-stub-creator-external-link"
                                                            v-if="link.url"
                                                            :href="link.url"
                                                            rel="noopener noreferrer"
                                                            target="_blank"
                                                        >
                                                            {{ link.value }}
                                                            <cdx-icon
                                                                aria-hidden="true"
                                                                class="kanade-vg-stub-creator-external-link-icon"
                                                                :icon="
                                                                    externalLinkIcon
                                                                "
                                                                size="x-small"
                                                            ></cdx-icon>
                                                        </a>
                                                        <span v-else>{{
                                                            link.value
                                                        }}</span>
                                                    </span>
                                                </span>
                                            </template>
                                            <template v-else>{{
                                                getWikidataStatusText()
                                            }}</template>
                                        </template>
                                    </cdx-field>
                                </div>
                            </div>
                        </div>
                        <template v-if="group.key === 'metadata'">
                            <div class="kanade-vg-stub-creator-related-toolbar">
                                <cdx-button
                                    type="button"
                                    :disabled="
                                        categoryState.loading ||
                                        reviewState.loading
                                    "
                                    @click="refreshRelatedItems(true)"
                                    >{{ msg('review.refresh') }}</cdx-button
                                >
                                <cdx-button
                                    type="button"
                                    @click="rebuildCategoryRows"
                                    >{{
                                        msg('form.resetCategories')
                                    }}</cdx-button
                                >
                                <cdx-button
                                    type="button"
                                    @click="resetStubTagRows"
                                    >{{ msg('form.resetStubTags') }}</cdx-button
                                >
                                <cdx-button
                                    type="button"
                                    @click="rebuildNavboxRows"
                                    >{{ msg('form.resetNavboxes') }}</cdx-button
                                >
                            </div>
                            <cdx-message
                                type="error"
                                v-if="categoryState.error"
                                >{{ categoryState.error }}</cdx-message
                            >
                            <cdx-message
                                type="error"
                                v-if="reviewState.error"
                                >{{ reviewState.error }}</cdx-message
                            >
                        </template>
                        <cdx-card
                            class="kanade-vg-stub-creator-preview-card"
                            v-if="group.previewKey &amp;&amp; getGroupPreview(group)"
                        >
                            <template v-slot:title>
                                {{ msg('preview.wikitext') }}
                            </template>
                            <template v-slot:supporting-text>
                                <pre
                                    class="kanade-vg-stub-creator-preview-card-text"
                                    >{{ getGroupPreview(group) }}</pre>
                            </template>
                        </cdx-card>
                        <cdx-card
                            class="kanade-vg-stub-creator-preview-card"
                            v-if="group.fullTextReview &amp;&amp; getProseWikitext()"
                        >
                            <template v-slot:title>
                                {{ msg('preview.fullText') }}
                            </template>
                            <template v-slot:supporting-text>
                                <p
                                    class="kanade-vg-stub-creator-preview-card-description"
                                >
                                    {{ getProseReviewDescription() }}
                                </p>
                                <pre
                                    class="kanade-vg-stub-creator-preview-card-text"
                                    >{{ getProseWikitext() }}</pre>
                            </template>
                        </cdx-card>
                    </template>
                    <template v-if="group.citationReview">
                        <cdx-tabs
                            v-if="form.citationRows.length"
                            v-bind:key="getCitationTabsKey(form.citationRows)"
                            v-model:active="activeCitationTab"
                        >
                            <cdx-tab
                                class="kanade-vg-stub-creator-citation"
                                v-bind:key="citation.sourceUrl"
                                v-bind:label="getCitationTabLabel(citation)"
                                v-bind:name="
                                    getCitationTabName(citation, citationIndex)
                                "
                                v-for="(
                                    citation, citationIndex
                                ) in form.citationRows"
                            >
                                <cdx-table
                                    v-bind:caption="
                                        getCitationTabLabel(citation)
                                    "
                                    v-bind:columns="citationTableColumns"
                                    v-bind:data="
                                        getCitationParamTableRows(citation)
                                    "
                                >
                                    <template v-slot:header>
                                        <cdx-button
                                            :aria-label="
                                                msg('references.refetchAction')
                                            "
                                            class="kanade-vg-stub-creator-icon-button"
                                            :title="msg('references.refetch')"
                                            type="button"
                                            weight="quiet"
                                            @click="
                                                refetchCitation(citationIndex)
                                            "
                                        >
                                            <cdx-icon
                                                v-bind:icon="
                                                    tableActionIcons.regenerate
                                                "
                                                size="medium"
                                            ></cdx-icon>
                                        </cdx-button>
                                        <cdx-button
                                            :aria-label="msg('common.clean')"
                                            class="kanade-vg-stub-creator-icon-button"
                                            :title="msg('common.clean')"
                                            type="button"
                                            weight="quiet"
                                            @click="
                                                cleanCitationParams(
                                                    citationIndex,
                                                )
                                            "
                                        >
                                            <cdx-icon
                                                v-bind:icon="
                                                    tableActionIcons.clean
                                                "
                                                size="medium"
                                            ></cdx-icon>
                                        </cdx-button>
                                        <cdx-button
                                            :aria-label="
                                                msg('references.addParameter')
                                            "
                                            class="kanade-vg-stub-creator-icon-button"
                                            :title="
                                                msg('references.addParameter')
                                            "
                                            type="button"
                                            weight="quiet"
                                            @click="
                                                addCitationParam(citationIndex)
                                            "
                                        >
                                            <cdx-icon
                                                v-bind:icon="
                                                    tableActionIcons.cdxIconArticleAdd
                                                "
                                                size="medium"
                                            ></cdx-icon>
                                        </cdx-button>
                                    </template>
                                    <template v-slot:item-name="{ row }">
                                        <cdx-text-input
                                            :aria-label="
                                                msg('references.parameter')
                                            "
                                            :placeholder="
                                                msg('references.parameterName')
                                            "
                                            v-bind:model-value="row.param.name"
                                            v-on:change="
                                                sortCitation(citationIndex)
                                            "
                                            v-on:update:model-value="
                                                updateCitationParam(
                                                    citationIndex,
                                                    row.index,
                                                    'name',
                                                    $event,
                                                )
                                            "
                                        ></cdx-text-input>
                                    </template>
                                    <template v-slot:item-value="{ row }">
                                        <cdx-text-input
                                            :aria-label="msg('common.value')"
                                            :placeholder="msg('common.value')"
                                            v-bind:model-value="row.param.value"
                                            v-on:change="
                                                sortCitation(citationIndex)
                                            "
                                            v-on:update:model-value="
                                                updateCitationParam(
                                                    citationIndex,
                                                    row.index,
                                                    'value',
                                                    $event,
                                                )
                                            "
                                        ></cdx-text-input>
                                    </template>
                                    <template v-slot:item-actions="{ row }">
                                        <cdx-button
                                            :aria-label="msg('common.reset')"
                                            class="kanade-vg-stub-creator-icon-button"
                                            :title="msg('common.reset')"
                                            type="button"
                                            weight="quiet"
                                            v-if="row.index &lt; citation.params.length"
                                            @click="
                                                resetCitationParam(
                                                    citationIndex,
                                                    row.index,
                                                )
                                            "
                                        >
                                            <cdx-icon
                                                v-bind:icon="
                                                    tableActionIcons.regenerate
                                                "
                                                size="medium"
                                            ></cdx-icon>
                                        </cdx-button>
                                        <cdx-button
                                            :aria-label="msg('common.remove')"
                                            action="destructive"
                                            class="kanade-vg-stub-creator-icon-button"
                                            :title="msg('common.remove')"
                                            type="button"
                                            weight="quiet"
                                            v-if="row.index &lt; citation.params.length"
                                            @click="
                                                removeCitationParam(
                                                    citationIndex,
                                                    row.index,
                                                )
                                            "
                                        >
                                            <cdx-icon
                                                v-bind:icon="
                                                    tableActionIcons.remove
                                                "
                                                size="medium"
                                            ></cdx-icon>
                                        </cdx-button>
                                    </template>
                                    <template #footer>
                                        <a
                                            class="kanade-vg-stub-creator-external-link"
                                            v-bind:href="citation.sourceUrl"
                                            rel="noopener noreferrer"
                                            target="_blank"
                                        >
                                            {{ citation.sourceUrl }}
                                            <cdx-icon
                                                aria-hidden="true"
                                                class="kanade-vg-stub-creator-external-link-icon"
                                                :icon="externalLinkIcon"
                                                size="x-small"
                                            ></cdx-icon>
                                        </a>
                                    </template>
                                </cdx-table>
                            </cdx-tab>
                        </cdx-tabs>
                        <cdx-message
                            class="kanade-vg-stub-creator-message"
                            type="error"
                            v-if="citationState.error"
                        >
                            {{ citationState.error }}
                        </cdx-message>
                    </template>
                </cdx-tab>
            </cdx-tabs>
            <div
                class="kanade-vg-stub-creator-dialog-mask"
                v-if="previewLoading"
            >
                <div class="kanade-vg-stub-creator-dialog-mask-panel">
                    <cdx-progress-bar
                        :aria-label="msg('preview.preparing')"
                    ></cdx-progress-bar>
                    <p class="kanade-vg-stub-creator-dialog-mask-text">
                        {{ previewLoadingMessage }}
                    </p>
                </div>
            </div>
        </div>
        <cdx-message
            class="kanade-vg-stub-creator-message"
            type="error"
            v-if="sourceFetchState.error"
        >
            {{ sourceFetchState.error }}
        </cdx-message>
        <template #footer>
            <div class="kanade-vg-stub-creator-dialog-footer">
                <div
                    v-if="!compactActions"
                    class="kanade-vg-stub-creator-dialog-footer-peer-actions"
                >
                    <cdx-menu-button
                        :disabled="sourceFetchState.loading"
                        :menu-items="mainActionMenuItems"
                        v-model:selected="mainActionMenuSelection"
                        @update:selected="handleMainActionSelect"
                    >
                        {{ msg('form.more') }}
                    </cdx-menu-button>
                </div>
                <div class="kanade-vg-stub-creator-dialog-footer-actions">
                    <cdx-button
                        v-if="compactActions"
                        type="button"
                        action="progressive"
                        :disabled="sourceFetchState.loading || previewLoading"
                        weight="primary"
                        @click="submitForm"
                    >
                        {{
                            previewLoading
                                ? msg('preview.preparing')
                                : sourceFetchState.loading
                                  ? msg('form.loading')
                                  : msg('form.review')
                        }}
                    </cdx-button>
                    <cdx-button type="button" @click="closeDialog">
                        {{ msg('common.close') }}
                    </cdx-button>
                    <cdx-button
                        v-if="!compactActions"
                        type="button"
                        action="progressive"
                        :disabled="sourceFetchState.loading || previewLoading"
                        weight="primary"
                        @click="submitForm"
                    >
                        {{
                            previewLoading
                                ? msg('preview.preparing')
                                : sourceFetchState.loading
                                  ? msg('form.loading')
                                  : msg('form.review')
                        }}
                    </cdx-button>
                </div>

                <div
                    v-if="compactActions"
                    class="kanade-vg-stub-creator-dialog-footer-peer-actions"
                >
                    <cdx-menu-button
                        :disabled="sourceFetchState.loading"
                        :menu-items="mainActionMenuItems"
                        v-model:selected="mainActionMenuSelection"
                        @update:selected="handleMainActionSelect"
                    >
                        {{ msg('form.more') }}
                    </cdx-menu-button>
                </div>
            </div>
        </template>
    </cdx-dialog>
</template>
