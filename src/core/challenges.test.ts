import { describe, expect, it } from 'vitest';
import { MISSIONS, runMission } from './challenges';

describe('Educational Missions & Test Harness', () => {
  it('has 5 curated educational missions', () => {
    expect(MISSIONS.length).toBe(5);
  });

  MISSIONS.forEach((m) => {
    it(`Mission ${m.number} (${m.title}) solution passes all assertions`, () => {
      const result = runMission(m, m.solutionCode);
      if (!result.success) {
        console.error(`Failed mission ${m.number}:`, result);
      }
      expect(result.assemblySuccess).toBe(true);
      expect(result.assemblyErrors.length).toBe(0);
      expect(result.success).toBe(true);
      for (const a of result.assertions) {
        expect(a.passed).toBe(true);
      }
    });
  });
});
