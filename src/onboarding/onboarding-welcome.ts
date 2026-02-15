import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('onboarding-welcome')
export class OnboardingWelcome extends LitElement {
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
    }

    .btn {
      background-color: var(--anthropic-accent);
      color: white;
      padding: 12px 25px;
      border-radius: var(--anthropic-border-radius);
      border: none;
      font-size: 1.1em;
      cursor: pointer;
      font-weight: 600;
      transition: background-color 0.2s ease, transform 0.2s ease;
    }

    .btn:hover {
      background-color: #c2684f; /* Darker accent */
      transform: translateY(-1px);
    }

    .btn:active {
      transform: translateY(0);
    }
  `;

  render() {
    return html`
      <div class="mockup-container">
        <div class="mockup-header">
          <h3>Добро пожаловать в YA!</h3>
        </div>
        <p>Мы рады видеть вас. Приготовьтесь к новому уровню продуктивности.</p>
        <button class="btn" @click=${this._handleStart}>Начать</button>
      </div>
    `;
  }

  private _handleStart() {
    this.dispatchEvent(new CustomEvent('next-step', { bubbles: true, composed: true }));
  }
}
