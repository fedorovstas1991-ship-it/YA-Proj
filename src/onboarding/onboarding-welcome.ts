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
      padding: 24px;
      text-align: center;
      gap: 24px;
      width: 100%;
      box-sizing: border-box;
    }

    .welcome-card {
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
      max-width: 360px;
    }

    .btn-start {
      margin-top: 8px;
      background: #1a1a1a;
      color: #ffffff;
      padding: 12px 32px;
      border-radius: 8px;
      border: none;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.15s ease;
      font-family: inherit;
    }

    .btn-start:hover {
      background: #333;
      transform: translateY(-1px);
    }

    .btn-start:active {
      transform: translateY(0);
    }
  `;

  render() {
    return html`
      <div class="welcome-card">
        <h3>Добро пожаловать в YA!</h3>
        <p>Мы рады видеть вас. Приготовьтесь к новому уровню продуктивности.</p>
        <button class="btn-start" @click=${this._handleStart}>Начать</button>
      </div>
    `;
  }

  private _handleStart() {
    this.dispatchEvent(new CustomEvent('next-step', { bubbles: true, composed: true }));
  }
}
