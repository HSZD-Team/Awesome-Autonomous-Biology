# Curation method

## Scope gate

A record must have direct biology-specific relevance and help complete one or more stages of a biological discovery loop. Generic agents, robots, or automation platforms are out of scope unless their biological function is evidenced.

## Review order

1. **Identity:** title, DOI, canonical URL, authors/project identity, and duplicates.
2. **Primary evidence:** at least one primary paper, official implementation/data source, standard, or platform page.
3. **Category:** exactly one controlled primary category answering ?what is it??
4. **Loop coverage:** only explicitly evidenced stages.
5. **Autonomy:** independently assess scientific and operational levels.
6. **Openness/license:** quote uncertainty as a warning; do not guess or give legal advice.
7. **Boundary:** record the narrowest defensible capability interpretation.
8. **Audit:** curator identity, verification date, decision note, and status.

## Evidence grades

- **A:** peer-reviewed primary evidence plus official implementation/data, or an official open standard with maintained implementation.
- **B:** primary peer-reviewed/preprint or strong official evidence, with incomplete implementation, data, or autonomy evidence.
- **C:** official commercial/community source only; useful ecosystem evidence with limited independent reproducibility.

## Promotion and demotion

Discovery never promotes. A curator may promote through a reviewed PR after every gate passes. A verified record with an unresolved broken primary source, identity conflict, or material field contradiction must be proposed for `review_pending` with the issue documented; do not silently rewrite it.

## Duplicate policy

Compare DOI first, canonical URL second, and normalized title third. System/data companions may remain distinct only when the relationship and separate entity roles are explicit through stable IDs.
