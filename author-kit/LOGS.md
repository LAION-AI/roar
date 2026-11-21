# ROAR generation log format (roar-log/0.1, preview)

Every ROAR submission includes the complete record of how it was made: every instruction from the
human operator, every model call, every tool call and every file the agent wrote, from the first
prompt to the final paper. Agent frameworks all log differently; this format makes the logs of
different submissions comparable, checkable and usable as an open dataset.

## File

- **JSON Lines**, UTF-8: one JSON object per line. Name it `generation-log.jsonl`; it may be
  gzipped (`generation-log.jsonl.gz`).
- The **first** record is the `header`, the **last** is the `footer`, everything in between is an
  event, in the order it happened.
- Large payloads (long tool outputs, datasets, images) can live in separate files. Instead of
  `content`, give `content_ref: {"path": "...", "sha256": "...", "bytes": 123}` and submit the file.
- The JSON Schema is in `roar-log.schema.json`. `roar_check.py` validates a log.

## Records

### Header (first line)

```json
{"type": "header", "schema": "roar-log/0.1", "paper_id": "0001", "started": "2027-05-20T08:00:00Z",
 "framework": {"name": "Example Agent Framework", "version": "0.9"},
 "models": [{"id": "writer", "family": "Example-LM", "version": "1.0", "provider": "Example Inc."}],
 "operator": {"name": "A. Operator", "openreview": "~A_Operator1"}}
```

`models[].id` is a short name that events refer to. Every model the agent used must be listed.

### Events

Every event has `seq` (1, 2, 3, … without gaps), `t` (UTC timestamp, ISO 8601, never going
backwards) and `type`. Most also have `actor`: the agent (or sub-agent) that acted.

| `type` | When | Required fields |
| --- | --- | --- |
| `instruction` | Anything the human operator tells the agent. **All of it must be logged.** | `content` |
| `message` | A model call: what went in and what came out | `model`, `role` (`system`, `user`, `assistant`), `content` or `content_ref`; optional `tokens: {"input": n, "output": n}` |
| `tool_call` | The agent calls a tool (search, shell, code, browser…) | `call_id`, `tool`, `arguments` |
| `tool_result` | The tool answers | `call_id` (matching a `tool_call`), `ok` (true/false), `content` or `content_ref` |
| `file` | The agent writes a file (code, data, figures, the paper) | `path`, `sha256`, `bytes` |
| `compute` | Compute used (training runs, experiments) | `resource` (e.g. `"1x H100"`), `quantity`, `unit` (`gpu_hours`, `cpu_hours`, `seconds`) |
| `note` | Anything else worth recording | `content` |

### Footer (last line)

```json
{"type": "footer", "finished": "2027-06-02T17:40:00Z",
 "totals": {"input_tokens": 3900000, "output_tokens": 210000, "gpu_hours": 38},
 "outputs": [{"path": "paper.tex", "sha256": "…"}, {"path": "data/detection_rate.csv", "sha256": "…"}]}
```

`outputs` must include the submitted LaTeX source with its SHA-256, so the log provably ends with
the paper that was submitted. `roar_check.py` compares the hashes with the files.

## Rules

1. **Complete.** No gaps in `seq`, nothing left out, nothing edited after the fact.
2. **Operator instructions included.** Everything the human operator told the agent is an
   `instruction` event.
3. **Redact, don't delete.** Replace secrets (API keys, passwords, tokens) and personal data with
   `[REDACTED: reason]` and add `"redacted": true` to that record. Keep the record itself.
   `roar_check.py` refuses logs that contain things that look like API keys.
4. **UTC timestamps.** ISO 8601 with `Z`, e.g. `2027-05-20T08:00:00Z`.

## From your agent framework

- Chat-style model calls (system/user/assistant messages): one `message` record per message, with
  the model's `id` from the header.
- Tool use / function calling: a `tool_call` when the model asks, a `tool_result` with the same
  `call_id` when the tool answers.
- Shell commands and code execution: `tool_call` with `"tool": "shell"` (or `"python"`), the
  command in `arguments`, and its output in the `tool_result`.
- Files the agent writes: a `file` record with the SHA-256 of what was written.

An example log for the example paper is in `generation-log.jsonl`.
