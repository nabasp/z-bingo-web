import { Link } from 'react-router-dom';
import { PageHeading, PageShell } from '@/components/ui';
import { PATHS } from './paths';

export function NotFoundPage() {
  return (
    <PageShell center width="narrow">
      <PageHeading
        align="center"
        title="Page not found"
        subtitle="That link doesn't lead anywhere in this app."
      />
      <Link
        to={PATHS.home}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90">
        Go home
      </Link>
    </PageShell>
  );
}
