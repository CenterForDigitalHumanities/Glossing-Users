import { getAuthClient, login } from './glossing_public_auth.js'

let heartbeatId = null

async function startHeartbeat(intervalMinutes = 4.5) {
  const client = await getAuthClient()
  stopHeartbeat()

  heartbeatId = setInterval(async () => {
    try {
      await client.getTokenSilently({ cacheMode: 'off' })
    } catch (error) {
      console.error('Silent token refresh failed', error)
      stopHeartbeat()
      await login()
    }
  }, intervalMinutes * 60000)
}

function stopHeartbeat() {
  if (heartbeatId !== null) {
    clearInterval(heartbeatId)
    heartbeatId = null
  }
}

window.startHeartbeat = startHeartbeat
window.stopHeartbeat = stopHeartbeat

export { startHeartbeat, stopHeartbeat }
export default { startHeartbeat, stopHeartbeat }
