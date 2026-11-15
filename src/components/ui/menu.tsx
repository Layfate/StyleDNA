import * as Primitive from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'

export function Menu({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className="menu-content" align="end" sideOffset={8}>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
export function MenuItem({
  children,
  onSelect,
  disabled,
}: {
  children: ReactNode
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <Primitive.Item className="menu-item" onSelect={onSelect} disabled={disabled}>
      {children}
    </Primitive.Item>
  )
}
