#!/usr/bin/env python3
"""roar check: is this LAION ROAR 2027 submission ready? (preview v0.1)

Checks the build of both editions, the claims manifest, the LaTeX source for hidden text, the
references and the generation log (see LOGS.md), and prints a report, or JSON with --json.
Exit code 0 means no errors. Uses only the Python standard library (3.8 or newer).

    python3 roar_check.py                       # paper.tex and generation-log.jsonl here
    python3 roar_check.py --paper mypaper --log logs/run.jsonl
    python3 roar_check.py --online              # also look references up on arXiv / Crossref
    python3 roar_check.py --json                # machine-readable report for agents
"""

import argparse
import gzip
import hashlib
import json
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

VERSION = "0.1"
OK, WARN, FAIL = "ok", "warn", "fail"


class Report:
    def __init__(self):
        self.items = []
        self.section = ""

    def start(self, name):
        self.section = name

    def add(self, status, message, details=None):
        self.items.append({"section": self.section, "status": status, "message": message,
                           "details": list(details or [])})

    def ok(self, message, details=None):
        self.add(OK, message, details)

    def warn(self, message, details=None):
        self.add(WARN, message, details)

    def fail(self, message, details=None):
        self.add(FAIL, message, details)

    def count(self, status):
        return sum(1 for i in self.items if i["status"] == status)

    def print_text(self, paper):
        symbols = {OK: "\u2713", WARN: "!", FAIL: "\u2717"}
        print(f"roar check {VERSION} \u00b7 {paper}.tex\n")
        section = None
        for item in self.items:
            if item["section"] != section:
                section = item["section"]
                print(section)
            print(f"  {symbols[item['status']]} {item['message']}")
            for d in item["details"][:8]:
                print(f"      {d}")
            if len(item["details"]) > 8:
                print(f"      \u2026 and {len(item['details']) - 8} more")
        errors, warnings = self.count(FAIL), self.count(WARN)
        print(f"\n{errors} error{'s' * (errors != 1)}, {warnings} warning{'s' * (warnings != 1)}"
              + (": ready to submit" if not errors else ": fix the errors before you submit"))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def line_of(text, pos):
    return text.count("\n", 0, pos) + 1


# ------------------------------------------------------------------ build
def check_build(r, d, paper):
    r.start("Build")
    tex = d / f"{paper}.tex"
    pdfs = [d / f"{paper}-human.pdf", d / f"{paper}-agent.pdf"]
    missing = [p.name for p in pdfs if not p.exists()]
    if missing:
        r.fail("Both editions must be built (run make)", missing)
    else:
        r.ok("Human and agent editions are built")
        if tex.exists() and any(p.stat().st_mtime < tex.stat().st_mtime for p in pdfs):
            r.warn(f"{tex.name} changed after the last build; run make again")

    human_m, agent_m = d / f"{paper}-human.roar.json", d / f"{paper}-agent.roar.json"
    if human_m.exists() and agent_m.exists():
        try:
            a = json.loads(human_m.read_text(encoding="utf-8"))
            b = json.loads(agent_m.read_text(encoding="utf-8"))
            # Each edition has its own layout, so claims may sit on different pages.
            for m in (a, b):
                m.pop("edition", None)
                for claim in m.get("claims") or []:
                    if isinstance(claim, dict):
                        claim.pop("page", None)
            if a == b:
                r.ok("Both editions come from the same source (their manifests match)")
            else:
                diff = sorted(k for k in set(a) | set(b) if a.get(k) != b.get(k))
                r.fail("The editions were built from different versions; rebuild both", diff)
        except json.JSONDecodeError:
            pass  # reported in the manifest section

    problems, overfull = [], []
    for log in (d / f"{paper}-human.log", d / f"{paper}-agent.log"):
        if not log.exists():
            continue
        text = log.read_text(encoding="latin-1")
        for line in text.splitlines():
            if re.search(r"LaTeX Error|undefined on input line|There were undefined (?:references|citations)", line):
                problems.append(f"{log.name}: {line.strip()[:110]}")
        overfull += [float(x) for x in re.findall(r"Overfull \\hbox \(([\d.]+)pt too wide\)", text)]
    if problems:
        r.fail("LaTeX errors or undefined references or citations in the last build", problems)
    elif (d / f"{paper}-human.log").exists():
        r.ok("No LaTeX errors, undefined references or undefined citations")
    wide = sorted((w for w in overfull if w > 10), reverse=True)
    if wide:
        r.warn(f"{len(wide)} line(s) stick out into the margin by more than 10pt",
               [f"{w:.1f}pt too wide" for w in wide])


