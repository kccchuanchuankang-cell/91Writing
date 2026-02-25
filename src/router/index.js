import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import HomePage from '../views/HomePage.vue'
import PromptsLibrary from '../views/PromptsLibrary.vue'
import NovelManagement from '../views/NovelManagement.vue'
import WritingGoals from '../views/WritingGoals.vue'
import TokenBilling from '../views/TokenBilling.vue'
import ApiConfig from '../views/ApiConfig.vue'
import Settings from '../views/Settings.vue'
import ChapterManagement from '../views/ChapterManagement.vue'
import Writer from '../views/Writer.vue'
import Home from '../views/Home.vue'
import GenreManagement from '../views/GenreManagement.vue'
import ToolsLibrary from '../views/ToolsLibrary.vue'
import ShortStory from '../views/ShortStory.vue'
import BookAnalysis from '../views/BookAnalysis.vue'
import Login from '../views/Login.vue' // Import Login view

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/',
    component: Dashboard,
    meta: { requiresAuth: true }, // Mark dashboard routes as protected
    children: [
      {
        path: '',
        name: 'HomePage',
        component: HomePage
      },
      {
        path: 'prompts',
        name: 'PromptsLibrary',
        component: PromptsLibrary
      },
      {
        path: 'novels',
        name: 'NovelManagement',
        component: NovelManagement
      },
      {
        path: 'goals',
        name: 'WritingGoals',
        component: WritingGoals
      },
      {
        path: 'billing',
        name: 'TokenBilling',
        component: TokenBilling
      },
      {
        path: 'config',
        name: 'ApiConfig',
        component: ApiConfig
      },
      {
        path: 'settings',
        name: 'Settings',
        component: Settings
      },
      {
        path: 'chapters',
        name: 'ChapterManagement',
        component: ChapterManagement
      },
      {
        path: 'writer',
        name: 'Writer',
        component: Writer
      },
      {
        path: 'genres',
        name: 'GenreManagement',
        component: GenreManagement
      },
      {
        path: 'tools',
        name: 'ToolsLibrary',
        component: ToolsLibrary
      },
      {
        path: 'short-story',
        name: 'ShortStory',
        component: ShortStory
      },
      {
        path: 'book-analysis',
        name: 'BookAnalysis',
        component: BookAnalysis
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// Navigation Guard
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('auth_token');

  if (to.matched.some(record => record.meta.requiresAuth)) {
    // this route requires auth, check if logged in
    // if not, redirect to login page.
    if (!isAuthenticated) {
      next({
        path: '/login',
        query: { redirect: to.fullPath } // Optional: Save the redirect URL
      })
    } else {
      next() // proceed as planned
    }
  } else if (to.name === 'Login' && isAuthenticated) {
    // If attempting to access login page while already authenticated, redirect to home
    next({ name: 'HomePage' })
  } else {
    next() // Always call next()!
  }
})

export default router