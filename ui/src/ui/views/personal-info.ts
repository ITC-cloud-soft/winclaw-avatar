import { html, nothing } from "lit";
import type { PersonalInfoData } from "../controllers/personal-info.ts";
import { t } from "../../i18n/index.js";

export type PersonalInfoProps = {
  loading: boolean;
  saving: boolean;
  data: PersonalInfoData | null;
  form: PersonalInfoData | null;
  dirty: boolean;
  error: string | null;
  success: string | null;
  onFieldChange: (field: keyof PersonalInfoData, value: string) => void;
  onSave: () => void;
  onRefresh: () => void;
};

export function renderPersonalInfo(props: PersonalInfoProps) {
  const { form } = props;
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">${t("personal.title")}</div>
          <div class="card-sub">
            ${t("personal.subtitle")}
          </div>
        </div>
        <button
          class="btn"
          ?disabled=${props.loading}
          @click=${props.onRefresh}
        >
          ${props.loading ? t("personal.loading") : t("personal.reload")}
        </button>
      </div>

      ${
        props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${props.error}
            </div>`
          : nothing
      }
      ${
        props.success
          ? html`<div class="callout success" style="margin-top: 12px;">
              ${props.success}
            </div>`
          : nothing
      }

      ${
        form
          ? html`
              <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 16px;">
                <label class="field">
                  <span class="field-label">${t("personal.employeeId")}</span>
                  <input
                    type="text"
                    .value=${form.employeeId ?? ""}
                    placeholder=${t("personal.employeeIdPlaceholder")}
                    @input=${(e: Event) =>
                      props.onFieldChange("employeeId", (e.target as HTMLInputElement).value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">${t("personal.employeeName")}</span>
                  <input
                    type="text"
                    .value=${form.employeeName ?? ""}
                    placeholder=${t("personal.employeeNamePlaceholder")}
                    @input=${(e: Event) =>
                      props.onFieldChange("employeeName", (e.target as HTMLInputElement).value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">${t("personal.email")}</span>
                  <input
                    type="email"
                    .value=${form.employeeEmail ?? ""}
                    placeholder=${t("personal.emailPlaceholder")}
                    @input=${(e: Event) =>
                      props.onFieldChange("employeeEmail", (e.target as HTMLInputElement).value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">${t("personal.grcUrl")}</span>
                  <input
                    type="url"
                    .value=${form.grcUrl ?? ""}
                    placeholder=${t("personal.grcUrlPlaceholder")}
                    @input=${(e: Event) =>
                      props.onFieldChange("grcUrl", (e.target as HTMLInputElement).value)}
                  />
                </label>

                <div
                  class="callout"
                  style="margin-top: 4px; opacity: 0.7; font-size: 0.85em;"
                >
                  <div><strong>Node ID:</strong> ${form.nodeId || t("personal.notConnected")}</div>
                </div>

                <div class="row" style="margin-top: 8px; gap: 8px;">
                  <button
                    class="btn primary"
                    ?disabled=${!props.dirty || props.saving}
                    @click=${props.onSave}
                  >
                    ${props.saving ? t("personal.saving") : t("personal.save")}
                  </button>
                </div>
              </div>
            `
          : props.loading
            ? html`<div class="muted" style="margin-top: 16px;">${t("personal.loading")}</div>`
            : html`<div class="muted" style="margin-top: 16px;">${t("personal.loadError")}</div>`
      }
    </section>
  `;
}