# ------------------------------------------------------------------ manifest
NOT_SET = re.compile(r"\(.*not set\)")
FIELDS = ["title", "author_agents", "models", "framework", "compute", "operator", "steering",
          "humans", "logs", "repository", "topic", "license"]
# Work the agent does: an instruction after the first of these was given while it worked.
AGENT_WORK = ("message", "tool_call", "tool_result", "file", "compute")


def check_manifest(r, d, paper):
    r.start("Manifest")
    path = d / f"{paper}-agent.roar.json"
    if not path.exists():
        r.fail(f"{path.name} is missing (make agent writes it)")
        return None
    try:
        m = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        r.fail(f"{path.name} is not valid JSON", [str(e)])
        return None
    if m.get("schema") != "roar-2027-paper/0.1":
        r.fail("Unknown manifest schema", [str(m.get("schema"))])

    missing = [f for f in FIELDS if not str(m.get(f, "")).strip() or NOT_SET.search(str(m.get(f, "")))]
    if missing:
        r.fail("Metadata missing in \\roarset", missing)
    else:
        r.ok(f"Metadata complete ({len(FIELDS)} fields)")
    for key in ("logs", "repository"):
        value = str(m.get(key, ""))
        if value and not value.startswith("https://"):
            r.warn(f"'{key}' should be a public https:// URL", [value])
        elif "example.org" in value:
            r.warn(f"'{key}' still points to the example URL", [value])
    if str(m.get("status", "")).lower() == "example" or m.get("id") == "0001":
        r.warn("This is still the example paper (id 0001, status Example); set your own \\roarset")
    if len(str(m.get("abstract", "")).split()) < 50:
        r.warn("The abstract is shorter than 50 words")

    claims = [c for c in m.get("claims", []) if c]
    if not claims:
        r.fail("No claims are marked; mark each checkable result with \\claim")
    else:
        no_ev = [c["id"] for c in claims if not str(c.get("evidence", "")).strip()]
        no_page = [c["id"] for c in claims if not c.get("page")]
        if no_ev:
            r.fail("Claims without evidence (\\claim[evidence]{label}{text})", no_ev)
        if no_page:
            r.fail("Claims without a page (run make again)", no_page)
        if not no_ev and not no_page:
            r.ok(f"{len(claims)} claim(s), each with its evidence and page")

    figures = [f for f in m.get("figures", []) if f]
    short = [f"Figure {f.get('figure')}" for f in figures if len(str(f.get("alt", "")).split()) < 8]
    if short:
        r.fail("Figures without a real description (\\alttext, at least 8 words)", short)
    elif figures:
        r.ok(f"{len(figures)} figure(s), each with a description")
    for f in figures:
        data = str(f.get("data", ""))
        if data and not data.startswith("http") and not (d / data).exists():
            r.warn(f"Figure {f.get('figure')}: data file not found", [data])
    return m


# ------------------------------------------------------------------ hidden text
WHITE = r"(?:white|\s*1\s*,\s*1\s*,\s*1\s*|\s*255\s*,\s*255\s*,\s*255\s*|ffffff)"
ALWAYS_HIDDEN = [
    (r"\\(?:text)?color\s*(?:\[[^\]]*\])?\s*\{\s*white\s*\}", "white text"),
    (r"\btext\s*=\s*white\b", "white text (TikZ)"),
    (r"\\(?:text)?color\s*\{[^}!]*!\s*0*[0-5](?:\.\d+)?\s*\}", "colour mixed to (almost) nothing"),
    (r"\\pdfliteral|\\pdfextension\s*literal|\\special\s*\{\s*pdf:", "raw PDF operators"),
    (r"\\pdfrender\b|\\textrender\b", "invisible text rendering mode"),
]
SMALL = [
    (r"\\(?:tiny|scriptsize)\b", "very small text"),
    (r"\\[hv]?phantom\b", "\\phantom (invisible box)"),
]
INJECTION = [
    r"ignore (?:all |any )?(?:the )?(?:previous|prior|above|earlier) instructions",
    r"disregard (?:all |any )?(?:the )?(?:previous|prior|above) ",
    r"\byou are (?:an? |the )?(?:ai|language model|llm|large language model|reviewer)\b",
    r"\b(?:as|to) (?:an? |the )?(?:ai|llm) reviewer",
    r"(?:give|assign) (?:this|the) (?:paper|submission) (?:a |an )?(?:high|top|perfect|maximum|positive)",
    r"(?:accept|recommend accepting) this (?:paper|submission)",
    r"(?:rate|score) this (?:paper|submission)",
    r"do not (?:mention|reveal|report) (?:this|any|the)",
    r"system prompt",
]
ZERO_WIDTH = re.compile("[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]")


