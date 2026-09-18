import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, StarGlyph } from './icon';

describe('Icon', () => {
  it('is decorative by default — a label belongs on the control, not the glyph', () => {
    const { container } = render(<Icon name="home" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('inherits colour so one glyph serves every surface, including the accent one', () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector('svg')).toHaveAttribute('stroke', 'currentColor');
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'none');
  });

  it('keeps one optical weight across the family', () => {
    const { container } = render(
      <>
        <Icon name="home" />
        <Icon name="profile" />
        <Icon name="paint" />
      </>,
    );
    const widths = [...container.querySelectorAll('svg')].map((s) => s.getAttribute('stroke-width'));
    expect(new Set(widths)).toEqual(new Set(['1.8']));
  });

  it('fills the star only when the rating covers it', () => {
    const { container } = render(
      <>
        <StarGlyph filled />
        <StarGlyph filled={false} />
      </>,
    );
    const [on, off] = [...container.querySelectorAll('svg')];
    expect(on).toHaveAttribute('fill', 'currentColor');
    expect(off).toHaveAttribute('fill', 'none');
  });
});
