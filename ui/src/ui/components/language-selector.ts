/**
 * language-selector.ts
 *
 * Lit render function for the language selector <select> component.
 * Renders a styled <select> element populated with all supported locales.
 * On change it calls setLocale() and — because setLocale() notifies all
 * subscribeLocale() listeners — the host Lit components re-render
 * automatically.
 *
 * Pattern: pure functional render, same approach as views/chat.ts.
 *
 * Usage in a Lit host component:
 *   import { renderLanguageSelector } from './components/language-selector';
 *   // inside render():
 *   ${renderLanguageSelector()}
 */

import { html } from "lit";
import {
  getSupportedLocales,
  getLocale,
  setLocale,
  LOCALE_NAMES,
  type Locale,
} from "../../i18n/index.ts";

// ---------------------------------------------------------------------------
// Optional props
// ---------------------------------------------------------------------------

export interface LanguageSelectorProps {
  /** Additional CSS class names to append to the <select> element */
  className?: string;
  /** aria-label override; defaults to the English string "Language" */
  ariaLabel?: string;
}

// ---------------------------------------------------------------------------
// Render function
// ---------------------------------------------------------------------------

/**
 * Renders a <select> element for the language chooser.
 *
 * @param props  Optional configuration props (class override, aria-label).
 */
export function renderLanguageSelector(props: LanguageSelectorProps = {}) {
  const locales = getSupportedLocales();
  const current = getLocale();
  const ariaLabel = props.ariaLabel ?? "Language";
  const className = ["lang-select", props.className].filter(Boolean).join(" ");

  function handleChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const chosen = select.value as Locale;
    void setLocale(chosen);
  }

  return html`
    <div class="lang-select-wrapper" title=${ariaLabel}>
      <span class="lang-select-globe" aria-hidden="true">
        <!-- Globe icon inline -->
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          stroke="currentColor"
          fill="none"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path
            d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10
               15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
          />
        </svg>
      </span>
      <select
        class=${className}
        aria-label=${ariaLabel}
        .value=${current}
        @change=${handleChange}
      >
        ${locales.map(
          (locale) => html`
            <option
              value=${locale}
              ?selected=${locale === current}
            >
              ${LOCALE_NAMES[locale]}
            </option>
          `,
        )}
      </select>
    </div>
  `;
}

/* ── Inline styles ───────────────────────────────────────────────────────────
 * These are authored as a <style> tag helper so the component stays self-
 * contained when dropped into any page. The host stylesheet (layout-v3.css)
 * may override via .lang-select-wrapper / .lang-select selectors.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Returns a Lit html template containing the <style> block for the language
 * selector. Call once per page / shadow-root. In a regular (non-shadow) DOM
 * context this is typically injected via the main entry-point CSS instead;
 * this helper is provided for convenience when using the component in an
 * isolated context.
 */
export function renderLanguageSelectorStyles() {
  return html`
    <style>
      .lang-select-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0;
      }

      .lang-select-globe {
        position: absolute;
        left: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--muted);
        pointer-events: none;
        display: flex;
        align-items: center;
      }

      .lang-select {
        appearance: none;
        -webkit-appearance: none;
        padding: 4px 10px 4px 26px; /* room for globe icon on left */
        height: 30px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-md);
        background: var(--bg-elevated);
        color: var(--text);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        transition:
          border-color var(--duration-fast),
          background var(--duration-fast),
          color var(--duration-fast);
      }

      .lang-select:hover {
        border-color: var(--border-hover);
        background: var(--bg-hover);
      }

      .lang-select:focus-visible {
        outline: none;
        box-shadow: var(--focus-ring);
        border-color: var(--ring);
      }

      /* Dropdown list colours (browser-native; limited styling possible) */
      .lang-select option {
        background: var(--bg-elevated);
        color: var(--text);
      }

      /* Light theme */
      :root[data-theme="light"] .lang-select {
        background: var(--bg-elevated);
        border-color: var(--border);
      }

      :root[data-theme="light"] .lang-select:hover {
        border-color: var(--border-strong);
        background: var(--bg-hover);
      }

      /* Small screen — reduce padding */
      @media (max-width: 480px) {
        .lang-select {
          font-size: 11px;
          padding: 3px 8px 3px 24px;
          height: 26px;
        }

        .lang-select-globe svg {
          width: 12px;
          height: 12px;
        }
      }
    </style>
  `;
}
