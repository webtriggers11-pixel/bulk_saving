import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BottomNav } from './BottomNav';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('BottomNav', () => {
  it("renders exactly BRIEF's four resident tabs, in order, with their routes", () => {
    renderAt('/');
    const links = screen.getAllByRole('link');

    expect(links.map((l) => l.textContent)).toEqual(['Home', 'Services', 'My Requests', 'Profile']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/', '/services', '/my-requests', '/profile']);
  });

  it('marks the tab for the current route with aria-current', () => {
    renderAt('/my-requests');

    expect(screen.getByRole('link', { name: 'My Requests' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  // V2 P2-4: this used to claim it guarded an `end` prop. It did not — removing
  // the prop left it green, because react-router already special-cases "/". The
  // prop is gone; the behaviour it claimed to protect is what is asserted here.
  it('marks only the current tab, never Home as a catch-all', () => {
    renderAt('/services');

    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('aria-current', 'page');
  });

  // FEAT-011 renamed the height token (min-h-11 -> min-h-tab, 44px -> 58px). The
  // guarantee under test is unchanged: every tab clears the 44px touch floor.
  it('is labelled for screen readers and gives every tab a 44px-plus target', () => {
    renderAt('/');

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('min-h-tab');
      expect(link.className).toContain('min-w-11');
    }
  });

  it('slides ONE pill to the active tab (FEAT-016)', () => {
    renderAt('/my-requests');
    const pill = screen.getByTestId('tab-pill');
    expect(pill.style.transform).toBe('translateX(calc(2 * (100% + 4px)))');
    expect(pill).toHaveAttribute('aria-hidden', 'true');
  });
});