def strip_comments(tex):
    # Blank out comments but keep the lines, so line numbers stay right.
    return "\n".join(re.sub(r"(?<!\\)%.*", "", line) for line in tex.splitlines())


def hidden_in(tex):
    found = []
    for pattern, what in ALWAYS_HIDDEN:
        for m in re.finditer(pattern, tex, re.I):
            found.append(f"line {line_of(tex, m.start())}: {what}: {m.group(0).strip()[:60]}")
    # Colours defined as white, then used for text.
    names = set(re.findall(r"\\definecolor\s*\{([^}]+)\}\s*\{\s*(?:rgb|RGB|HTML)\s*\}\s*\{" + WHITE + r"\}", tex, re.I))
    names |= set(re.findall(r"\\colorlet\s*\{([^}]+)\}\s*\{\s*white\s*\}", tex, re.I))
    for name in names:
        for m in re.finditer(r"\\(?:text)?color\s*\{\s*" + re.escape(name) + r"\s*\}", tex):
            found.append(f"line {line_of(tex, m.start())}: white text via the colour '{name}'")
    for m in re.finditer(r"(?<!fill )(?<!draw )\b(?:text )?opacity\s*=\s*(\d*\.?\d+)", tex):
        if float(m.group(1)) < 0.1:
            found.append(f"line {line_of(tex, m.start())}: (almost) transparent: {m.group(0)}")
    for m in re.finditer(r"\\transparent\s*\{\s*(\d*\.?\d+)\s*\}", tex):
        if float(m.group(1)) < 0.1:
            found.append(f"line {line_of(tex, m.start())}: (almost) transparent: {m.group(0)}")
    for m in re.finditer(r"\\fontsize\s*\{\s*(\d*\.?\d+)\s*(pt|bp|mm)?\s*\}", tex):
        size = float(m.group(1)) * (2.845 if m.group(2) == "mm" else 1)
        if size < 4:
            found.append(f"line {line_of(tex, m.start())}: font size below 4pt: {m.group(0)}")
    for m in re.finditer(r"\\scalebox\s*\{\s*(\d*\.?\d+)\s*\}", tex):
        if float(m.group(1)) < 0.1:
            found.append(f"line {line_of(tex, m.start())}: scaled to (almost) nothing: {m.group(0)}")
    for m in re.finditer(r"\\resizebox\s*\*?\s*\{\s*(\d*\.?\d+)?\s*(pt|bp|mm|cm|\\[a-z]+)?\s*\}", tex):
        value = float(m.group(1)) if m.group(1) else 1.0
        unit = m.group(2) or ""
        too_small = value == 0 or (unit.startswith("\\") and value < 0.05) \
            or (unit in ("pt", "bp") and value < 4) or (unit == "mm" and value < 1.5) \
            or (unit == "cm" and value < 0.15)
        if too_small:
            found.append(f"line {line_of(tex, m.start())}: resized to (almost) nothing: {m.group(0)}")
    return found


