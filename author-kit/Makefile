# LAION ROAR 2027 author kit: build both editions of a paper from one source.
#   make            human + agent edition (and the .roar.json manifest)
#   make human      paper-human.pdf
#   make agent      paper-agent.pdf + paper-agent.roar.json
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

agent:
	$(LATEXMK) -jobname=$(PAPER)-agent -usepretex='\def\roarmode{agent}' $(PAPER).tex

review:
	$(LATEXMK) -jobname=$(PAPER)-review -usepretex='\def\roarreview{}' $(PAPER).tex

check: all
	$(PYTHON) roar_check.py --paper $(PAPER)

clean:
	for job in human agent review; do latexmk -C -jobname=$(PAPER)-$$job $(PAPER).tex; done
	rm -f $(PAPER)-*.roar.json $(PAPER)-*.bbl
