// Currently unused, but we should consider setting scopes moving forward and this will be handy then.
import { auth } from 'express-oauth2-jwt-bearer'
import dotenv from 'dotenv'

dotenv.config()

const tokenError = (err, req, res, next) => {
  if (err.status === 401) {
    err.message = err.statusMessage = `This token does not have permission to perform this action. 
                ${err.message}
                Received token: ${req.header('authorization')}`
  }
  next(err)
}

const extractUser = (req, _res, next) => {
  const token = req.header('authorization')?.split(' ')[1]
  if (token) {
    try {
      const payload = token.split('.')[1]
      req.user = JSON.parse(Buffer.from(payload, 'base64').toString())
    } catch (err) {
      req.user = undefined
      console.warn('Failed to decode authorization token payload', err)
    }
  }
  next()
}

/**
 * Use like:
 * app.get('/api/private', checkJwt, function(req, res) {
 *   // do authorized things
 * });
 */
export const checkJwt = [auth(), tokenError, extractUser]

export default {
  checkJwt,
}
