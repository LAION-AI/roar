// Writes author-kit/generation-log.jsonl, the example generation log (format: author-kit/LOGS.md)
// that belongs to the author kit's example paper. Its content is made up and short, but the
// hashes of the submitted files are real, so roar_check.py can verify them. Run it after changing
// paper.tex, references.bib or the example data, or the author kit check in CI fails:
//
//   bun run kit:log
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kit = fileURLToPath(new URL('../author-kit/', import.meta.url));
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

/** A `file` record for a real file in the kit. */
const real = (path: string) => {
  const bytes = readFileSync(join(kit, path));
  return { path, sha256: hash(bytes), bytes: bytes.length };
};
/** A `file` record for a file that only exists in the story (code, benchmark, drafts). */
const story = (path: string, bytes: number) => ({ path, sha256: hash(`example:${path}`), bytes });

const operator =
  'Write a paper for LAION ROAR 2027 on whether reviewer agents that rerun the code behind a ' +
  'paper find more numerical errors than agents that only read it. Use the ROAR author kit, ' +
  'make every number reproducible from the repository, and finish by 2 June.';

type Event = { t: string; type: string; actor?: string } & Record<string, unknown>;
const events: Event[] = [
  {
    t: '2027-05-20T08:00:00Z',
    type: 'note',
    actor: 'operator',
    content:
      'Example log for the example paper of the ROAR author kit. Everything in it is made up, ' +
      'and it is much shorter than a real log, which records every step (usually thousands of ' +
      'records). The SHA-256 hashes of the submitted files in the footer are real.',
  },
  { t: '2027-05-20T08:01:12Z', type: 'instruction', actor: 'operator', content: operator },
  {
    t: '2027-05-20T08:01:13Z',
    type: 'message',
    actor: 'ExampleAgent-Writer',
    model: 'writer',
    role: 'system',
    content:
      'You are ExampleAgent-Writer, a research agent. Plan the study, hand code and experiments ' +
      'to ExampleAgent-Runner, and write the paper with the ROAR author kit. Follow AGENTS.md.',
  },
  {
    t: '2027-05-20T08:01:13Z',
    type: 'message',
    actor: 'ExampleAgent-Writer',
    model: 'writer',
    role: 'user',
    content: operator,
  },
  {
    t: '2027-05-20T08:01:40Z',
    type: 'message',
    actor: 'ExampleAgent-Writer',
    model: 'writer',
    role: 'assistant',
    content:
      'Plan: (1) read related work on AI feedback on papers and on agent-written papers; ' +
      '(2) build 120 example papers with planted numerical errors; (3) compare reviewers that ' +
      'read the paper, read paper and logs, or rerun the code; (4) write the paper and check it ' +
      'with roar_check.py.',
    tokens: { input: 2140, output: 380 },
  },
  {
    t: '2027-05-20T08:01:41Z',
    type: 'tool_call',
    actor: 'ExampleAgent-Writer',
    call_id: 'c1',
    tool: 'web_search',
    arguments: { query: 'large language models feedback on research papers' },
  },
  {
    t: '2027-05-20T08:01:44Z',
    type: 'tool_result',
    actor: 'ExampleAgent-Writer',
    call_id: 'c1',
    ok: true,
    content:
      '1. Can Large Language Models Provide Useful Feedback on Research Papers? A Large-Scale ' +
      'Empirical Analysis. arXiv:2310.01783\n2. The AI Scientist: Towards Fully Automated ' +
      'Open-Ended Scientific Discovery. arXiv:2408.06292',
  },
  {
    t: '2027-05-20T08:05:31Z',
    type: 'file',
    actor: 'ExampleAgent-Writer',
    ...real('references.bib'),
  },
  {
    t: '2027-05-20T09:12:05Z',
    type: 'message',
    actor: 'ExampleAgent-Runner',
    model: 'coder',
    role: 'system',
    content:
      'You are ExampleAgent-Runner. Write and run code in the sandbox. Report every result ' +
      'with the command that reproduces it.',
  },
  {
    t: '2027-05-20T09:12:05Z',
    type: 'message',
    actor: 'ExampleAgent-Runner',
    model: 'coder',
    role: 'user',
    content:
      'Build 120 example papers with one to three planted numerical errors each, with fixed ' +
      'seeds, then measure the detection rate of three reviewer setups.',
  },
  {
    t: '2027-05-20T09:14:47Z',
    type: 'message',
    actor: 'ExampleAgent-Runner',
    model: 'coder',
    role: 'assistant',
    content:
      'I will generate the papers from 12 templates with 10 seeds each, plant the errors in ' +
      'table cells and figure values, and keep the list of planted errors for scoring.',
    tokens: { input: 1960, output: 2310 },
  },
  {
    t: '2027-05-20T09:14:50Z',
    type: 'file',
    actor: 'ExampleAgent-Runner',
    ...story('code/make_benchmark.py', 6412),
  },
  {
    t: '2027-05-20T09:14:51Z',
    type: 'tool_call',
    actor: 'ExampleAgent-Runner',
    call_id: 'c2',
    tool: 'shell',
    arguments: { command: 'python code/make_benchmark.py --papers 120 --seed 7 --out benchmark/' },
  },
  {
    t: '2027-05-20T09:16:02Z',
    type: 'tool_result',
    actor: 'ExampleAgent-Runner',
    call_id: 'c2',
    ok: true,
    content: 'Wrote 120 papers with 241 planted errors to benchmark/',
  },
  {
    t: '2027-05-20T09:16:03Z',
    type: 'file',
    actor: 'ExampleAgent-Runner',
    ...story('benchmark/papers.jsonl', 1843221),
  },
  {
    t: '2027-05-20T09:20:30Z',
    type: 'tool_call',
    actor: 'ExampleAgent-Runner',
    call_id: 'c3',
    tool: 'shell',
    arguments: {
      command:
        'export REVIEWER_API_KEY=[REDACTED: API key] && python code/run_reviewers.py ' +
        '--setups read,read_logs,rerun --gpus 1 --out data/detection_rate.csv',
    },
    redacted: true,
  },
  {
    t: '2027-05-21T22:31:09Z',
    type: 'tool_result',
    actor: 'ExampleAgent-Runner',
    call_id: 'c3',
    ok: true,
    content:
      'read_only: r=0.18, false alarms 0.4, 2 min/paper\nread_and_logs: r=0.31, false alarms ' +
      '0.6, 4 min/paper\nrerun_code: r=0.61, false alarms 0.5, 13 min/paper\nWrote data/detection_rate.csv',
  },
  {
    t: '2027-05-21T22:31:10Z',
    type: 'compute',
    actor: 'ExampleAgent-Runner',
    resource: '1x H100',
    quantity: 38,
    unit: 'gpu_hours',
  },
  {
    t: '2027-05-21T22:31:10Z',
    type: 'file',
    actor: 'ExampleAgent-Runner',
    ...real('data/detection_rate.csv'),
  },
  {
    t: '2027-05-22T07:45:00Z',
    type: 'instruction',
    actor: 'operator',
    content:
      'Say clearly that these are example numbers, and give the limitations their own section.',
  },
  {
    t: '2027-05-22T07:52:18Z',
    type: 'message',
    actor: 'ExampleAgent-Writer',
    model: 'writer',
    role: 'assistant',
    content:
      'Writing paper.tex with the ROAR class: two marked claims (detection rate, cost), one ' +
      'table, one figure with alt text and data, and a limitations section. Marking all ' +
      'numbers as illustrative.',
    tokens: { input: 18420, output: 6900 },
  },
  {
    t: '2027-05-22T07:52:19Z',
    type: 'file',
    actor: 'ExampleAgent-Writer',
    ...real('paper.tex'),
  },
  {
    t: '2027-05-22T07:52:20Z',
    type: 'tool_call',
    actor: 'ExampleAgent-Writer',
    call_id: 'c4',
    tool: 'shell',
    arguments: { command: 'make && python3 roar_check.py' },
  },
  {
    t: '2027-05-22T07:53:02Z',
    type: 'tool_result',
    actor: 'ExampleAgent-Writer',
    call_id: 'c4',
    ok: true,
    content:
      'Output written on paper-human.pdf. Output written on paper-agent.pdf.\n' +
      'roar check: 0 errors, 3 warnings (example paper id, example URLs)',
  },
  {
    t: '2027-05-22T07:53:30Z',
    type: 'note',
    actor: 'ExampleAgent-Writer',
    content: 'Both editions build and the check passes. Ready for the operator to submit.',
  },
];

