import { PageHeading, PageShell } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import {
  GUIDE_SECTIONS,
  WEB_CONTROL_SECTIONS,
  type GuideSection,
} from '@/features/guide/guideContent';

/**
 * The Game Guide.
 *
 * Built from real headings and lists rather than paragraphs of prose, because
 * the people most likely to need it are the ones navigating by heading. A
 * screen-reader user can jump section to section; a sighted one gets the same
 * structure as visible hierarchy. `<dl>` carries the key/gesture pairs, since
 * that is exactly the term-and-definition shape those lists have.
 *
 * The content lives in `features/guide/guideContent.ts` so this file stays
 * presentational, and so the mobile app's copy can be diffed against it.
 */

function Section({ section }: { section: GuideSection }) {
  const hasTerms = section.items.some(item => item.term);

  return (
    <section aria-labelledby={`guide-${section.id}`} className="flex flex-col gap-3">
      <h2
        id={`guide-${section.id}`}
        className="text-lg font-bold text-foreground">
        {section.title}
      </h2>

      {section.intro ? (
        <p className="text-sm text-muted-foreground">{section.intro}</p>
      ) : null}

      {/*
        A definition list when the items name a key or a gesture, a plain list
        otherwise. The distinction is not cosmetic: `<dl>` is what tells a
        screen reader that "Alt + B" and what it does belong together.
      */}
      {hasTerms ? (
        <dl className="flex flex-col gap-2">
          {section.items.map((item, index) => (
            <div key={index} className="flex flex-col gap-0.5">
              {item.term ? (
                <dt className="text-sm font-semibold text-foreground">
                  {item.term}
                </dt>
              ) : null}
              <dd className="text-sm text-muted-foreground">{item.text}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {section.items.map((item, index) => (
            <li key={index} className="text-sm text-muted-foreground">
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function GuidePage() {
  const headingRef = useAnnounceOnFocus({
    title: 'Game guide',
    detail:
      'How to play, and every control on the web app. Move by heading to find a section.',
  });

  return (
    <PageShell>
      <PageHeading headingRef={headingRef} title="Game Guide" />

      <div className="flex flex-col gap-8">
        {GUIDE_SECTIONS.map(section => (
          <Section key={section.id} section={section} />
        ))}

        {/*
          Controls last: someone reaching for the guide usually wants the rules
          first, and the shortcut tables are what they come back for later.
        */}
        <h2 className="text-xl font-bold text-foreground">Controls on the web</h2>
        {WEB_CONTROL_SECTIONS.map(section => (
          <Section key={section.id} section={section} />
        ))}
      </div>
    </PageShell>
  );
}
