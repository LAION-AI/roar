#!/bin/sh
# Build both editions of a ROAR paper without make.
#   ./build.sh [paper]          (default: paper, i.e. paper.tex)
# Produces <paper>-human.pdf, <paper>-agent.pdf and <paper>-agent.roar.json, and the agent
# edition as plain text, <paper>-agent.txt (needs pdftotext from poppler).
set -eu
PAPER="${1:-paper}"

if command -v latexmk >/dev/null 2>&1; then
  latexmk -pdf -interaction=nonstopmode -halt-on-error -jobname="$PAPER-human" "$PAPER.tex"
  latexmk -pdf -interaction=nonstopmode -halt-on-error -jobname="$PAPER-agent" \
    -usepretex='\def\roarmode{agent}' "$PAPER.tex"
else
  # Plain pdflatex + bibtex, three passes for references and page numbers.
  for EDITION in human agent; do
    JOB="$PAPER-$EDITION"
    PRE=""
    [ "$EDITION" = agent ] && PRE='\def\roarmode{agent}'
    pdflatex -interaction=nonstopmode -halt-on-error -jobname="$JOB" "$PRE\\input{$PAPER}"
    bibtex "$JOB" || true
    pdflatex -interaction=nonstopmode -halt-on-error -jobname="$JOB" "$PRE\\input{$PAPER}"
    pdflatex -interaction=nonstopmode -halt-on-error -jobname="$JOB" "$PRE\\input{$PAPER}"
  done
fi
# The agent edition is plain text; the PDF is the same text, rendered.
if command -v pdftotext >/dev/null 2>&1; then
  pdftotext -enc UTF-8 -nopgbrk "$PAPER-agent.pdf" - \
    | sed -E '/^ROAR 2027 .* agent edition$/d; /^page [0-9]+ of [0-9]+$/d' > "$PAPER-agent.txt"
else
  echo "pdftotext not found (poppler-utils; on macOS: brew install poppler): $PAPER-agent.txt not written" >&2
fi
echo "Built $PAPER-human.pdf, $PAPER-agent.pdf, $PAPER-agent.txt and $PAPER-agent.roar.json"
