import { cx } from '@/lib/cx';

export interface MapPinProps {
  src: string;
  pins: { x: number; y: number; label: string; href?: string }[];
  caption?: string;
  className?: string;
}

/**
 * The brokerage's map image of the playable area with hand-placed pins (x/y are percentages of the image).
 * Nothing is geocoded: a pin only exists where someone placed it.
 */
export function MapPin({ src, pins, caption, className }: MapPinProps) {
  return (
    <figure className={cx('map', className)}>
      <div className="map-frame">
        {/* eslint-disable-next-line @next/next/no-img-element -- a single uploaded image whose aspect ratio pins depend on */}
        <img src={src} alt="Map of the playable area" className="map-img" />
        {pins.map((p, i) =>
          p.href ? (
            <a key={i} href={p.href} className="map-pin" style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-label={p.label} title={p.label}>
              <span aria-hidden />
            </a>
          ) : (
            <span key={i} className="map-pin" style={{ left: `${p.x}%`, top: `${p.y}%` }} role="img" aria-label={p.label}>
              <span aria-hidden />
            </span>
          ),
        )}
      </div>
      {caption ? <figcaption className="body-s muted">{caption}</figcaption> : null}
    </figure>
  );
}
