import { useRef, useState } from 'react';
import { Banner, Button, SectionLabel } from '@/components/ui';
import { announcer } from '@/lib/a11y/Announcer';
import { useSocial } from '../context';
import { SearchField } from './SearchField';

/**
 * Change the handle other players search for you by.
 *
 * The server derives one automatically on first sign-in, so nobody is ever
 * blocked on picking a name — but a derived handle like "AlexKim2" is not
 * necessarily one you want to read out to a friend, and reading it out is
 * exactly what it is for. This is where it becomes yours.
 *
 * Success is announced rather than only shown: the field keeps its value, so
 * without a spoken confirmation there is nothing to tell a screen-reader user
 * the change went through.
 */
export function HandleEditor() {
  const { me, loading, setHandle, error, clearError } = useSocial();
  /**
   * Null means "not edited yet", which is what lets the field show the
   * server's value without an effect copying it into state. Seeding via an
   * effect would also fight the player: the profile arrives asynchronously,
   * and a late snapshot would overwrite whatever they had started typing.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = me?.handle;
  /**
   * Nothing here works until the profile has arrived.
   *
   * Without this the field stayed editable while `me` was null, and Save could
   * never enable no matter what you typed — the change check is against your
   * current handle, and there was no current handle to compare to. A control
   * that accepts input it can never act on is worse than one that is plainly
   * unavailable, and to a screen reader it is indistinguishable from a bug.
   */
  const ready = Boolean(handle);
  const value = draft ?? handle ?? '';
  const dirty = ready && value.trim() !== handle;

  const save = async () => {
    if (!dirty) return;
    clearError();
    setSaved(false);
    setSaving(true);
    try {
      await setHandle(value.trim());
      // Back to following the server's value, which is now the saved one.
      setDraft(null);
      setSaved(true);
      announcer.speak(`Your handle is now @${value.trim()}`, { priority: 40 });
      inputRef.current?.focus();
    } catch {
      // The message is already in the social error state, rendered below.
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex w-full flex-col gap-3">
      <SectionLabel>Your handle</SectionLabel>

      <SearchField
        ref={inputRef}
        label="Handle"
        value={value}
        disabled={!ready || saving}
        onValueChange={next => {
          setDraft(next);
          setSaved(false);
        }}
        placeholder="alex"
        autoComplete="off"
        hint={
          ready
            ? 'Friends find you by this. Letters, digits and underscores, starting with a letter.'
            : loading
              ? 'Loading your profile…'
              : 'Could not load your profile, so your handle cannot be changed right now.'
        }
      />

      {error ? (
        <Banner variant="error" onDismiss={clearError}>
          {error}
        </Banner>
      ) : null}

      {saved ? <Banner variant="success">{`Your handle is now @${value.trim()}`}</Banner> : null}

      {/*
        A disabled control always says why — the same rule the friend rows
        follow. "Dimmed" on its own tells a listener nothing.
      */}
      <Button
        variant="secondary"
        disabled={!dirty}
        loading={saving}
        title={
          !ready
            ? loading
              ? 'Loading your profile'
              : 'Your profile could not be loaded'
            : !dirty
              ? 'This is already your handle'
              : `Saves @${value.trim()} as your handle`
        }
        onClick={() => void save()}>
        Save handle
      </Button>
    </section>
  );
}
