import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './onboarding-welcome.js';
import './onboarding-api-key.js';
import { GatewayBrowserClient, GatewayHelloOk } from '../ui/gateway.ts'; // Correct path to gateway.ts

@customElement('onboarding-wizard')
export class OnboardingWizard extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      width: 100%;
      background-color: var(--anthropic-light-bg);
      color: var(--anthropic-text);
      transition: background-color 0.3s ease, color 0.3s ease;
      font-family: var(--font-body, 'Inter', sans-serif); /* Используем Inter по умолчанию */
    }

    .wizard-container {
      background-color: var(--anthropic-input-bg); /* Используем цвет фона для контейнера */
      border-radius: var(--anthropic-border-radius);
      box-shadow: var(--anthropic-shadow-lg);
      padding: 40px;
      width: 100%;
      max-width: 600px; /* Уменьшил до 600px для лучшего соответствия слайдам онбординга */
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .wizard-steps {
      display: flex;
      justify-content: center;
      gap: 20px; /* Увеличил отступ между шагами */
      margin-bottom: 40px;
      padding: 0;
      list-style: none;
    }

    .wizard-step {
      color: var(--anthropic-muted-text);
      font-size: 1.2em; /* Увеличил размер шрифта */
      font-weight: 500;
      position: relative;
      padding-bottom: 8px;
    }

    .wizard-step.active {
      color: var(--anthropic-text);
    }

    .wizard-step.active::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: var(--anthropic-accent);
      border-radius: 1px;
    }

    .wizard-content {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
  `;

  @state()
  private _currentStep: number = 0;

  @property({ type: Array })
  steps: string[] = ['Добро пожаловать', 'Элиза Токен'];

  @property({ attribute: false })
  client: GatewayBrowserClient | null = null;

  render() {
    return html`
      <div class="wizard-container">
        <ul class="wizard-steps">
          ${this.steps.map(
      (step, index) => html`
              <li class="wizard-step ${this._currentStep === index ? 'active' : ''}">
                ${step}
              </li>
            `
    )}
        </ul>

        <div class="wizard-content">
          ${this._currentStep === 0
        ? html`<onboarding-welcome @next-step=${this._nextStep}></onboarding-welcome>`
        : html`<onboarding-api-key
                @connect-api-key=${this._handleConnectApiKey}
                @skip-onboarding=${this._handleSkipOnboarding}
              ></onboarding-api-key>`}
        </div>
      </div>
    `;
  }

  private _nextStep() {
    if (this._currentStep < this.steps.length - 1) {
      this._currentStep++;
    }
  }

  private async _handleConnectApiKey(event: CustomEvent) {
    const apiKey = event.detail.apiKey;
    if (!this.client) {
      console.error('Gateway client not available.');
      return;
    }

    try {
      // Step 1: Get current config to obtain baseHash
      const configSnapshot = await this.client.request<{ hash?: string }>('config.get', {});
      const baseHash = (configSnapshot as { hash?: string })?.hash ?? undefined;

      // Step 2: Build the patch
      const patch = {
        models: {
          mode: "replace",
          providers: {
            anthropic: {
              baseUrl: "https://api.eliza.yandex.net/raw/anthropic",
              apiKey: apiKey,
              api: "anthropic-messages",
              models: [
                {
                  id: "claude-sonnet-4-5",
                  name: "Claude Sonnet 4.5",
                },
              ],
            },
          },
        },
        agents: {
          defaults: {
            model: {
              primary: "anthropic/claude-sonnet-4-5",
            },
          },
        },
        plugins: {
          slots: {
            memory: "none",
          },
        },
      };

      // Step 3: Patch with baseHash
      await this.client.request('config.patch', {
        raw: JSON.stringify(patch),
        ...(baseHash ? { baseHash } : {}),
      });

      console.log('Элиза Токен подключён, конфиг обновлён');
      this.dispatchEvent(new CustomEvent('onboarding-complete', { bubbles: true, composed: true }));
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  }

  private _handleSkipOnboarding() {
    console.log('Onboarding Skipped');
    this.dispatchEvent(new CustomEvent('onboarding-complete', { bubbles: true, composed: true }));
  }
}