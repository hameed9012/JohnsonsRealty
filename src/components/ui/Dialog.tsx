'use client';

import { useEffect, useId, useRef } from 'react';
import type * as React from 'react';
import { cx } from '@/lib/cx';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Native <dialog> with focus trapping and Escape handled by the browser. */
function BaseDialog({ open, onClose, title, children, footer, className, drawer }: DialogProps & { drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx('jr-dialog', drawer && 'jr-drawer', className)}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="jr-dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="jr-btn jr-btn--ghost jr-btn--sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="jr-dialog-body">{children}</div>
      {footer ? <div className="jr-dialog-foot">{footer}</div> : null}
    </dialog>
  );
}

export function Modal(props: DialogProps) {
  return <BaseDialog {...props} />;
}

/** Side panel on desktop, bottom sheet under 640px (filters, quick edit). */
export function Drawer(props: DialogProps) {
  return <BaseDialog {...props} drawer />;
}
