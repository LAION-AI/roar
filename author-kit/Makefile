# LAION ROAR 2027 author kit: build both editions of a paper from one source.
#   make            human + agent edition (and the .roar.json manifest)
#   make human      paper-human.pdf
#   make agent      paper-agent.pdf + paper-agent.roar.json, and paper-agent.txt (needs pdftotext)
#   make review     human edition with line numbers
#   make check      build, then check the submission with roar_check.py
#   make clean      remove build files
# Use another file name with: make PAPER=mypaper

PAPER   ?= paper
LATEXMK ?= latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error
PYTHON  ?= python3

.PHONY: all human agent review check clean

all: human agent

human:
	$(LATEXMK) -jobname=$(PAPER)-human $(PAPER).tex

# The agent edition is plain text: paper-agent.txt. The PDF is the same text, rendered.
agent:
	$(LATEXMK) -jobname=$(PAPER)-agent -usepretex='\def\roarmode{agent}' $(PAPER).tex
	@if command -v pdftotext >/dev/null 2>&1; then \
	  pdftotext -enc UTF-8 -nopgbrk $(PAPER)-agent.pdf - \
	    | sed -E '/^ROAR 2027 .* agent edition$$/d; /^page [0-9]+ of [0-9]+$$/d' > $(PAPER)-agent.txt; \
	  echo "Wrote $(PAPER)-agent.txt"; \
	else \
	  echo "pdftotext not found (poppler-utils; on macOS: brew install poppler): $(PAPER)-agent.txt not written" >&2; \
	fi

review:
	$(LATEXMK) -jobname=$(PAPER)-review -usepretex='\def\roarreview{}' $(PAPER).tex

check: all
	$(PYTHON) roar_check.py --paper $(PAPER)

clean:
	for job in human agent review; do latexmk -C -jobname=$(PAPER)-$$job $(PAPER).tex; done
	rm -f $(PAPER)-*.roar.json $(PAPER)-*.bbl $(PAPER)-agent.txt
