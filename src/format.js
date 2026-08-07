// Shared text formatting — the one place numbers and markup-bound strings
// are prepared. Lives outside ui/ so domain modules can reach it too
// (they must not import from ui/, and this file imports nothing).

// Every user-facing number goes through this: thousands separators
// everywhere, no exceptions (audit C5).
export const num = (n) => Number(n).toLocaleString('en-US');

// Escape for HTML text or a double-quoted attribute. Every renderer shares
// this one implementation so they can never escape differently.
export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Quote a value for a single-quoted JS string that sits inside an inline
// handler attribute (onclick="fn('…')"). Two layers, in order: JS escaping
// for \ and ', then HTML attribute escaping — the browser decodes entities
// before the JS engine parses, so the handler still receives the raw text.
export const jsStr = (s) => esc(String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
