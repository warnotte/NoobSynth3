import type { ReactNode } from 'react'

type PanelSectionProps = {
  title: string
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
}

export function PanelSection({
  title,
  collapsed,
  onToggle,
  children,
}: PanelSectionProps) {
  return (
    <div className={`panel-section ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-section-header">
        <button
          type="button"
          className={`panel-section-toggle ${collapsed ? 'is-collapsed' : ''}`}
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
        >
          <span className="panel-toggle-glyph" aria-hidden="true" />
          <span className="panel-title">{title}</span>
        </button>
      </div>
      {!collapsed && <div className="panel-section-body">{children}</div>}
    </div>
  )
}
