'use client';

import { useFormAction } from '@/components/forms/useFormAction';
import { Button } from '@/components/ui/Button';
import { RadioGroup, Toggle } from '@/components/ui/controls';
import { TextField } from '@/components/ui/fields';
import { saveCareer, savePost } from '@/server/actions/content';

const MD_HINT = 'Blank lines separate paragraphs. ## for a heading, - for a list, **bold**, [link](/buy).';

export function PostForm({ id, values }: { id: string | null; values: { kind: string; title: string; slug: string; excerpt: string; body: string; published: boolean } }) {
  const { formAction, pending, errors } = useFormAction(savePost.bind(null, id));
  return (
    <form action={formAction} className="stack-lg" noValidate>
      <RadioGroup
        legend="Kind"
        name="kind"
        defaultValue={values.kind}
        options={[
          { value: 'guide', label: 'Guide' },
          { value: 'news', label: 'News' },
        ]}
        error={errors.kind}
      />
      <div className="grid-12">
        <TextField className="span-8" label="Title" name="title" defaultValue={values.title} required error={errors.title} />
        <TextField className="span-4" label="Address" name="slug" mono defaultValue={values.slug} hint="Leave blank to make one from the title." error={errors.slug} />
      </div>
      <TextField label="Summary" name="excerpt" multiline rows={2} defaultValue={values.excerpt} error={errors.excerpt} />
      <TextField label="Article" name="body" multiline rows={16} defaultValue={values.body} hint={MD_HINT} error={errors.body} />
      <Toggle name="published" label="Published" hint="Shows on Guides and news." defaultChecked={values.published} />
      <div className="row">
        <Button type="submit" loading={pending}>
          Save article
        </Button>
        <Button variant="ghost" href="/portal/content">
          Back to content
        </Button>
      </div>
    </form>
  );
}

export function CareerForm({ id, values }: { id: string | null; values: { title: string; slug: string; summary: string; body: string; open: boolean; displayOrder: string } }) {
  const { formAction, pending, errors } = useFormAction(saveCareer.bind(null, id));
  return (
    <form action={formAction} className="stack-lg" noValidate>
      <div className="grid-12">
        <TextField className="span-6" label="Role" name="title" defaultValue={values.title} required error={errors.title} />
        <TextField className="span-3" label="Address" name="slug" mono defaultValue={values.slug} error={errors.slug} />
        <TextField className="span-3" label="Order" name="displayOrder" mono inputMode="numeric" defaultValue={values.displayOrder} error={errors.displayOrder} />
      </div>
      <TextField label="Summary" name="summary" multiline rows={2} defaultValue={values.summary} error={errors.summary} />
      <TextField label="Description" name="body" multiline rows={12} defaultValue={values.body} hint={MD_HINT} error={errors.body} />
      <Toggle name="open" label="Open for applications" defaultChecked={values.open} />
      <div className="row">
        <Button type="submit" loading={pending}>
          Save role
        </Button>
        <Button variant="ghost" href="/portal/content">
          Back to content
        </Button>
      </div>
    </form>
  );
}
