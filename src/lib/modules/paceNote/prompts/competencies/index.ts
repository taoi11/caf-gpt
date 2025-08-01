/**
 * Centralized competency imports for rank-specific content
 */

import cplCompetencies from './cpl.md?raw';
import mcplCompetencies from './mcpl.md?raw';
import sgtCompetencies from './sgt.md?raw';
import woCompetencies from './wo.md?raw';
import exampleContent from './examples.md?raw';

import type { PaceNoteRank } from '../../types.js';

export const competencies = {
	Cpl: cplCompetencies,
	MCpl: mcplCompetencies,
	Sgt: sgtCompetencies,
	WO: woCompetencies
} as const;

export const examples = exampleContent;

export function getCompetenciesForRank(rank: PaceNoteRank): string {
	const competency = competencies[rank];
	if (!competency) {
		throw new Error(`Unknown rank: ${rank}`);
	}
	return competency;
}
