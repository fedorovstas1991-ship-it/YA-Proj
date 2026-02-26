import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './onboarding-welcome.js';
import './onboarding-api-key.js';
import { GatewayBrowserClient } from '../ui/gateway.ts'; // Correct path to gateway.ts
import {
  KIMI_BASE_URL,
  KIMI_MODEL_ID,
  KIMI_MODEL_NAME,
  KIMI_MODEL_REF,
  KIMI_PROVIDER,
  isLikelyYandexQuotaToken,
} from './kimi-preset.js';

export function buildKimiOnboardingPatch(apiKey: string) {
  return {
    models: {
      mode: "replace",
      providers: {
        [KIMI_PROVIDER]: {
          baseUrl: KIMI_BASE_URL,
          apiKey,
          api: "openai-completions",
          models: [
            {
              id: KIMI_MODEL_ID,
              name: KIMI_MODEL_NAME,
              api: "openai-completions",
              reasoning: true,
              input: ["text", "image"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 8192,
            },
          ],
        },
      },
    },
    agents: {
      defaults: {
        model: {
          primary: KIMI_MODEL_REF,
        },
      },
    },
    plugins: {
      slots: {
        memory: "none",
      },
    },
  };
}

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
      background: #ffffff;
      color: #1a1a1a;
      font-family: 'Inter', sans-serif;
    }

    .wizard-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      width: 100%;
      max-width: 480px;
      padding: 40px 24px;
      box-sizing: border-box;
    }

    /* Progress dots instead of text tabs */
    .wizard-dots {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 32px;
      padding: 0;
      list-style: none;
    }

    .wizard-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #e0e0e0;
      transition: background 0.2s ease, transform 0.2s ease;
    }

    .wizard-dot.active {
      background: #e30000;
      transform: scale(1.15);
    }

    .wizard-dot.completed {
      background: #1a1a1a;
    }

    .wizard-logo {
      height: 48px;
      width: auto;
      image-rendering: pixelated;
      margin-bottom: 24px;
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
  steps: string[] = ['Добро пожаловать', 'Рабочий токен'];

  @property({ attribute: false })
  client: GatewayBrowserClient | null = null;

  render() {
    return html`
      <div class="wizard-container">
        <img src="/ya_logo_pixel.png" alt="YA" class="wizard-logo" />
        <ul class="wizard-dots">
          ${this.steps.map(
      (_step, index) => html`
              <li class="wizard-dot ${this._currentStep === index ? 'active' :
          index < this._currentStep ? 'completed' : ''
        }"></li>
            `
    )}
        </ul>

        <div class="wizard-content">
          ${this._currentStep === 0
        ? html`<onboarding-welcome @next-step=${this._nextStep}></onboarding-welcome>`
        : html`<onboarding-api-key
                @connect-api-key=${this._handleConnectApiKey}
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
    const apiKey = String(event.detail.apiKey ?? "").trim();
    if (!this.client) {
      console.error('Gateway client not available.');
      return;
    }
    if (!isLikelyYandexQuotaToken(apiKey)) {
      console.error('Invalid quota token format.');
      return;
    }

    try {
      // Step 1: Get current config to obtain baseHash
      const configSnapshot = await this.client.request<{ hash?: string }>('config.get', {});
      const baseHash = (configSnapshot as { hash?: string })?.hash ?? undefined;

      // Step 2: Build the patch
      const patch = buildKimiOnboardingPatch(apiKey);

      // Step 3: Patch with baseHash
      await this.client.request('config.patch', {
        raw: JSON.stringify(patch),
        ...(baseHash ? { baseHash } : {}),
      });

      console.log('Токен подключён, конфиг обновлён');
      this.dispatchEvent(new CustomEvent('onboarding-complete', { bubbles: true, composed: true }));
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  }
}
