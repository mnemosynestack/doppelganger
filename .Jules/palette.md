## 2025-05-14 - Keyboard Navigation for Action Palette
**Learning:** For command-palette style interfaces, keyboard-only operation is expected by power users and is a critical accessibility feature. 2D navigation (arrows) in a grid layout can be tricky but feels much more "native" than simple linear tab order.
**Action:** Always implement Arrow key and Enter support for grid-based selection menus to ensure a "keyboard-first" experience.

## 2025-05-14 - Shortcut Hint Discoverability
**Learning:** Invisible shortcuts (like Ctrl+K or Ctrl+Enter) are only useful if users know they exist. Incorporating them into tooltips and ARIA labels provides "just-in-time" education.
**Action:** Add shortcut hints to the 'title' and 'aria-label' of key action buttons.

## 2025-06-15 - Multi-sensory Feedback in Notifications
**Learning:** Relying solely on color for notification status (e.g., emerald for success, red for error) is an accessibility barrier for color-blind users. Adding distinct icons (check vs. error) and explicit labels ensures the status is clear to everyone.
**Action:** Always include tone-specific icons and clear text labels ('Success'/'Error') in toast notifications and alerts.
