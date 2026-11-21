import type { APIRoute } from 'astro';
import { conference, stages, timeline } from '../data/conference';

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
      operator:
        'One accountable human registers each submission on OpenReview; not an author. Everything the operator tells the agent is part of the published logs.',
      reviewers:
        'The state-of-the-art model of six model families per paper; no self-family review',
      hidden_text: 'Prompt injection and hidden text lead to desk rejection',
      openness:
        'Papers, reviews, rebuttals, prompts, model versions, logs, code and decision logic are public',
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
