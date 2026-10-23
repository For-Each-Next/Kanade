# Contributing

Last reviewed: 2026-10-17.

Start with [development](docs/development.md) for setup, coding conventions, tests,
distributions, and releases. Follow [documentation](docs/documentation.md) for
writing the project overview and each tool's guide. These shared policies apply
to every tool in this repository.

Read [architecture](docs/architecture.md) for ownership and
[UI guidelines](docs/ui-guidelines.md) for interaction conventions. The
[project README](README.md#tools) links each tool's behavior, configuration, and
screenshot references. Record notable changes and verification in the owning
tool's architecture guide.

Kanade currently has no configured remote, public issue tracker, or named
maintainer. Arrange review with the project owner and keep a reproducible
report beside the proposed change until a project contact is established. Include
the tool, wiki, interface language, browser, expected behavior, and steps to
reproduce. Remove private drafts, account details, tokens, and other personal
information from reports. Follow the [maintenance guide](docs/maintenance.md)
for ownership, dependency risks, data handling, and handoff information.

## Where to start

- Check one installation or configuration walkthrough on a supported wiki and
  propose a correction with the exact step and expected result. Use read-only
  actions or offline fixtures while investigating.
- Improve a translated label in one of the five existing message catalogs,
  preserving interpolation keys and testing the affected layout.
- Add an offline regression case for a reported wikitext, date, or citation
  parsing problem in the affected tool's existing tests.

Before a broader feature or refactor, describe the user problem, the affected
owner, any existing Wikimedia capability that can be reused, and how the change
will be maintained. Keep the work scoped to the shared repository conventions.
Review and verification expectations, including recording substantial AI
assistance, are in [development](docs/development.md#verification-and-delivery).
