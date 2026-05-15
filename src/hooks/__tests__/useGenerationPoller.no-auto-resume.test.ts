/**
 * Regression guard: useGenerationPoller MUST NOT auto-invoke
 * `generate-itinerary` from stall detection. Background auto-resume
 * silently overwrites the user's existing itinerary with different LLM
 * output (Dublin 2026-05-14). Resume is now manual-only via
 * TripDetail.handleResumeGeneration.
 *
 * See mem://constraints/itinerary/no-auto-resume-on-load.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const SRC = readFileSync(
  resolve(__dirname, '../useGenerationPoller.ts'),
  'utf8',
);

describe('useGenerationPoller — no background auto-resume', () => {
  it('does not invoke generate-itinerary from the poller', () => {
    expect(SRC).not.toMatch(/functions\.invoke\(\s*['"]generate-itinerary['"]/);
  });

  it('does not pass isResume:true from the poller', () => {
    expect(SRC).not.toMatch(/isResume:\s*true/);
  });

  it('does not retain an auto-resume attempt counter', () => {
    expect(SRC).not.toMatch(/autoResumeCountRef/);
    expect(SRC).not.toMatch(/MAX_AUTO_RESUME_ATTEMPTS/);
  });
});
