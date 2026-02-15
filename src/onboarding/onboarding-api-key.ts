import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('onboarding-api-key')
export class OnboardingApiKey extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
      gap: 20px;
      max-width: 600px;
      margin: 0 auto;
    }

    .mockup-container {
      background-color: white; /* Изменено с var(--card) на white */
      border-radius: var(--anthropic-border-radius);
      box-shadow: var(--anthropic-shadow-lg);
      padding: 30px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .mockup-header h3 {
      margin: 0;
      color: var(--anthropic-text);
      font-size: 1.8em;
      font-weight: 600;
    }

    p {
      color: var(--anthropic-muted-text);
      font-size: 1.1em;
      line-height: 1.6;
      margin: 0;
      margin-bottom: 20px;
    }

    .form-group {
      width: 100%;
      text-align: left;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: var(--anthropic-text);
    }

    .mockup-input {
      width: 100%;
      padding: 12px 15px;
      border: 1px solid var(--anthropic-border);
      border-radius: var(--anthropic-border-radius);
      font-family: "Inter", sans-serif;
      font-size: 1em;
      box-sizing: border-box;
      background-color: var(--anthropic-input-bg);
      color: var(--anthropic-text);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .mockup-input::placeholder {
      color: var(--anthropic-muted-text);
    }
    .mockup-input:focus {
      outline: none;
      border-color: var(--anthropic-accent);
      box-shadow: 0 0 0 2px rgba(var(--anthropic-accent-rgb), 0.2); /* Обновлено */
    }

    .mockup-button-group {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      width: 100%;
      margin-top: 20px;
    }

    .btn {
      padding: 10px 20px;
      border-radius: var(--anthropic-border-radius);
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn-secondary {
      background-color: transparent;
      color: var(--anthropic-text);
      border: 1px solid var(--anthropic-border);
    }

    .btn-secondary:hover {
      background-color: var(--anthropic-bg-accent);
      transform: translateY(-1px);
    }

    .btn-primary {
      background-color: var(--anthropic-accent);
      color: white;
      border: none;
    }

    .btn-primary:hover {
      background-color: #c2684f; /* Darker accent */
      transform: translateY(-1px);
    }
  `;

  @property({ type: String })
  apiKey: string = '';

  render() {
    return html`
      <div class="mockup-container">
        <div class="mockup-header">
          <h3>Подключите ваш AI</h3>
        </div>
        <p>Подключите ваш любимый AI, введя API ключ.</p>
        <div class="form-group">
          <label for="api-key">API Ключ (например, OpenAI, Anthropic)</label>
          <input
            type="text"
            id="api-key"
            class="mockup-input"
            placeholder="sk-***************************"
            .value=${this.apiKey}
            @input=${this._handleInputChange}
          />
        </div>
        <div class="mockup-button-group">
          <button class="btn btn-secondary" @click=${this._handleSkip}>Пропустить</button>
          <button class="btn btn-primary" @click=${this._handleConnect}>Подключить</button>
        </div>
      </div>
    `;
  }

  private _handleInputChange(event: Event) {
    this.apiKey = (event.target as HTMLInputElement).value;
  }

  private _handleSkip() {
    this.dispatchEvent(new CustomEvent('skip-onboarding', { bubbles: true, composed: true }));
  }

  private _handleConnect() {
    this.dispatchEvent(
      new CustomEvent('connect-api-key', {
        detail: { apiKey: this.apiKey },
        bubbles: true,
        composed: true,
      })
    );
  }
}
