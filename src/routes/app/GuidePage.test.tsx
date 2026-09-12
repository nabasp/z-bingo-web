import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOARD_KEYS, SHORTCUTS } from '@/lib/a11y/shortcuts';
import { HelpButton } from '@/features/guide/HelpButton';
import { GuidePage } from './GuidePage';

/**
 * The guide's accessibility contract.
 *
 * A help page is only help if the people who need it most can move around it,
 * so what is tested here is structure: real headings to jump between, real
 * lists, and a "?" whose name is a word rather than a punctuation mark.
 *
 * The content itself is deliberately not asserted line by line — that would
 * pin prose rather than behaviour. The one exception is the shortcut table,
 * which must agree with what the app actually binds.
 */

vi.mock('@/lib/a11y/useAnnounceOnFocus', () => ({
  useAnnounceOnFocus: () => ({ current: null }),
}));

function renderGuide() {
  return render(
    <MemoryRouter>
      <GuidePage />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('GuidePage structure', () => {
  it('is navigable by heading', () => {
    // How a screen-reader user actually reads a long page: jump by heading
    // rather than arrowing through every line.
    renderGuide();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Game Guide');
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(8);
  });

  it('names every section for assistive technology', () => {
    // `aria-labelledby` is what lets a landmark list say what each section is.
    const { container } = renderGuide();

    for (const section of container.querySelectorAll('section')) {
      expect(section).toHaveAttribute('aria-labelledby');
      expect(section).toHaveAccessibleName();
    }
  });

  it('uses lists rather than paragraphs of prose', () => {
    const { container } = renderGuide();

    expect(container.querySelectorAll('ul, dl').length).toBeGreaterThan(5);
  });

  it('pairs each key with what it does', () => {
    // A `<dl>` is what tells a screen reader that "Alt + B" and its
    // description belong together; two loose lines would not.
    renderGuide();

    const term = screen.getByText(SHORTCUTS.focusBoard.keys);
    expect(term.tagName).toBe('DT');
    expect(term.nextElementSibling?.tagName).toBe('DD');
  });
});

describe('GuidePage content matches the app', () => {
  it('lists exactly the shortcuts the app binds', () => {
    // The guide reads from the same registry the bindings do, so this fails
    // the moment a shortcut is added without being documented.
    renderGuide();

    for (const spec of Object.values(SHORTCUTS)) {
      expect(screen.getByText(spec.keys)).toBeInTheDocument();
      // `getAllBy`, not `getBy`: Alt+M and the board's bare M do the same
      // thing and say so in the same words, which is the point of them.
      expect(screen.getAllByText(spec.description).length).toBeGreaterThan(0);
    }
  });

  it('lists every key the board answers', () => {
    renderGuide();

    for (const spec of BOARD_KEYS) {
      expect(screen.getAllByText(spec.keys).length).toBeGreaterThan(0);
      expect(screen.getAllByText(spec.description).length).toBeGreaterThan(0);
    }
  });

  it('states the real player and board limits', () => {
    renderGuide();

    expect(screen.getByText(/2 or 3/)).toBeInTheDocument();
    expect(screen.getByText(/3×3 up to 8×8/)).toBeInTheDocument();
  });
});

describe('HelpButton', () => {
  it('is a link with a spoken name, not a bare question mark', () => {
    // "?" read aloud is punctuation. The label is what makes it findable by
    // a screen reader's link list and by voice control.
    render(
      <MemoryRouter>
        <HelpButton />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /help and game guide/i });
    expect(link).toHaveAttribute('href', '/guide');
  });

  it('hides the glyph itself from assistive technology', () => {
    const { container } = render(
      <MemoryRouter>
        <HelpButton />
      </MemoryRouter>,
    );

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('?');
  });
});
