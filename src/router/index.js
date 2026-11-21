import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'connection-check',
      component: () => import('../views/ConnectionCheckView.vue'),
    },
  ],
})

export default router
