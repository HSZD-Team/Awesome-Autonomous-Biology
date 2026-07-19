# Graph data and Observatory methods

The homepage graph and Observatory are generated surfaces. They do not maintain a second hand-written resource list.

## Data flow

1. **data/gold-seed-v0.2.yml** remains the canonical v0.2 source.
2. **scripts/validate-data.mjs** enforces the canonical resource schema and curation contract.
3. **scripts/build-index.mjs** calls **scripts/lib/graph-data.mjs**.
4. The build writes graph.json and observatory.json to both **src/data/generated/** and **public/data/**.
5. Astro pages import the generated files at build time; external consumers may use the public copies.

Run pnpm generate after an approved canonical data change. Generated files must pass pnpm check:generated.

## Nodes

Every canonical record becomes one graph node. Missing optional links remain null. The graph does not infer organizations, dates, stars, citations, popularity, capabilities, or evidence.

Node size is based only on generated graph degree. Layout positions are deterministic and normalized for three modes:

- Ecosystem: five visual clusters with a protected central reading zone.
- Closed Loop: placement by the first declared loop stage only; all declared stages remain attached to the node.
- Timeline: asserted public year, with missing years placed in Undated.

The generated contract is documented in **schemas/graph.schema.json**.

## Edges

related_to is the only explicit entity relation. It is preserved as an explicit edge.

Optional shared_context edges are organizational similarity only. They use a deterministic score from:

- same primary category: 3.0
- each shared declared loop stage, capped at three: 0.65
- each shared biological domain, capped at two: 0.9
- same resource class: 0.4

The threshold is 3.8. Each node receives at most three inferred edges. These edges never mean collaboration, citation, dependency, endorsement, or scientific verification.

## Visual cluster mapping

The single mapping source is **src/config/categoryClusters.mjs**. It covers all 21 canonical categories exactly once:

- Scientific Intelligence
- Experiment & Execution
- Models, Data & Digital Biology
- Infrastructure, Tools & Standards
- Applications & Translation

Colors and mappings are consumed by the generator, homepage, Observatory, and Methods page.

## Observatory boundaries

Observatory counts are derived from canonical fields. Public-year distribution is not presented as repository additions. The canonical schema currently lacks ingestion timestamps, so 7-day and 30-day addition cards display an unavailable state.

Platform counts use declared resource types containing platform, laboratory, LabOS, or biofoundry. Curation activity uses curation.last_verified and is labeled as an audit date, not publication or ingestion.
