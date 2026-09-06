'use client';

/**
 * Data-store failure state (T040, spec Edge Cases).
 *
 * The important part is what this is NOT: an empty list. A dashboard showing no
 * tickets because the database is unreachable would read as "no open work",
 * which is the opposite of the truth and exactly the kind of silent failure this
 * tool exists to prevent.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main>
      <h1>Ticket Triage</h1>
      <div className="failure" role="alert">
        <strong>Could not load tickets.</strong>
        <p>
          The ticket store could not be reached, so this page cannot show what is open. This is
          <em> not</em> an empty queue — do not read it as &ldquo;no open work&rdquo;.
        </p>
        <p>
          Check that setup has been run (<code>npx prisma migrate dev</code> then{' '}
          <code>npm run seed</code>), then retry.
        </p>
        {error.digest ? <p>Reference: {error.digest}</p> : null}
        <button type="button" onClick={reset}>
          Retry
        </button>
      </div>
    </main>
  );
}
