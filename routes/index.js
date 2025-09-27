import express from 'express'

import staticRouter from './static.js'
import managementRouter from './manage-api.js'
import glossingRouter from './glossing-users.js'

const router = express.Router()

router.get('/', staticRouter)
router.use('/glossing-users/manage', managementRouter)
router.use('/glossing-users', glossingRouter)

export default router
