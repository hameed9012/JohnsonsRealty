'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { runDiscordSetupAction, type SetupResult } from '@/server/actions/discord';

export function DiscordSetupPanel({ ready }: { ready: boolean }) {
  const [pending, start] = useTransition();
  const [running, setRunning] = useState<'dry' | 'live' | null>(null);
  const [result, setResult] = useState<SetupResult | null>(null);
  const run = (dry: boolean) =>
    start(async () => {
      setRunning(dry ? 'dry' : 'live');
      setResult(null);
      setResult(await runDiscordSetupAction(dry));
      setRunning(null);
    });
  return (
    <div className="stack">
      <div className="row">
        <Button variant="secondary" disabled={!ready || pending} loading={running === 'dry'} onClick={() => run(true)}>
          Preview changes
        </Button>
        <Button disabled={!ready || pending} loading={running === 'live'} onClick={() => run(false)}>
          Run setup
        </Button>
      </div>
      {pending ? <p className="body-s muted" role="status">Working through the server. This can take a minute or two because Discord limits how fast bots can make changes.</p> : null}
      {result && !result.ok ? (
        <p className="body-s" role="alert" style={{ color: 'var(--danger)' }}>
          {result.message}
        </p>
      ) : null}
      {result?.ok ? (
        <div className="stack" role="status">
          <h3 className="heading-3">{result.report.dryRun ? 'What setup would change' : 'Setup finished'}</h3>
          {result.report.changes.length ? (
            <ul className="body-s">
              {result.report.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="body-s">Everything already matches the blueprint.</p>
          )}
          <p className="body-s muted">{result.report.unchanged} items already up to date.</p>
          {result.report.manual.length ? (
            <>
              <h3 className="heading-3">To do by hand in Discord</h3>
              <ul className="body-s">
                {result.report.manual.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
