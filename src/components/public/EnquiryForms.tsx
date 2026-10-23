'use client';

import { useActionState } from 'react';
import type * as React from 'react';
import { ReferenceReceipt } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/fields';
import type { ActionState } from '@/lib/action-result';
import { CONTACT_TOPICS } from '@/lib/schemas/enquiry';
import { applyForRole, requestValuation, sendContact } from '@/server/actions/enquiries';

type Action = (prev: ActionState<{ refNo: string }>, fd: FormData) => Promise<ActionState<{ refNo: string }>>;

function EnquiryShell({
  action,
  signedIn,
  path,
  submitLabel,
  receipt,
  children,
}: {
  action: Action;
  signedIn: boolean;
  path: string;
  submitLabel: string;
  receipt: { title: string; text: string; action?: React.ReactNode };
  children: (errors: Record<string, string>) => React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  if (state?.ok && state.data) return <ReferenceReceipt title={receipt.title} reference={state.data.refNo} text={receipt.text} action={receipt.action} />;
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="stack" noValidate>
      {children(errors)}
      {state && !state.ok && state.message ? (
        <p className="jr-field-hint" role="alert" style={{ color: 'var(--danger)' }}>
          {state.message}
        </p>
      ) : null}
      <div className="row">
        {signedIn ? (
          <Button type="submit" loading={pending} withKey>
            {submitLabel}
          </Button>
        ) : (
          <Button href={`/signin?callbackUrl=${encodeURIComponent(path)}`}>Sign in to send</Button>
        )}
      </div>
      {!signedIn ? <p className="caption muted">We use Discord sign-in so we can reply to you. Your details stay with the brokerage.</p> : null}
    </form>
  );
}

export function ValuationForm({ signedIn, areas }: { signedIn: boolean; areas: { value: string; label: string }[] }) {
  return (
    <EnquiryShell
      action={requestValuation}
      signedIn={signedIn}
      path="/sell"
      submitLabel="Request a valuation"
      receipt={{ title: 'Valuation requested', text: 'An agent will look at recent sales nearby and get back to you with a suggested price.' }}
    >
      {(e) => (
        <>
          <TextField label="Property address" name="addressLine" required error={e.addressLine} />
          <div className="grid-12">
            <SelectField className="span-6" label="Area" name="areaId" placeholder="Choose the area" options={areas} error={e.areaId} />
            <SelectField
              className="span-6"
              label="Kind of property"
              name="propertyType"
              placeholder="Choose one"
              options={[
                { value: 'house', label: 'House' },
                { value: 'apartment', label: 'Apartment' },
                { value: 'business', label: 'Business' },
                { value: 'land', label: 'Land' },
              ]}
              error={e.propertyType}
            />
            <TextField className="span-3" label="Bedrooms" name="beds" mono inputMode="numeric" error={e.beds} />
            <TextField className="span-3" label="Bathrooms" name="baths" mono inputMode="numeric" error={e.baths} />
            <TextField className="span-6" label="When would you like to sell?" name="timeline" error={e.timeline} />
          </div>
          <TextField label="Best way to reach you" name="bestContact" required placeholder="Discord DM, evenings" error={e.bestContact} />
          <TextField label="Anything else? (optional)" name="notes" multiline rows={3} error={e.notes} />
        </>
      )}
    </EnquiryShell>
  );
}

export function ContactForm({ signedIn, listing }: { signedIn: boolean; listing?: { id: string; title: string } }) {
  return (
    <EnquiryShell
      action={sendContact}
      signedIn={signedIn}
      path="/contact"
      submitLabel="Send message"
      receipt={{ title: 'Message sent', text: 'We usually reply within a day, through Discord or in-game.' }}
    >
      {(e) => (
        <>
          {listing ? <input type="hidden" name="listingId" value={listing.id} /> : null}
          <SelectField label="What’s it about?" name="topic" placeholder="Choose one" options={[...CONTACT_TOPICS]} defaultValue={listing ? 'A listing' : ''} error={e.topic} />
          <TextField label="Your message" name="message" multiline rows={6} required defaultValue={listing ? `About ${listing.title}: ` : ''} error={e.message} />
          <TextField label="Best way to reach you (optional)" name="bestContact" error={e.bestContact} />
        </>
      )}
    </EnquiryShell>
  );
}

export function CareerForm({ signedIn, careerId, path }: { signedIn: boolean; careerId: string; path: string }) {
  return (
    <EnquiryShell
      action={applyForRole}
      signedIn={signedIn}
      path={path}
      submitLabel="Send application"
      receipt={{ title: 'Application sent', text: 'The Owner reads every application and will reach out on Discord.' }}
    >
      {(e) => (
        <>
          <input type="hidden" name="careerId" value={careerId} />
          <TextField label="Your experience" name="experience" multiline rows={4} required hint="Roleplay, real estate, customer service — whatever’s relevant." error={e.experience || e.careerId} />
          <TextField label="Why this role?" name="why" multiline rows={4} required error={e.why} />
          <TextField label="When are you usually on?" name="availability" error={e.availability} />
          <TextField label="Best way to reach you (optional)" name="bestContact" error={e.bestContact} />
        </>
      )}
    </EnquiryShell>
  );
}
