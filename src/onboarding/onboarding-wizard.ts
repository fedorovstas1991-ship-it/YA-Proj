import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './onboarding-welcome.js';
import './onboarding-api-key.js';

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
      font-family: var(--font-body);
    }

    .wizard-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 800px;
      padding: 20px;
    }

    .wizard-steps {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 40px;
      padding: 0;
      list-style: none;
    }

    .wizard-step {
      color: var(--anthropic-muted-text);
      font-size: 1.1em;
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
  steps: string[] = ['Welcome', 'API Key'];

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

  private _handleConnectApiKey(event: CustomEvent) {
    console.log('API Key Connected:', event.detail.apiKey);
    // Here you would typically save the API key and complete onboarding
    this.dispatchEvent(new CustomEvent('onboarding-complete', { bubbles: true, composed: true }));
  }

  private _handleSkipOnboarding() {
    console.log('Onboarding Skipped');
    this.dispatchEvent(new CustomEvent('onboarding-complete', { bubbles: true, composed: true }));
  }
}