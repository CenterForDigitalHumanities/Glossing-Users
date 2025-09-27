import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

import managementRouter from './manage-api.js'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// public also available at `/glossing-users` now
router.use(express.static(path.join(__dirname, '../public')))

//The /glossing-users/manage endpoint stuff
router.use('/manage', managementRouter)

/* GET home page.  Redirect to login */
router.get('/', (_req, res) => {
  res.redirect(301, 'profile.html')
})

export default router
