<script setup>
import { VSheet } from 'vuetify/components/VSheet'
</script>

<template>
  <VSheet tag="main" color="background" class="auth-layout">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <div>
          <p class="brand-wordmark">OMS</p>
          <p class="brand-name">Order Management System</p>
        </div>
      </div>

      <slot />
    </div>
  </VSheet>
</template>

<style scoped>
.auth-layout {
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 48px 24px;
  background-image:
    linear-gradient(128deg, rgb(10 19 38 / 52%), rgb(12 22 44 / 21%) 55%, rgb(10 16 31 / 56%)),
    url('../assets/auth/warehouse-aisle.jpg');
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.auth-layout::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: radial-gradient(ellipse at 50% 38%, transparent 25%, rgb(5 9 16 / 38%) 100%);
  content: '';
  pointer-events: none;
}

.auth-card {
  display: grid;
  gap: 24px;
  width: min(100%, 460px);
  min-width: 0;
  padding: clamp(24px, 4vw, 36px);
  border: 1px solid rgb(247 210 162 / 28%);
  border-radius: 24px;
  color: rgb(var(--v-theme-on-surface));
  background-image:
    radial-gradient(ellipse 22rem 16rem at 100% 0%, rgb(255 185 108 / 12%), transparent 80%),
    linear-gradient(153deg, rgb(27 35 50 / 97%), rgb(13 19 31 / 96%));
  box-shadow:
    inset 0 1px 0 rgb(254 221 175 / 12%),
    0 30px 100px rgb(4 7 16 / 68%);
  backdrop-filter: blur(18px);
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(var(--v-theme-primary), 0.17);
}

.brand-mark {
  display: grid;
  flex: none;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 13px;
  color: rgb(var(--v-theme-on-primary));
  background: linear-gradient(148deg, #ffe3b9, #f1af62);
  box-shadow: 0 5px 17px rgba(var(--v-theme-primary), 0.29);
}

.brand-mark::before {
  width: 4px;
  height: 15px;
  border-radius: 2px;
  background: currentColor;
  box-shadow:
    -6px 3px 0 -0.5px currentColor,
    6px -3px 0 -0.5px currentColor;
  content: '';
  transform: rotate(27deg);
}

.brand-wordmark,
.brand-name {
  margin: 0;
}

.brand-wordmark {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.025em;
}

.brand-name {
  margin-top: 3px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.8125rem;
}

@media (max-width: 480px) {
  .auth-layout {
    place-items: start center;
    padding: clamp(28px, 8vh, 60px) 18px 36px;
  }

  .auth-card {
    gap: 22px;
  }
}
</style>
