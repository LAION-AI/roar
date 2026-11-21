#!/bin/sh
# Build both editions of a ROAR paper without make.
#   ./build.sh [paper]          (default: paper, i.e. paper.tex)
# Produces <paper>-human.pdf, <paper>-agent.pdf and <paper>-agent.roar.json.
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
echo "Built $PAPER-human.pdf, $PAPER-agent.pdf and $PAPER-agent.roar.json"
