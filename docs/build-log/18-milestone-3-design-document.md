# Build Log 18: Milestone 3 Design Document and Diagram Sources

**Date:** Oct 23, 2026
**What exists after this entry:** The repository now holds the Milestone 3 design document in `docs/design/` and every diagram from it as its own Mermaid file in `docs/diagrams/`, as the assignment requires.

## Where this came from

The team's earlier Milestone 3 draft was written before the final requirements were pinned to the repository, so it described features the project does not have (user accounts, budgets, recurring charge detection, a hosted language model). The Milestone 2 SRS puts accounts, budgets and recurring detection explicitly out of scope, and the categorizer is a keyword model with a confidence score, not an external model. A design document that describes a different system than the one in the repository would fail its own traceability section, so the design was rebuilt from the SRS and the actual code.

## What was added

- `docs/design/milestone-3-design.md`: the 13 sections, using the real FR and NFR identifiers from the SRS in the traceability matrix.
- `docs/diagrams/`: ten Mermaid files (container, class, state, four sequence diagrams, ERD, deployment pipeline, categorization pipeline). Each is also embedded in the design document. The files are extracted from the document, so edit the document and re-extract, or edit both together.
- README links to the SRS, the design document and the diagrams.

## Checking the diagrams

All ten diagrams were rendered with the Mermaid command line tool to confirm they parse without syntax errors. Sequence diagrams use real `sequenceDiagram` notation with participants, lifelines, ordered messages, `alt` and `loop` blocks, and notes giving the use case, preconditions and requirement IDs.

## Team contributions and tag

Section 13 records the team's agreed split: AJ Rayamajhi 35%, Ayush Gaire 35%, Sujal Rao 15%, Abdul Mughees 15%, with each member's sections and diagrams listed. The two Milestone 2 diagrams were also extracted into `docs/diagrams/` so every diagram has a source file, and a README there maps each file to its document. The `milestone-3` tag was created and pushed.

## Still open

- The section headings follow the thirteen part structure from the earlier draft. They should be compared against the professor's exact heading list before submission.
- The tag was created before the contributions section was finalized, so it must be moved to the newest commit before submission.
