import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'library',
      component: () => import('@/views/LibraryView.vue'),
    },
    {
      path: '/book/:bookId',
      name: 'reading',
      component: () => import('@/views/ReadingView.vue'),
    },
  ],
})

export default router
