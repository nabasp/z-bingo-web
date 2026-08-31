import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SocialValue } from '../context/socialContext';

/**
 * The handle editor's enabled/disabled behaviour.
 *
 * A disabled control with no stated reason is the exact failure this codebase
 * fixes elsewhere (see `FriendRow`), and it matters most to the people this app
 * is built for: a screen reader announces "Save handle, dimmed" and nothing
 * about why.
 */

let social: SocialValue;

vi.mock('../context', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../context');
  return { ...actual, useSocial: () => social };
});

const { HandleEditor } = await import('./HandleEditor');

function socialValue(overrides: Partial<SocialValue> = {}): SocialValue {
  return {
    loading: false,
    me: { id: 'u1', handle: 'nasu', name: 'Nasu' },
    friends: [],
    requests: [],
    incomingInvite: null,
    outgoingInvite: null,
    error: null,
    clearError: () => {},
    refresh: async () => {},
    search: async () => [],
    sendRequest: async () => {},
    respondToRequest: async () => {},
    cancelRequest: async () => {},
    removeFriend: async () => {},
    setHandle: async () => {},
    sendInvite: async () => {},
    respondToInvite: async () => null,
    dismissInvite: () => {},
    ...overrides,
  } as SocialValue;
}

const saveButton = () => screen.getByRole('button', { name: /save handle/i });
const field = () => screen.getByLabelText('Handle');

afterEach(cleanup);

describe('HandleEditor', () => {
  it('disables Save while the handle is unchanged', () => {
    social = socialValue();
    render(<HandleEditor />);

    // Nothing to save is a legitimate reason to be disabled.
    expect(field()).toHaveValue('nasu');
    expect(saveButton()).toBeDisabled();
  });

  it('says why Save is unavailable when nothing has changed', () => {
    social = socialValue();
    render(<HandleEditor />);
    expect(saveButton()).toHaveAttribute(
      'title',
      'This is already your handle',
    );
  });

  it('enables Save once the handle is edited', () => {
    social = socialValue();
    render(<HandleEditor />);

    fireEvent.change(field(), { target: { value: 'nasu_plays' } });
    expect(saveButton()).toBeEnabled();
  });

  it('enables Save when the profile loads with a different handle typed', () => {
    social = socialValue({ me: { id: 'u1', handle: 'oldname', name: 'Nasu' } });
    render(<HandleEditor />);

    fireEvent.change(field(), { target: { value: 'nasu' } });
    expect(saveButton()).toBeEnabled();
  });

  it('explains itself when the profile could not be loaded', () => {
    // Firestore unreachable, or the socket still connecting. Previously the
    // field stayed editable and Save could never enable no matter what was
    // typed, because `dirty` was gated on a handle that never arrived.
    social = socialValue({ me: null, error: 'Friends are unavailable.' });
    render(<HandleEditor />);

    expect(field()).toBeDisabled();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(/could not load your profile/i)).toBeInTheDocument();
  });

  it('does not pretend to be editable while still loading', () => {
    social = socialValue({ me: null, loading: true });
    render(<HandleEditor />);

    expect(field()).toBeDisabled();
    expect(saveButton()).toBeDisabled();
  });
});
