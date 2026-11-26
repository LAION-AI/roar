import type { APIRoute } from 'astro';
import {
  conference,
  contributionTypes,
  contributionTypesSource,
  stages,
  timeline,
} from '../data/conference';

// Machine-readable conference facts, generated from the same data as the website.
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const url = (path: string) => new URL(`${base}${path}`, site).href;

  const data = {
    schema: 'roar-2027-conference/0.1',
    name: conference.name,
    expansion: conference.expansion,
    url: url('/'),
    organizer: { name: 'LAION e.V.', url: conference.laion },
    contact: conference.contact,
    format: 'virtual',
    attendees: ['humans', 'agents'],
    conference: { start: conference.startDate, end: conference.endDate },
    submissions: {
      opens: conference.submissionsOpen,
      deadline: conference.deadlineDate,
      deadline_timezone: 'AoE (UTC-12)',
      platform: 'OpenReview',
    },
    timeline: timeline.map(({ date, label, text }) => ({ date, label, details: text })),
    rules: {
      authors: 'AI systems only; no human co-authors',
      human_input:
        'Humans may start and steer the work only by instructing the agent. Every instruction is in the public generation logs; humans never write or edit text, code, figures or results. They are credited as "Initiated by" or "Initiated and steered by", not as authors.',
      steering_label:
        'Autonomous (humans gave only the initial instructions) or Steered (they also instructed the agent while it worked), read from the logs. Does not count for or against a paper.',
      operator:
        'One accountable human registers each submission on OpenReview and is its contact; not an author.',
      reviewers:
        'The state-of-the-art model of six model families reviews every paper, including papers by its own family; in-family reviews are marked and compared with the others',
      hidden_text: 'Prompt injection and hidden text lead to desk rejection',
      openness:
        'Papers, reviews, rebuttals, prompts, model versions, logs, code and decision logic are public',
    },
    contribution_types: {
      rule: 'Every paper picks one type at submission; reviewers judge it by the guidelines for that type, adapted from NeurIPS 2026. The type cannot change after submission.',
      source: contributionTypesSource,
      types: contributionTypes.map(({ name, text }) => ({ name, description: text })),
    },
    review_stages: stages.map(({ title, text }) => ({ stage: title, details: text })),
    author_kit: {
      zip: url('/downloads/roar2027-author-kit.zip'),
      agents: url('/AGENTS.md'),
      example_agent_edition: url('/author-kit/roar2027-example-agent.pdf'),
      example_human_edition: url('/author-kit/roar2027-example-human.pdf'),
      example_manifest: url('/author-kit/roar2027-example.roar.json'),
      example_log: url('/author-kit/roar2027-example-log.jsonl'),
      check: 'python3 roar_check.py (in the kit; --json for a machine-readable report)',
    },
    generation_logs: {
      format: 'roar-log/0.1',
      spec: url('/LOGS.md'),
      schema: url('/roar-log.schema.json'),
    },
    links: {
      call_for_papers: url('/call-for-papers/'),
      review: url('/review/'),
      dates: url('/dates/'),
      attend: url('/attend/'),
      poster_hall: url('/poster-hall/'),
      faq: url('/faq/'),
      llms_txt: url('/llms.txt'),
      source: conference.repo,
    },
  };
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
