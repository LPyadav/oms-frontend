<template>
  <main class="auth-layout">
    <div class="auth-brand">
      <div class="brand-wordmark">
        <span class="brand-mark" aria-hidden="true"></span>
        OMS
      </div>

      <div class="brand-illustration" aria-hidden="true">
        <div class="brand-orbit"></div>
        <div class="brand-orbit brand-orbit--inner"></div>
        <div class="brand-parcel">
          <span class="parcel-top"></span>
          <span class="parcel-left"></span>
          <span class="parcel-right"></span>
          <span class="parcel-tape"></span>
        </div>
      </div>

      <p class="brand-name">Order Management System</p>
    </div>

    <div class="auth-content">
      <slot />
    </div>
  </main>
</template>

<style scoped>
.auth-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  min-height: 100vh;
  min-height: 100dvh;
}

.auth-brand {
  position: relative;
  isolation: isolate;
  grid-area: 1 / 2;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  min-height: 420px;
  margin: 18px 18px 18px 0;
  padding: clamp(28px, 4vw, 58px);
  border-radius: 24px;
  background: radial-gradient(ellipse at center, #255c4b, #174233 56%, #112e26);
  color: #fff;
}

.brand-wordmark {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.04em;
}

.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid #52a28a;
  border-radius: 11px;
  background: linear-gradient(145deg, #319c81, #086953);
}

.brand-mark::before {
  width: 4px;
  height: 14px;
  border-radius: 2px;
  background: currentColor;
  box-shadow:
    -6px 3px 0 -0.5px currentColor,
    6px -3px 0 -0.5px currentColor;
  content: '';
  transform: rotate(27deg);
}

.brand-name {
  margin: 0;
  color: #d4eee2;
  font-size: 0.875rem;
}

.brand-illustration {
  position: absolute;
  z-index: -1;
  inset: 10% 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.brand-orbit {
  position: absolute;
  width: min(72%, 440px);
  aspect-ratio: 1;
  border: 1px solid rgb(167 228 196 / 31%);
  border-radius: 34%;
  transform: rotate(45deg) scaleY(0.75);
}

.brand-orbit--inner {
  width: min(58%, 340px);
  background: rgb(158 233 192 / 6%);
}

.brand-parcel {
  position: relative;
  width: min(36%, 225px);
  aspect-ratio: 1.12;
  filter: drop-shadow(0 22px 20px rgb(1 31 22 / 42%));
  transform: translateY(-6%);
}

.brand-parcel span {
  position: absolute;
  inset: 0;
}

.parcel-top {
  background: linear-gradient(145deg, #adf3d4, #67cda9);
  clip-path: polygon(50% 0, 100% 25%, 50% 51%, 0 25%);
}

.parcel-left {
  background: linear-gradient(125deg, #69c9a9, #329a7d);
  clip-path: polygon(0 25%, 50% 51%, 50% 100%, 0 74%);
}

.parcel-right {
  background: linear-gradient(145deg, #339f82, #0a6d57);
  clip-path: polygon(100% 25%, 100% 74%, 50% 100%, 50% 51%);
}

.parcel-tape {
  background: linear-gradient(145deg, #ecfff4, #afdfca);
  clip-path: polygon(23% 13.5%, 36% 7%, 86% 32%, 86% 55%, 73% 62%, 73% 38.5%);
}

.auth-content {
  grid-area: 1 / 1;
  display: grid;
  place-items: center;
  padding: 40px clamp(24px, 6vw, 98px);
}

@media (max-width: 700px) {
  .auth-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }

  .auth-brand {
    grid-area: 1 / 1;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    min-height: 0;
    margin: 0;
    padding: 16px 24px;
    border-radius: 0;
  }

  .brand-name {
    text-align: right;
  }

  .brand-illustration {
    display: none;
  }

  .auth-content {
    grid-area: 2 / 1;
    place-items: start center;
    padding: clamp(44px, 8vh, 70px) 24px 40px;
  }
}
</style>
