import type { Persona } from './contracts';

export const narrators: { id: Persona; symbol: string; name: string; voice: string; role: string; description: string; sample: string }[] = [
  { id: 'archivist', symbol: '⌘', name: 'The Archivist', voice: 'George', role: 'Precise · Ominous · Patient', description: 'Every house has a history. Every history has something to hide.', sample: '“Houses forget nothing. People simply stop asking.”' },
  { id: 'skeptic', symbol: '◈', name: 'The Skeptic', voice: 'Jane', role: 'Dry · Grounded · Unraveling', description: 'A rational mind, in a place that has never cared for reason.', sample: '“There will be a reasonable explanation. There has to be.”' },
  { id: 'medium', symbol: '☽', name: 'The Medium', voice: 'Audrey', role: 'Intuitive · Intimate · Haunted', description: 'Some voices need to be heard before they can finally be silent.', sample: '“I felt her silence before I heard her voice.”' },
];
