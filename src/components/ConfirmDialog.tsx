interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancel·lar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={() => !busy && onCancel()}>
      <section className="modal confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={`confirm-icon ${danger ? 'danger' : ''}`}>{danger ? '!' : '✓'}</div>
        <div className="confirm-copy">
          <p className="eyebrow">CONFIRMACIÓ</p>
          <h2 id="confirm-dialog-title">{title}</h2>
          <p>{message}</p>
        </div>
        <div className="confirm-actions">
          <button className="button secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button className={danger ? 'button danger-solid' : 'button primary'} onClick={() => void onConfirm()} disabled={busy}>
            {busy ? 'Processant...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
