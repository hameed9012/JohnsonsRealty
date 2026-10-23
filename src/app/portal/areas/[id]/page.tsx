import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AreaForm } from '@/components/portal/AreaForm';
import { ImageField } from '@/components/ui/ImageField';
import { clearImage, getImageTarget, setImage } from '@/server/actions/images';
import { mediaSrc } from '@/server/queries/media';
import { Breadcrumbs } from '@/components/ui/layout';
import { can } from '@/lib/permissions';
import { getAreas } from '@/server/queries/areas';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Edit area' };

export default async function AreaEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/areas/${id}`);
  if (!can(actor, 'areas.manage')) notFound();
  const all = await getAreas();
  const isNew = id === 'new';
  const a = isNew ? null : all.find((x) => x.id === id);
  if (!isNew && !a) notFound();
  const hero = a ? await mediaSrc(a.heroMediaId) : null;
  const slot = a ? { kind: 'area' as const, id: a.id } : null;
  const parents = all.filter((x) => !x.parentId && x.id !== a?.id).map((x) => ({ value: x.id, label: x.name }));
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Areas', href: '/portal/areas' }, { label: a?.name ?? 'New area' }]} />
      <h1 className="heading-1">{a?.name ?? 'New area'}</h1>
      {slot ? (
        <div className="panel">
          <ImageField
            label="Area photo"
            hint="A wide in-game photo of the area, 21:9."
            ratio="21 / 9"
            current={hero}
            getTarget={getImageTarget.bind(null, slot)}
            save={setImage.bind(null, slot)}
            clear={clearImage.bind(null, slot)}
          />
        </div>
      ) : null}
      <div className="panel">
        <AreaForm
          parents={parents}
          values={{
            id: a?.id ?? null,
            name: a?.name ?? '',
            slug: a?.slug ?? '',
            parentId: a?.parentId ?? '',
            city: a?.city ?? '',
            postalCodes: a?.postalCodes.join(', ') ?? '',
            description: a?.description ?? '',
            police: a?.police ?? '',
            fire: a?.fire ?? '',
            schoolDistrict: a?.schoolDistrict ?? '',
            displayOrder: String(a?.displayOrder ?? 0),
            selectable: a?.selectable ?? true,
          }}
        />
      </div>
    </div>
  );
}
