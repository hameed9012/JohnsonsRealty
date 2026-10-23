'use client';

import { useFormAction } from '@/components/forms/useFormAction';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import { SelectField, TextField } from '@/components/ui/fields';
import { saveArea } from '@/server/actions/admin';

export interface AreaFormValues {
  id: string | null;
  name: string;
  slug: string;
  parentId: string;
  city: string;
  postalCodes: string;
  description: string;
  police: string;
  fire: string;
  schoolDistrict: string;
  displayOrder: string;
  selectable: boolean;
}

export function AreaForm({ values, parents }: { values: AreaFormValues; parents: { value: string; label: string }[] }) {
  const { formAction, pending, errors } = useFormAction(saveArea.bind(null, values.id));
  return (
    <form action={formAction} className="stack-lg" noValidate>
      <div className="grid-12">
        <TextField className="span-6" label="Name" name="name" required defaultValue={values.name} error={errors.name} />
        <TextField className="span-6" label="Slug" name="slug" mono defaultValue={values.slug} hint="Used in the web address. Leave blank to make one from the name." error={errors.slug} />
        <SelectField className="span-6" label="Inside" name="parentId" placeholder="Top level (a town or township)" options={parents} defaultValue={values.parentId} error={errors.parentId} />
        <TextField className="span-6" label="Town or township" name="city" defaultValue={values.city} hint="Filled into documents with the area." error={errors.city} />
        <TextField className="span-6" label="Postal codes" name="postalCodes" mono defaultValue={values.postalCodes} hint="Separate several with commas." error={errors.postalCodes} />
        <TextField className="span-6" label="Display order" name="displayOrder" mono inputMode="numeric" defaultValue={values.displayOrder} error={errors.displayOrder} />
      </div>
      <TextField label="Description" name="description" multiline rows={5} defaultValue={values.description} hint="Shown on the area page." error={errors.description} />
      <fieldset className="jr-fieldset">
        <legend>Services</legend>
        <div className="grid-12">
          <TextField className="span-4" label="Police" name="police" defaultValue={values.police} error={errors.police} />
          <TextField className="span-4" label="Fire" name="fire" defaultValue={values.fire} error={errors.fire} />
          <TextField className="span-4" label="School district" name="schoolDistrict" defaultValue={values.schoolDistrict} error={errors.schoolDistrict} />
        </div>
      </fieldset>
      <Toggle label="Listings can be placed in this area" hint="Turn off for towns that only group neighbourhoods." name="selectable" defaultChecked={values.selectable} />
      <div className="row">
        <Button type="submit" loading={pending}>
          {values.id ? 'Save area' : 'Add area'}
        </Button>
        <Button variant="ghost" href="/portal/areas">
          Back to areas
        </Button>
      </div>
    </form>
  );
}
