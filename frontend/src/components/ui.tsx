import { useEffect, useId, type CSSProperties, type ReactNode } from 'react'
import { CheckCircle2, X } from 'lucide-react'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? ' brand-lockup--compact' : ''}`} aria-label="SplitWeave">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && <span className="brand-word">SplitWeave</span>}
    </span>
  )
}

export function Avatar({
  name,
  color,
  size = 'medium',
}: {
  name: string
  color: string
  size?: 'small' | 'medium' | 'large'
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('')

  return (
    <span
      className={`avatar avatar--${size}`}
      style={{ '--avatar-color': color } as CSSProperties}
      aria-label={name}
      title={name}
    >
      {initials}
    </span>
  )
}

export function AvatarStack({ members }: { members: Array<{ id: string; name: string; color: string }> }) {
  return (
    <span className="avatar-stack" aria-label={`${members.length} members`}>
      {members.slice(0, 4).map((member) => (
        <Avatar key={member.id} name={member.name} color={member.color} size="small" />
      ))}
    </span>
  )
}

export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  size = 'medium',
}: {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  size?: 'small' | 'medium' | 'large'
}) {
  const titleId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  )
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3500)
    return () => window.clearTimeout(timer)
  }, [onClose])

  return (
    <div className="toast" role="status">
      <CheckCircle2 size={19} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss notification">
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  )
}

export function LoadingSurface() {
  return (
    <div className="loading-surface" aria-label="Loading">
      <div className="skeleton skeleton--title" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
      </div>
      <div className="skeleton skeleton--panel" />
    </div>
  )
}

export function ErrorSurface({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-surface" role="alert">
      <span className="error-surface__code">!</span>
      <div>
        <h2>We couldn't load this view</h2>
        <p>{message}</p>
      </div>
      <button type="button" className="button button--secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
