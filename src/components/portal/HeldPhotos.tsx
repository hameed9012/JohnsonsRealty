'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { Uploader, type UploaderPhoto } from '@/components/ui/Uploader';
import { deletePhoto, getUploadTarget, registerPhoto, savePhotos } from '@/server/actions/listings';

/**
 * Photos for an imported listing that is Active but held off the public site. Once it has 3 photos with
 * descriptions and they're saved, it goes live without another review.
 */
export function HeldPhotos({ listingId, initial }: { listingId: string; initial: UploaderPhoto[] }) {
  const [photos, setPhotos] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const ready = photos.length >= 3 && photos.every((p) => p.alt.trim());
  return (
    <div className="stack">
      <Uploader
        photos={photos}
        getTarget={getUploadTarget}
        register={async (u) => {
          const r = await registerPhoto(listingId, u);
          return r.ok && 'photo' in r ? { ok: true, photo: r.photo } : { ok: false, message: r.message };
        }}
        onChange={setPhotos}
        onRemove={async (id) => {
          const r = await deletePhoto(listingId, id);
          if (!r.ok) toast({ message: r.message ?? 'Couldn’t remove that photo.', tone: 'danger' });
          return r.ok;
        }}
      />
      <div className="row">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const cover = photos.find((p) => p.isCover)?.id ?? photos[0]?.id ?? null;
              const r = await savePhotos(listingId, { order: photos.map((p) => p.id), coverId: cover }, photos.map((p) => ({ id: p.id, alt: p.alt, caption: p.caption })));
              toast({ message: r.message ?? (r.ok ? 'Photos saved' : 'Couldn’t save the photos.'), tone: r.ok ? 'success' : 'danger' });
              if (r.ok) router.refresh();
            })
          }
        >
          Save photos
        </Button>
        <span className="body-s muted">{ready ? 'Ready: saving puts it on the public site.' : `${photos.length} of 3 photos, each with a description.`}</span>
      </div>
    </div>
  );
}