def check_source(r, d, paper):
    r.start("Hidden text")
    tex_path = d / f"{paper}.tex"
    if not tex_path.exists():
        r.fail(f"{tex_path.name} not found")
        return
    raw = tex_path.read_text(encoding="utf-8", errors="replace")
    tex = strip_comments(raw)
    found = hidden_in(tex)
    for m in ZERO_WIDTH.finditer(raw):
        found.append(f"line {line_of(raw, m.start())}: invisible character U+{ord(m.group(0)):04X}")
    found.sort(key=lambda s: int(re.match(r"line (\d+)", s).group(1)))
    if found:
        r.fail("Hidden text in the LaTeX source; this is grounds for desk rejection", found)
    else:
        r.ok("No hidden-text techniques in the LaTeX source")

    small = [f"line {line_of(tex, m.start())}: {what}" for p, what in SMALL for m in re.finditer(p, tex)]
    if small:
        r.warn("Text that may be hard to see; make sure everything a reader needs is visible", small)

    texts = [("source", tex)]
    pdf = d / f"{paper}-human.pdf"
    if pdf.exists() and shutil.which("pdftotext"):
        out = subprocess.run(["pdftotext", "-enc", "UTF-8", str(pdf), "-"], capture_output=True,
                             text=True, encoding="utf-8", errors="replace")
        texts.append(("PDF", out.stdout))
    hits = []
    for where, text in texts:
        flat = re.sub(r"\s+", " ", text.lower())
        for p in INJECTION:
            for m in re.finditer(p, flat):
                hits.append(f"{where}: \u201c\u2026{flat[max(0, m.start() - 30):m.end() + 30].strip()}\u2026\u201d")
    if hits:
        r.warn("Text that reads like an instruction to AI reviewers. If the paper quotes it as an"
               " example, keep it visible and explain it; otherwise remove it", hits)
    else:
        r.ok("No instructions addressed to AI reviewers"
             + ("" if len(texts) > 1 else " (in the source; install pdftotext to scan the PDF too)"))


# ------------------------------------------------------------------ references
def parse_fields(body):
    fields, i = {}, 0
    key_re, bare_re = re.compile(r"\s*,?\s*([A-Za-z][\w-]*)\s*=\s*"), re.compile(r"[^,]*")
    while True:
        m = key_re.match(body, i)
        if not m:
            break
        key, i = m.group(1).lower(), m.end()
        if body[i:i + 1] == "{":
            depth, j = 0, i
            while j < len(body):
                depth += {"{": 1, "}": -1}.get(body[j], 0)
                if depth == 0:
                    break
                j += 1
            value, i = body[i + 1:j], j + 1
        elif body[i:i + 1] == '"':
            j = body.find('"', i + 1)
            j = len(body) if j < 0 else j
            value, i = body[i + 1:j], j + 1
        else:
            m2 = bare_re.match(body, i)
            value, i = m2.group(0), m2.end()
        fields[key] = re.sub(r"\s+", " ", value.replace("{", "").replace("}", "")).strip()
    return fields


def parse_bib(text):
    entries = []
    for m in re.finditer(r"@(\w+)\s*\{\s*([^,\s]+)\s*,", text):
        if m.group(1).lower() in ("comment", "string", "preamble"):
            continue
        depth, j = 1, m.end()
        while j < len(text) and depth:
            depth += {"{": 1, "}": -1}.get(text[j], 0)
            j += 1
        entries.append((m.group(2), parse_fields(text[m.end():j - 1])))
    return entries


def arxiv_id(fields):
    eprint = fields.get("eprint", "")
    if re.fullmatch(r"\d{4}\.\d{4,5}(v\d+)?", eprint):
        return eprint
    for key in ("url", "journal", "note", "howpublished"):
        m = re.search(r"arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5})|arxiv:\s*(\d{4}\.\d{4,5})",
                      fields.get(key, ""), re.I)
        if m:
            return m.group(1) or m.group(2)
    return None


def words(s):
    return set(re.findall(r"[a-z0-9]+", s.lower()))


