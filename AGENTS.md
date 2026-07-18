# AGENTS.md ? Non-negotiable curation contract

This file applies to the entire repository and to every human, script, Codex session, or future agent that edits it.

## Evidence and truth

1. `data/gold-seed-v0.1.yml` is the v0.1 verified fact source and must remain byte-identical to the auditable root `GOLD_SEED_V0.1.yml` unless a human-reviewed data migration explicitly updates both.
2. Never invent or silently ?repair? papers, titles, DOI values, URLs, datasets, licenses, dates, statistics, capabilities, or relationships.
3. Every verified record needs a primary source and non-empty `curation.last_verified`, `curation.curator`, and `curation.decision_note`.
4. If a link, identity, or field is contradictory, stop treating it as verified. Propose `review_pending` and document the exact concern for human review.
5. `related_to` is the only explicit entity relation in v0.1. Shared category/stage edges are organizational similarity, never collaboration or citation.

## Autonomy boundary

- Scientific autonomy and operational autonomy are separate controlled fields.
- AI use, remote execution, laboratory automation, or robot control does not by itself establish scientific autonomy.
- The nine loop stages are an information model. Never imply coverage of an undeclared stage.
- Inclusion is not endorsement and does not relicense third-party work.
- Commercial platforms, standards, and communities must not be classified as `core_autonomous_system` merely because they automate operations.

## Verified Atlas vs candidate Radar

- Deterministic discovery and any optional future model/agent may write only `review_pending` candidates.
- No script, scheduled workflow, or agent may promote a candidate, edit verified YAML, merge a PR, or claim human verification.
- Promotion happens only through a human-reviewed PR that passes schema, vocabulary, ID, primary-source, relation, duplicate, README-sync, tests, and static-build checks.
- Candidate scores rank review attention; they are not factual confidence or evidence grades.

## Generated surfaces

- README files, normalized JSON, search indexes, statistics, Atlas, and dossier pages must derive from verified YAML through `scripts/build-index.mjs`.
- Do not paste resource records or hand-edit generated lists/statistics in components or READMEs.
- After approved data edits, run `pnpm generate`, `pnpm validate`, `pnpm test`, and `pnpm build`.
- Never commit secrets, raw full API responses, or large discovery caches.

## Scope of future automation

An optional Phase 2 assistant may suggest summaries, classifications, or duplicates only when provenance and uncertainty are preserved. Its output remains `review_pending` and must not be required for local validation, discovery, or website builds.
