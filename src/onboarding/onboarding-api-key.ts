import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  QUOTA_TOKEN_EXAMPLE,
  QUOTA_URL,
  isLikelyYandexQuotaToken,
} from './kimi-preset.js';

export function normalizeQuotaTokenInput(value: string): string {
  return value.trim();
}

export function isConnectButtonEnabled(value: string): boolean {
  return isLikelyYandexQuotaToken(normalizeQuotaTokenInput(value));
}

export function buildQuotaInstructions(): string {
  return `1) Перейдите на ${QUOTA_URL}\n2) Нажмите "Получить токен"\n3) Вставьте токен формата y1_...`;
}

@customElement('onboarding-api-key')
export class OnboardingApiKey extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      gap: 24px;
      width: 100%;
      box-sizing: border-box;
    }

    .api-key-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 32px 24px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    h3 {
      margin: 0;
      color: #1a1a1a;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    p {
      color: #666;
      font-size: 15px;
      line-height: 1.6;
      margin: 0;
      max-width: 440px;
    }

    a {
      color: #d00000;
      text-decoration: none;
      border-bottom: 1px solid rgba(208, 0, 0, 0.25);
    }

    a:hover {
      border-bottom-color: rgba(208, 0, 0, 0.5);
    }

    .form-group {
      width: 100%;
      text-align: left;
      margin-top: 8px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      font-size: 13px;
      color: #666;
    }

    .input-field {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      box-sizing: border-box;
      background: #fafafa;
      color: #1a1a1a;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .input-field::placeholder {
      color: #bbb;
    }

    .input-field:focus {
      outline: none;
      border-color: #e30000;
      box-shadow: 0 0 0 3px rgba(227, 0, 0, 0.08);
      background: #fff;
    }

    .button-group {
      display: flex;
      justify-content: flex-start;
      gap: 8px;
      width: 100%;
      margin-top: 12px;
    }

    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      font-family: inherit;
      transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn-primary {
      background: #1a1a1a;
      color: #ffffff;
      border: none;
    }

    .btn-primary:hover {
      background: #333;
      transform: translateY(-1px);
    }

    .btn-primary:disabled {
      background: #9ca3af;
      color: #f5f5f5;
      cursor: not-allowed;
      transform: none;
    }

    .token-help {
      width: 100%;
      text-align: left;
      font-size: 13px;
      line-height: 1.5;
      color: #555;
    }

    .token-help ol {
      margin: 0;
      padding-left: 18px;
    }

    .token-error {
      width: 100%;
      text-align: left;
      margin-top: 4px;
      font-size: 12px;
      color: #b91c1c;
    }
  `;

  @property({ type: String })
  apiKey: string = '';

  render() {
    const normalizedToken = normalizeQuotaTokenInput(this.apiKey);
    const canConnect = isConnectButtonEnabled(normalizedToken);
    const showValidation = normalizedToken.length > 0 && !canConnect;
    return html`
      <div class="api-key-card">
        <h3>Подключите рабочий токен</h3>
        <p>
          Чтобы запустить ассистента на Kimi K2.5, получите персональный токен в
          <a href=${QUOTA_URL} target="_blank" rel="noreferrer">Yandex Quota</a>.
        </p>
        <div class="token-help">
          <ol>
            <li>Откройте ${QUOTA_URL}</li>
            <li>Нажмите «Получить токен»</li>
            <li>Скопируйте токен и вставьте ниже</li>
          </ol>
        </div>
        <div class="form-group">
          <label for="api-key">Ваш рабочий токен (для безопасности данных и доступа к вашей квоте)</label>
          <input
            type="text"
            id="api-key"
            class="input-field"
            placeholder=${QUOTA_TOKEN_EXAMPLE}
            .value=${this.apiKey}
            @input=${this._handleInputChange}
          />
          ${showValidation
        ? html`<div class="token-error">Нужен токен из quota (формат начинается с <code>y1_</code>).</div>`
        : null}
        </div>
        <div class="button-group">
          <button class="btn btn-primary" ?disabled=${!canConnect} @click=${this._handleConnect}>Подключить</button>
        </div>
      </div>
    `;
  }

  private _handleInputChange(event: Event) {
    this.apiKey = (event.target as HTMLInputElement).value;
  }

  private _handleConnect() {
    const apiKey = normalizeQuotaTokenInput(this.apiKey);
    if (!isConnectButtonEnabled(apiKey)) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent('connect-api-key', {
        detail: { apiKey },
        bubbles: true,
        composed: true,
      })
    );
  }
}
