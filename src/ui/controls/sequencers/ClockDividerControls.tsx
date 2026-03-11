/**
 * Clock Divider Module Controls
 *
 * Divides an incoming clock by /2, /4, /8, /16.
 * No user-adjustable parameters — just connect clock in and use the divided outputs.
 */

export function ClockDividerControls() {
  return (
    <div style={{ padding: '4px 0', fontSize: 11, opacity: 0.7, textAlign: 'center' }}>
      Connect a clock source to divide it by /2, /4, /8, and /16.
    </div>
  )
}
