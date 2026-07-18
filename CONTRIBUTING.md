# Contributing

Thank you for helping make autonomous biology easier to navigate and harder to overclaim.

## Propose a resource

Open the resource-proposal issue form first. Provide a primary paper, official repository, dataset, standard, or platform page; direct biology relevance; an evidence-bounded summary; and separate scientific/operational autonomy suggestions. Search DOI, canonical URL, and title before submitting.

Automated discoveries and unreviewed proposals remain `review_pending`. Only a maintainer-reviewed pull request can add verified data.

## Data pull requests

1. Edit the verified YAML only when a curator has approved the evidence.
2. Use one of the 21 controlled primary categories and existing controlled values.
3. Assert only loop stages supported by primary evidence.
4. Preserve title, DOI, source, license warnings, and capability boundaries.
5. Supply English and Chinese summaries, a Chinese boundary note, and complete curation audit fields.
6. Run:

```bash
pnpm install
pnpm generate
pnpm validate
pnpm test
pnpm build
```

Commit the generated README and JSON changes together with the YAML change.

## Code pull requests

Keep the site fully static and compatible with the configured GitHub Pages base path. Use progressive enhancement, visible keyboard focus, semantic HTML, sufficient contrast, and `prefers-reduced-motion`. Do not introduce services that require browser-side secrets.

## Licensing

By contributing original software, you agree to license it under MIT. By contributing original curation metadata or bilingual summaries, you agree to license those contributions under CC BY 4.0. This does not alter third-party rights.