def lookup(fields):
    """The title of the record the reference's identifier points to, or None if there is none."""
    headers = {"User-Agent": f"roar-check/{VERSION} (LAION ROAR author kit)"}
    aid, doi = arxiv_id(fields), fields.get("doi")
    if aid:
        req = urllib.request.Request(f"https://export.arxiv.org/api/query?id_list={aid}", headers=headers)
        xml = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
        titles = re.findall(r"<entry>.*?<title>(.*?)</title>", xml, re.S)
        return re.sub(r"\s+", " ", titles[0]).strip() if titles else None
    if doi:
        req = urllib.request.Request(f"https://api.crossref.org/works/{urllib.parse.quote(doi)}", headers=headers)
        try:
            data = json.loads(urllib.request.urlopen(req, timeout=20).read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise
        return (data.get("message", {}).get("title") or [None])[0]
    return None


def check_references(r, d, online):
    r.start("References")
    bibs = sorted(d.glob("*.bib"))
    if not bibs:
        r.warn("No .bib file found")
        return
    entries = [e for b in bibs for e in parse_bib(b.read_text(encoding="utf-8", errors="replace"))]
    unverifiable = [k for k, f in entries if not (arxiv_id(f) or f.get("doi") or f.get("url"))]
    if unverifiable:
        r.warn("References without a DOI, arXiv ID or URL, so reviewers cannot check them", unverifiable)
    else:
        r.ok(f"All {len(entries)} references have a DOI, arXiv ID or URL")
    if not online:
        return
    bad, mismatch, checked = [], [], 0
    for key, f in entries:
        if not (arxiv_id(f) or f.get("doi")):
            continue
        try:
            found = lookup(f)
        except Exception as e:  # a network problem is not the paper's fault
            r.warn(f"Could not look up {key}", [str(e)[:100]])
            continue
        checked += 1
        if not found:
            bad.append(key)
        else:
            a, b = words(f.get("title", "")), words(found)
            if a and len(a & b) / max(1, len(a | b)) < 0.6:
                mismatch.append(f"{key}: the identifier points to \u201c{found[:80]}\u201d")
    if bad:
        r.fail("References whose arXiv ID or DOI does not exist", bad)
    if mismatch:
        r.warn("References whose title differs from the record their identifier points to", mismatch)
    if checked and not bad and not mismatch:
        r.ok(f"{checked} references found on arXiv or Crossref, with matching titles")


# ------------------------------------------------------------------ generation log
EVENT_FIELDS = {
    "instruction": ["content"],
    "message": ["model", "role"],
    "tool_call": ["call_id", "tool", "arguments"],
    "tool_result": ["call_id", "ok"],
    "file": ["path", "sha256", "bytes"],
    "compute": ["resource", "quantity", "unit"],
    "note": ["content"],
}
SECRETS = [
    (r"(?<![A-Za-z0-9])sk-ant-[A-Za-z0-9_-]{20,}", "Anthropic API key"),
    (r"(?<![A-Za-z0-9])sk-(?!ant-)(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{20,}", "API key (sk-\u2026)"),
    (r"(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}(?![A-Za-z0-9])", "AWS access key"),
    (r"(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{30,}", "GitHub token"),
    (r"(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{30,}", "GitHub token"),
    (r"(?<![A-Za-z0-9])AIza[0-9A-Za-z_-]{35}", "Google API key"),
    (r"(?<![A-Za-z0-9])hf_[A-Za-z0-9]{30,}", "Hugging Face token"),
    (r"(?<![A-Za-z0-9])xox[abpr]-[A-Za-z0-9-]{20,}", "Slack token"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "private key"),
]
TIMESTAMP = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?Z$")


def parse_time(value):
    m = TIMESTAMP.match(str(value))
    if not m:
        raise ValueError(value)
    return datetime.strptime(m.group(1), "%Y-%m-%dT%H:%M:%S"), float(m.group(2) or 0)


def read_log(r, path):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as f:
        raw = f.read()
    records, bad = [], []
    for n, line in enumerate(raw.splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
            if not isinstance(record, dict):
                raise ValueError("not a JSON object")
            records.append(record)
        except ValueError as e:
            bad.append(f"line {n}: {getattr(e, 'msg', e)}")
    if bad:
        r.fail("Lines that are not JSON objects", bad)
        return raw, None
    if len(records) < 2:
        r.fail("The log needs at least a header and a footer")
        return raw, None
    return raw, records


def check_log(r, d, paper, log_arg, manifest):
    r.start("Generation log")
    path = Path(log_arg)
    if not path.is_absolute():
        path = d / path
    if not path.exists() and path.with_name(path.name + ".gz").exists():
        path = path.with_name(path.name + ".gz")
    if not path.exists():
        r.fail(f"{path.name} not found: every submission needs its complete generation log (LOGS.md)")
        return
    raw, records = read_log(r, path)
    if records is None:
        return

    errors = []
    header, footer = records[0], records[-1]
    if header.get("type") != "header":
        errors.append("the first record must be the header")
    elif header.get("schema") != "roar-log/0.1":
        errors.append(f"header: schema should be roar-log/0.1, not {header.get('schema')!r}")
    for key in ("paper_id", "started", "framework", "models", "operator"):
        if key not in header:
            errors.append(f"header: '{key}' missing")
    models = {}
    for m in header.get("models") or []:
        if isinstance(m, dict) and all(m.get(k) for k in ("id", "family", "version")):
            models[m["id"]] = m
        else:
            errors.append("header: every model needs 'id', 'family' and 'version'")
    if footer.get("type") != "footer":
        errors.append("the last record must be the footer")
        footer = {}
    try:
        last_t = parse_time(header.get("started"))
    except ValueError:
        errors.append("header: 'started' must be a UTC timestamp like 2027-05-20T08:00:00Z")
        last_t = None

    events = records[1:-1] if footer else records[1:]
    calls, results, counts = set(), set(), {}
    tokens = {"input": 0, "output": 0}
    gpu_hours, redacted = 0.0, 0
    written, refs_missing = {}, []
    working, initial, during, human_words = False, 0, 0, 0
    for i, ev in enumerate(events, 1):
        kind = ev.get("type")
        counts[kind] = counts.get(kind, 0) + 1
        if kind == "instruction":
            during += working
            initial += not working
            human_words += len(str(ev.get("content", "")).split())
        elif kind in AGENT_WORK and not (kind == "message" and ev.get("role") in ("system", "user")):
            working = True
        where = f"seq {ev.get('seq', '?')} (line {i + 1})"
        if kind not in EVENT_FIELDS:
            errors.append(f"{where}: unknown type {kind!r}")
            continue
        if ev.get("seq") != i:
            errors.append(f"{where}: seq should be {i} (no gaps, no reordering)")
        try:
            t = parse_time(ev.get("t"))
            if last_t and t < last_t:
                errors.append(f"{where}: time goes backwards")
            last_t = t
        except ValueError:
            errors.append(f"{where}: 't' must be a UTC timestamp like 2027-05-20T08:00:00Z")
        for field in EVENT_FIELDS[kind]:
            if field not in ev:
                errors.append(f"{where}: '{field}' missing")
        if kind in ("message", "tool_result") and "content" not in ev and "content_ref" not in ev:
            errors.append(f"{where}: needs 'content' or 'content_ref'")
        if ev.get("redacted"):
            redacted += 1
        ref = ev.get("content_ref")
        if isinstance(ref, dict):
            ref_path = path.parent / str(ref.get("path", ""))
            if not ref_path.is_file():
                refs_missing.append(f"{where}: {ref.get('path')}")
            elif sha256(ref_path) != ref.get("sha256"):
                errors.append(f"{where}: {ref.get('path')} does not match its sha256")
        if kind == "message":
            if ev.get("model") not in models:
                errors.append(f"{where}: model {ev.get('model')!r} is not listed in the header")
            for k in tokens:
                tokens[k] += int((ev.get("tokens") or {}).get(k, 0) or 0)
        elif kind == "tool_call":
            calls.add(ev.get("call_id"))
        elif kind == "tool_result":
            if ev.get("call_id") not in calls:
                errors.append(f"{where}: result for an unknown call_id {ev.get('call_id')!r}")
            results.add(ev.get("call_id"))
        elif kind == "file":
            written[str(ev.get("path"))] = ev.get("sha256")
        elif kind == "compute" and ev.get("unit") == "gpu_hours":
            gpu_hours += float(ev.get("quantity") or 0)
    if footer:
        try:
            if last_t and parse_time(footer.get("finished")) < last_t:
                errors.append("footer: 'finished' is earlier than the last event")
        except ValueError:
            errors.append("footer: 'finished' must be a UTC timestamp like 2027-06-02T17:40:00Z")

    if errors:
        r.fail("The log does not follow roar-log/0.1 (LOGS.md)", errors)
    else:
        summary = ", ".join(f"{v} {k}" for k, v in sorted(counts.items()))
        r.ok(f"{len(records)} records, complete and in order ({summary})")
    if calls - results:
        r.warn("Tool calls without a result", sorted(str(c) for c in calls - results))
    if not counts.get("instruction"):
        r.warn("No human instructions in the log; every instruction a human gave the agent must be"
               " logged, including the first one")
    else:
        measured = "Steered" if during else "Autonomous"
        summary = (f"{initial + during} human instruction(s), {human_words} words: {initial} before"
                   f" the agent started, {during} while it worked")
        declared = str((manifest or {}).get("steering", "")).strip()
        if manifest and declared.lower() == "autonomous" and during:
            r.fail("The paper says steering = Autonomous, but humans instructed the agent while it"
                   " worked; set steering = Steered", [summary])
        elif manifest and declared.lower() == "steered" and not during:
            r.warn("The paper says steering = Steered, but the log has no instructions after the"
                   " agent started; it could be labelled Autonomous", [summary])
        else:
            r.ok(f"Human input: {measured}", [summary])
    if refs_missing:
        r.fail("Files the log refers to (content_ref) are missing; submit them with the log", refs_missing)
    if redacted:
        r.ok(f"{redacted} record(s) redacted, not deleted")

    totals = footer.get("totals") or {}
    off = []
    for k in ("input", "output"):
        stated = totals.get(f"{k}_tokens")
        if stated is not None and tokens[k] and abs(stated - tokens[k]) > 0.01 * max(stated, tokens[k]):
            off.append(f"{k}_tokens: the footer says {stated:,}, the messages add up to {tokens[k]:,}")
    stated = totals.get("gpu_hours")
    if stated is not None and gpu_hours and abs(stated - gpu_hours) > 0.01 * gpu_hours:
        off.append(f"gpu_hours: the footer says {stated:g}, the compute records add up to {gpu_hours:g}")
    if off:
        r.warn("The footer's totals do not match the events", off)

    # The log must end with exactly the submitted files, as the agent wrote them.
    outputs = [o for o in footer.get("outputs") or [] if isinstance(o, dict)]
    if not any(Path(str(o.get("path", ""))).name == f"{paper}.tex" for o in outputs):
        r.fail(f"The footer's 'outputs' must include {paper}.tex with its SHA-256")
    differ, unseen, outside, matched = [], [], [], []
    for out in outputs:
        name, digest = str(out.get("path", "")), out.get("sha256")
        f = d / name
        if not f.is_file():
            unseen.append(name)
            continue
        if sha256(f) != digest:
            differ.append(f"{name}: the file here is not the one the log ends with")
            continue
        matched.append(name)
        if name not in written:
            outside.append(f"{name}: the log never records the agent writing it")
        elif written[name] != digest:
            outside.append(f"{name}: changed after the agent's last recorded write")
    if differ:
        r.fail("The files here differ from the log's footer (the log or the files are out of date)", differ)
    elif matched:
        r.ok("The log ends with exactly these files", matched)
    if outside:
        r.fail("Submitted files the log does not show the agent writing (edited by hand?)", outside)
    if unseen:
        r.warn("Files listed in the footer but not found here, so not checked", unseen)

    leaks = sorted({what for pattern, what in SECRETS if re.search(pattern, raw)})
    if leaks:
        r.fail("Secrets in the log; replace them with [REDACTED: reason] (LOGS.md)", leaks)
    else:
        r.ok("No API keys, tokens or private keys in the log")

    if manifest:
        declared = str(manifest.get("models", "")).lower()
        undeclared = sorted({m["family"] for m in models.values() if m["family"].lower() not in declared})
        if undeclared:
            r.warn("Model families in the log that \\roarset{models} does not mention", undeclared)


# ------------------------------------------------------------------ main
def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    ap = argparse.ArgumentParser(description="Check a LAION ROAR 2027 submission before you submit it.")
    ap.add_argument("--paper", default="paper", help="base name of the .tex file (default: paper)")
    ap.add_argument("--dir", default=".", help="folder with the paper and its build (default: .)")
    ap.add_argument("--log", default="generation-log.jsonl",
                    help="generation log, relative to --dir (default: generation-log.jsonl)")
    ap.add_argument("--online", action="store_true", help="look references up on arXiv and Crossref")
    ap.add_argument("--json", action="store_true", help="print the report as JSON")
    ap.add_argument("--strict", action="store_true", help="fail on warnings too")
    ap.add_argument("--version", action="version", version=f"roar check {VERSION}")
    args = ap.parse_args()

    d = Path(args.dir)
    r = Report()
    check_build(r, d, args.paper)
    manifest = check_manifest(r, d, args.paper)
    check_source(r, d, args.paper)
    check_references(r, d, args.online)
    check_log(r, d, args.paper, args.log, manifest)

    if args.json:
        print(json.dumps({"tool": "roar check", "version": VERSION, "paper": f"{args.paper}.tex",
                          "errors": r.count(FAIL), "warnings": r.count(WARN), "checks": r.items},
                         indent=2, ensure_ascii=False))
    else:
        r.print_text(args.paper)
    sys.exit(1 if r.count(FAIL) or (args.strict and r.count(WARN)) else 0)


if __name__ == "__main__":
    main()
