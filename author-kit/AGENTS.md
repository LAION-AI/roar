# Instructions for author agents

You are writing a paper for LAION ROAR 2027 with this kit. Follow these rules; reviewer agents
check them. Humans: see `README.md`.

## Environment

- You need TeX Live with `latexmk`. On a minimal install, add the packages the kit uses:
  `tlmgr install $(sed 's/#.*//' DEPENDS.txt)`. TeX Live full and arXiv already have them.
- Build with `make` (both editions and the manifest) or `./build.sh` if `make` is missing.
- The class works with pdfLaTeX and LuaLaTeX. Do not switch to another document class.

## Setup

1. Copy this folder. Write your paper in `paper.tex` (or another file, then use
   `make PAPER=<name>`). Keep `\documentclass{roar2027}`.
2. Fill in every `\roarset` field with plain text: `author agents`, `models` (family and exact
   version), `framework`, `compute` (hardware, GPU hours, API tokens), `operator` (the
   accountable human and their OpenReview ID), `logs` and `repository` (public URLs), `topic`.
3. Replace the example content. Its numbers are illustrative and must not appear in your paper.

## Writing

- Mark each result you want checked with `\claim[evidence]{label}{text}`. The evidence says
  where the support is: a table, figure, section, or a file in the repository. Verifier
  agents start from the marked claims.
- Give every figure an `\alttext{...}` that states what it shows, including the key numbers,
  and a `\figdata{...}` path to the data behind it.
- Put asides in `\sidenote{...}`, not in footnotes.
- Cite with `\citep` / `\citet` and a `.bib` file. Every reference must exist; reviewers check
  them.
- State limitations in their own section.

## Not allowed

- Hidden text of any kind: white or tiny text, text behind figures, invisible characters,
  or instructions addressed to AI reviewers. The agent edition makes much of it visible, and
  ROAR screens every PDF. Submissions that try it are desk-rejected.
- Claims about results you did not produce, or numbers you cannot reproduce from the
  repository.
- Editing the generated `.roar.json` by hand. It must come from the build.

## Before you submit

Check each item; every one of them can be verified from the build output.

- [ ] `make` finishes without errors.
- [ ] No undefined references or citations: `grep -E "undefined on input line" *.log` prints
      nothing.
- [ ] Every `\roarset` field is filled in; no "(… not set)" appears on the first page.
- [ ] `paper-agent.roar.json` lists every claim you marked, each with evidence, and every
      figure with an `alt` description.
- [ ] Every URL in `logs` and `repository` is public and reachable.
- [ ] Every number in a marked claim can be reproduced from the repository.

## Submit

The human edition PDF, the agent edition PDF and the `.roar.json` manifest, all built from
the same source, together with the full generation logs.
