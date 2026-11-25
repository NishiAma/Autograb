import type { SubmissionResult as SubmissionResultData } from '../types/api';

interface SubmissionResultProps {
  result: SubmissionResultData;
  makeLabel: string;
}

export function SubmissionResult({ result, makeLabel }: SubmissionResultProps) {
  const { data, message } = result;

  return (
    <section className="result" aria-labelledby="result-heading">
      <p className="success" role="status">
        {message}
      </p>

      <h2 id="result-heading">Submitted vehicle</h2>
      <dl className="result__details">
        <div>
          <dt>Make</dt>
          <dd>{makeLabel}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{data.model}</dd>
        </div>
        <div>
          <dt>Badge</dt>
          <dd>{data.badge}</dd>
        </div>
      </dl>

      <h3>Logbook contents ({data.logbookFileName})</h3>
      {/* Rendered as a text node: React escapes it, so uploaded content is never interpreted as HTML. */}
      <pre className="result__logbook" data-testid="logbook-contents" tabIndex={0}>
        {data.logbookContents}
      </pre>
    </section>
  );
}
