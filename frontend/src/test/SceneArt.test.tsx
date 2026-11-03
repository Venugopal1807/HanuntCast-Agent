import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SceneArt } from '../SceneArt';

it('gives every chapter and ending distinct artwork with isolated SVG definitions', () => {
  const scenes = ['threshold', 'gallery', 'belfry', 'reckoning', 'liberation', 'escape', 'inheritance'] as const;
  const { container } = render(<>{scenes.map(scene => <SceneArt key={scene} scene={scene}/>)}</>);
  expect(screen.getAllByRole('img')).toHaveLength(7);
  const ids = [...container.querySelectorAll('[id]')].map(node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  const shapes = [...container.querySelectorAll('svg')].map(svg =>
    [...svg.querySelectorAll('path')].map(path => path.getAttribute('d')).join('|'));
  expect(new Set(shapes).size).toBe(7);
  expect(container.querySelector('image')).toBeNull();
});