const models = [
  { id: 'writer', family: 'Example-LM', version: '1.0', provider: 'Example Inc.' },
  { id: 'coder', family: 'Example-Coder', version: '2.1', provider: 'Example Inc.' },
];
const sum = (key: 'input' | 'output') =>
  events.reduce((n, e) => n + ((e.tokens as Record<string, number> | undefined)?.[key] ?? 0), 0);

const records = [
  {
    type: 'header',
    schema: 'roar-log/0.1',
    paper_id: '0001',
    started: '2027-05-20T08:00:00Z',
    framework: { name: 'Example Agent Framework', version: '0.9' },
    models,
    operator: { name: 'A. Operator', openreview: '~A_Operator1' },
  },
  ...events.map(({ t, type, ...rest }, i) => ({ seq: i + 1, t, type, ...rest })),
  {
    type: 'footer',
    finished: '2027-05-22T08:10:00Z',
    totals: { input_tokens: sum('input'), output_tokens: sum('output'), gpu_hours: 38 },
    outputs: ['paper.tex', 'references.bib', 'data/detection_rate.csv'].map((path) => {
      const { sha256 } = real(path);
      return { path, sha256 };
    }),
  },
];

writeFileSync(
  join(kit, 'generation-log.jsonl'),
  records.map((r) => JSON.stringify(r)).join('\n') + '\n',
);
console.log(`Wrote author-kit/generation-log.jsonl (${records.length} records)`);
