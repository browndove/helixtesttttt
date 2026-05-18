/** Shared responsive layout for account / staff / facility onboarding pages. */
export const SETUP_ACCOUNT_MOBILE_CSS = `
.setup-account-shell {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
  min-height: 100dvh;
  min-height: 100svh;
  touch-action: manipulation;
  -webkit-overflow-scrolling: touch;
}
.setup-account-scroll {
  scroll-padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
}
.setup-account-card {
  box-sizing: border-box;
  width: 100%;
  max-width: min(26rem, 100%);
  container-type: inline-size;
  container-name: setup-acct;
}
.setup-phone-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
  min-width: 0;
}
.setup-country-wrap {
  min-width: 0;
  flex: 0 0 auto;
  width: min(11rem, 42%);
}
.setup-phone-input {
  flex: 1 1 0;
  min-width: 0;
}
.setup-otp-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: stretch;
  min-width: 0;
}
.setup-otp-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.setup-otp-verify-btn {
  width: 100%;
  min-height: 42px;
}
.setup-name-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.setup-password-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
}
.setup-staff-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.setup-actions-row {
  display: flex;
  gap: 10px;
  min-width: 0;
}
.setup-actions-row > button {
  flex: 1 1 0;
  min-width: 0;
}
@container setup-acct (max-width: 359px) {
  .setup-name-grid,
  .setup-password-grid,
  .setup-staff-form-grid {
    grid-template-columns: 1fr;
  }
}
@container setup-acct (min-width: 360px) {
  .setup-otp-row {
    flex-direction: row;
    align-items: stretch;
  }
  .setup-otp-input {
    flex: 1 1 0;
    width: auto;
    max-width: 12rem;
  }
  .setup-otp-verify-btn {
    width: auto;
    flex: 0 0 auto;
    min-width: 6.5rem;
  }
}
@media (max-width: 479px) {
  .setup-phone-row {
    flex-direction: column;
    align-items: stretch;
  }
  .setup-country-wrap {
    width: 100%;
    max-width: 100%;
  }
}
@media (max-width: 767px) {
  .setup-step-aside { display: none !important; }
  .setup-step-shell {
    padding-left: max(0px, env(safe-area-inset-left, 0px));
    padding-right: max(0px, env(safe-area-inset-right, 0px));
  }
  .setup-step-right {
    flex: 1 1 auto !important;
    min-height: 100dvh !important;
    min-height: 100svh !important;
    height: auto !important;
  }
  .setup-step-scroll {
    padding:
      max(12px, env(safe-area-inset-top, 0px))
      max(12px, env(safe-area-inset-right, 0px))
      max(20px, env(safe-area-inset-bottom, 0px))
      max(12px, env(safe-area-inset-left, 0px)) !important;
    justify-content: flex-start !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
  }
  .setup-step-inner {
    max-width: 100% !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    padding-top: 8px !important;
    padding-bottom: max(24px, env(safe-area-inset-bottom, 0px)) !important;
  }
  .setup-step-card {
    padding: clamp(16px, 4vw, 22px) clamp(14px, 3.5vw, 20px) !important;
  }
}
@media (min-width: 768px) {
  .setup-step-shell {
    flex-direction: row !important;
    min-height: 100dvh !important;
    height: 100dvh !important;
  }
  .setup-step-aside {
    max-height: none !important;
    height: 100% !important;
    min-height: 0 !important;
    flex: 0 0 clamp(280px, 36vw, 400px) !important;
    width: clamp(280px, 36vw, 400px) !important;
    max-width: none !important;
  }
  .setup-step-right {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }
  .setup-step-scroll {
    overflow-x: hidden !important;
    overflow-y: auto !important;
    justify-content: center !important;
    align-items: center !important;
    padding:
      max(28px, env(safe-area-inset-top, 0px))
      max(40px, env(safe-area-inset-right, 0px))
      max(32px, env(safe-area-inset-bottom, 0px))
      max(40px, env(safe-area-inset-left, 0px)) !important;
  }
  .setup-step-inner--classic {
    max-width: min(34rem, 100%) !important;
    width: 100%;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  .setup-step-inner--clean {
    max-width: min(28rem, 100%) !important;
    width: 100%;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  .setup-desktop-step-label {
    display: block;
    margin: 0 0 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #7a8a9e;
    text-align: center;
  }
  .setup-step-card {
    border-radius: 16px !important;
    padding: clamp(24px, 2.5vw, 32px) clamp(22px, 2vw, 28px) !important;
  }
  .setup-aside-steps {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 28px 0 0;
    padding: 0;
    list-style: none;
  }
  .setup-aside-steps li {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.45);
    line-height: 1.3;
  }
  .setup-aside-steps li.is-active {
    color: #fff;
    font-weight: 600;
  }
  .setup-aside-steps li.is-done {
    color: rgba(127, 178, 240, 0.95);
  }
  .setup-aside-steps__num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .setup-aside-steps li.is-active .setup-aside-steps__num {
    background: #7fb2f0;
    border-color: #7fb2f0;
    color: #0b1e3b;
  }
  .setup-aside-steps li.is-done .setup-aside-steps__num {
    background: rgba(127, 178, 240, 0.2);
    border-color: rgba(127, 178, 240, 0.35);
    color: #7fb2f0;
  }
  .setup-step-shell--clean .setup-step-scroll {
    justify-content: center !important;
    align-items: center !important;
  }
  .setup-step-right--phone .setup-step-scroll,
  .setup-step-right--security .setup-step-scroll {
    background: #e8edf4 !important;
  }
  .setup-step-card--phone,
  .setup-step-card--security {
    width: 100%;
    padding: clamp(28px, 3vw, 36px) clamp(24px, 2.5vw, 32px) !important;
  }
  .setup-flow-page {
    min-height: 0;
  }
  .setup-flow-footer {
    padding-top: 28px;
  }
  .setup-flow-subtitle-dark,
  .setup-security-subtitle {
    max-width: none;
  }
  .setup-otp-input-wrap {
    max-width: 22rem;
    margin-left: auto;
    margin-right: auto;
  }
  .setup-otp-help {
    text-align: center;
    width: 100%;
  }
  .setup-otp-instruction {
    text-align: center;
    max-width: 26rem;
    margin-left: auto;
    margin-right: auto;
  }
  .setup-phone-phase--otp .setup-security-heading,
  .setup-phone-phase--otp .setup-dot-progress {
    text-align: center;
  }
  .setup-phone-phase--verified .setup-security-heading,
  .setup-phone-phase--verified .setup-security-subtitle {
    text-align: center;
    margin-left: auto;
    margin-right: auto;
  }
  .setup-security-heading,
  .setup-flow-body .setup-security-heading {
    text-align: left;
  }
  .setup-step-right--phone .setup-flow-body .setup-security-heading,
  .setup-step-right--security .setup-security-heading {
    font-size: clamp(1.65rem, 2.2vw, 1.9rem);
  }
  .setup-facility-main {
    align-items: center !important;
    padding: 28px 24px 32px !important;
  }
  .setup-facility-card {
    max-width: min(440px, 100%) !important;
    padding: 28px 32px 24px !important;
    border-radius: 16px !important;
    box-shadow: 0 8px 32px rgba(11, 30, 59, 0.08), 0 1px 4px rgba(11, 30, 59, 0.04) !important;
  }
  .setup-facility-header {
    padding-left: max(24px, env(safe-area-inset-left, 0px)) !important;
    padding-right: max(24px, env(safe-area-inset-right, 0px)) !important;
  }
  .setup-staff-shell {
    padding: 40px 32px !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .setup-staff-card-wrap {
    max-width: min(36rem, 100%) !important;
    width: 100% !important;
    margin: 0 auto;
  }
  .setup-staff-card {
    padding: clamp(24px, 3vw, 32px) clamp(22px, 2.5vw, 28px) !important;
    border-radius: 16px !important;
    max-height: calc(100dvh - 80px) !important;
  }
}
@media (max-width: 767px) {
  .setup-desktop-step-label,
  .setup-aside-steps {
    display: none !important;
  }
}
@media (min-width: 1024px) {
  .setup-step-aside {
    flex: 0 0 clamp(300px, 32vw, 440px) !important;
    width: clamp(300px, 32vw, 440px) !important;
  }
  .setup-step-scroll {
    padding:
      max(36px, env(safe-area-inset-top, 0px))
      max(56px, env(safe-area-inset-right, 0px))
      max(40px, env(safe-area-inset-bottom, 0px))
      max(56px, env(safe-area-inset-left, 0px)) !important;
  }
  .setup-step-inner--classic {
    max-width: min(36rem, 100%) !important;
  }
  .setup-step-inner--clean {
    max-width: min(30rem, 100%) !important;
  }
  .setup-facility-card {
    max-width: min(480px, 100%) !important;
    padding: 32px 36px 28px !important;
  }
}
@media (min-width: 1280px) {
  .setup-step-aside {
    flex: 0 0 clamp(320px, 30vw, 480px) !important;
    width: clamp(320px, 30vw, 480px) !important;
  }
}
@media (min-width: 900px) {
  .setup-security-hints ul {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 20px;
    row-gap: 8px;
  }
}
@media (max-width: 767px) {
  .setup-staff-shell {
    align-items: stretch !important;
    justify-content: flex-start !important;
    padding:
      max(12px, env(safe-area-inset-top, 0px))
      max(12px, env(safe-area-inset-right, 0px))
      max(20px, env(safe-area-inset-bottom, 0px))
      max(12px, env(safe-area-inset-left, 0px)) !important;
    overflow-y: auto !important;
    overflow-x: clip !important;
    height: auto !important;
    max-height: none !important;
    min-height: 100dvh !important;
    min-height: 100svh !important;
  }
  .setup-staff-card-wrap {
    max-width: 100% !important;
    width: 100% !important;
  }
  .setup-staff-card {
    max-height: none !important;
    overflow: visible !important;
  }
}
@media (min-width: 480px) {
  .setup-staff-shell {
    align-items: center !important;
    justify-content: center !important;
  }
}
.setup-facility-shell {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
  min-height: 100dvh;
  min-height: 100svh;
}
.setup-facility-header {
  padding-left: max(16px, env(safe-area-inset-left, 0px)) !important;
  padding-right: max(16px, env(safe-area-inset-right, 0px)) !important;
}
.setup-facility-main {
  padding:
    10px
    max(12px, env(safe-area-inset-right, 0px))
    max(12px, env(safe-area-inset-bottom, 0px))
    max(12px, env(safe-area-inset-left, 0px)) !important;
}
.setup-facility-card {
  width: 100%;
  max-width: min(400px, 100%);
  box-sizing: border-box;
}
.setup-sms-send-btn {
  width: 100%;
}
.setup-desktop-step-label,
.setup-aside-steps {
  display: none;
}

/* Step 3 — clean password setup (mobile-first) */
.setup-security-layout {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
}
.setup-security-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  min-height: 40px;
}
.setup-security-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #0f172a;
  cursor: pointer;
}
.setup-security-back:hover {
  background: rgba(15, 23, 42, 0.06);
}
.setup-security-skip {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  text-decoration: none;
  padding: 8px 4px;
}
.setup-security-skip:hover {
  color: #334155;
}
.setup-security-heading {
  margin: 0 0 8px;
  font-size: clamp(1.75rem, 5vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: #0f172a;
}
.setup-security-subtitle {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.5;
  color: #94a3b8;
  font-weight: 400;
}
.setup-security-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 28px;
}
.setup-security-field-wrap {
  position: relative;
}
.setup-security-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 52px;
  padding: 14px 48px 14px 16px;
  font-size: 15px;
  line-height: 1.35;
  color: #0f172a;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.setup-security-input::placeholder {
  color: #94a3b8;
}
.setup-security-input:focus {
  background: #fff;
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.12);
}
.setup-security-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}
.setup-security-toggle:hover {
  color: #64748b;
  background: rgba(15, 23, 42, 0.05);
}
.setup-dot-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 28px;
}
.setup-dot-progress span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e2e8f0;
  transition: background 0.2s ease, transform 0.2s ease;
}
.setup-dot-progress span.is-active {
  background: #1e3a5f;
  transform: scale(1.15);
}
.setup-dot-progress span.is-done {
  background: #93c5fd;
}
.setup-security-continue {
  width: 100%;
  min-height: 52px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(30, 58, 95, 0.22);
}
.setup-security-continue:disabled {
  box-shadow: none;
}
.setup-security-footer {
  margin-top: 24px;
  text-align: center;
  font-size: 13px;
  color: #64748b;
}
.setup-security-footer a {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #1e3a5f;
  text-decoration: none;
  letter-spacing: 0.02em;
}
.setup-security-footer a:hover {
  text-decoration: underline;
}
.setup-security-hints {
  margin: -8px 0 20px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
}
.setup-security-hints ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.setup-security-hints li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.35;
  color: #94a3b8;
}
.setup-security-hints li.is-met {
  color: #16a34a;
}
.setup-security-verified {
  margin: 0 0 16px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.45;
}
.setup-step-card--security {
  padding: clamp(20px, 5vw, 28px) clamp(16px, 4vw, 22px) clamp(24px, 5vw, 32px) !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}
@media (min-width: 768px) {
  .setup-step-card--security {
    background: #fff !important;
    border: 1px solid rgba(11, 30, 59, 0.06) !important;
    box-shadow: 0 8px 28px rgba(11, 30, 59, 0.06), 0 1px 4px rgba(11, 30, 59, 0.04) !important;
    border-radius: 16px !important;
  }
}
@media (max-width: 767px) {
  .setup-step-right--security,
  .setup-step-right--phone {
    background: #fff !important;
  }
  .setup-step-right--security .setup-step-scroll,
  .setup-step-right--phone .setup-step-scroll {
    justify-content: flex-start !important;
    align-items: stretch !important;
  }
  .setup-step-right--security .setup-step-inner,
  .setup-step-right--phone .setup-step-inner {
    max-width: 100% !important;
    padding-top: max(8px, env(safe-area-inset-top, 0px)) !important;
  }
}

.setup-step-card--phone {
  padding: clamp(20px, 5vw, 28px) clamp(16px, 4vw, 22px) clamp(24px, 5vw, 32px) !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}
@media (min-width: 768px) {
  .setup-step-card--phone {
    background: #fff !important;
    border: 1px solid rgba(11, 30, 59, 0.06) !important;
    box-shadow: 0 8px 28px rgba(11, 30, 59, 0.06), 0 1px 4px rgba(11, 30, 59, 0.04) !important;
    border-radius: 16px !important;
  }
}

/* Phone number entry — forgot-password style */
.setup-flow-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: min(72vh, 520px);
}
.setup-flow-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.setup-flow-footer {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 32px;
}
.setup-flow-cancel {
  border: none;
  background: none;
  padding: 8px 4px;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  font-family: inherit;
}
.setup-flow-cancel:hover {
  color: #0f172a;
}
.setup-flow-subtitle-dark {
  margin: 0 0 32px;
  font-size: 15px;
  line-height: 1.55;
  color: #64748b;
  font-weight: 400;
  max-width: 22rem;
}
.setup-flow-field {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  box-sizing: border-box;
  min-height: 54px;
  padding: 0 16px 0 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.setup-flow-field:focus-within {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.1);
}
.setup-flow-country-picker {
  flex-shrink: 0;
  max-width: 5.5rem;
  border-right: 1px solid #f1f5f9;
  margin-right: 10px;
  padding-right: 6px;
}
.setup-flow-country-picker button {
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 4px 2px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  color: #0f172a !important;
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
.setup-flow-country-picker button span.material-icons-round {
  font-size: 18px !important;
  margin-left: 2px !important;
  color: #94a3b8 !important;
}
.setup-flow-field-input {
  flex: 1 1 0;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  padding: 14px 0;
  font-size: 16px;
  line-height: 1.35;
  color: #0f172a;
}
.setup-flow-field-input::placeholder {
  color: #cbd5e1;
  font-weight: 400;
}
.setup-flow-field-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
  margin-left: 8px;
  pointer-events: none;
}

.setup-otp-instruction {
  margin: 0 0 36px;
  font-size: 15px;
  line-height: 1.55;
  color: #334155;
  font-weight: 400;
}
.setup-otp-instruction strong {
  font-weight: 600;
  color: #0f172a;
}
.setup-otp-edit-link {
  display: inline;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-weight: 600;
  color: #dc2626;
  cursor: pointer;
  text-decoration: none;
}
.setup-otp-edit-link:hover {
  text-decoration: underline;
}

.setup-otp-input-wrap {
  margin-bottom: 36px;
}
.setup-otp-input-clean {
  width: 100%;
  box-sizing: border-box;
  border: none;
  background: transparent;
  padding: 8px 0;
  font-size: clamp(2rem, 8vw, 2.75rem);
  font-weight: 600;
  letter-spacing: 0.42em;
  text-align: center;
  color: #0f172a;
  outline: none;
  caret-color: #1e3a5f;
}
.setup-otp-input-clean::placeholder {
  color: #cbd5e1;
  letter-spacing: 0.42em;
  font-weight: 500;
}

.setup-otp-help {
  margin-top: 20px;
  padding: 0;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: #dc2626;
  cursor: pointer;
  text-align: left;
}
.setup-otp-help:hover {
  text-decoration: underline;
}
.setup-otp-help:disabled {
  opacity: 0.5;
  cursor: default;
  text-decoration: none;
}

.setup-flow-alert {
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.45;
}
.setup-flow-alert--error {
  background: var(--critical-bg, #fef2f2);
  border: 1px solid rgba(140, 90, 94, 0.2);
  color: var(--critical, #b91c1c);
}
.setup-flow-alert--success {
  background: var(--success-bg, #f0fdf4);
  border: 1px solid rgba(46, 125, 50, 0.2);
  color: var(--success, #15803d);
}
`;
