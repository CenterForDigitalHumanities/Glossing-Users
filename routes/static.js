/**
 * This module is used to define the routes of static resources available in `/public`
 * but also under `/glossing-users` paths.
 *
 * @author cubap
 */

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// public also available at `/glossing-users`
router.use(express.static(path.join(__dirname, '../public')))

// Set default API response
router.get('/', (req, res) => {
  res.redirect('index.html')
})

// Export API routes
export default router
