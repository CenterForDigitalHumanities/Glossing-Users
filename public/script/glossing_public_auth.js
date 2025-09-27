/**
 * @module AuthButton Adds custom element for login/logout of Auth0, based on configuration below.
 * Modernized to use the Auth0 SPA SDK with refresh tokens and local storage caching.
 */

import createAuth0Client from 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2/dist/auth0-spa-js.production.esm.js'

const AUDIENCE = 'https://cubap.auth0.com/api/v2/'
const CLIENT_ID = '4TztHfVXjvs4H6ByCOXgwxtgA8IEQHsD'
const DOMAIN = 'cubap.auth0.com'
const AUTH_SCOPE =
  'read:roles update:current_user_metadata name nickname picture email profile openid offline_access'
const RETURN_KEY = 'glossing:returnTo'

let pendingReturnTo = sessionStorage.getItem(RETURN_KEY) ?? null

const auth0ClientPromise = (async () => {
  const client = await createAuth0Client({
    domain: DOMAIN,
    clientId: CLIENT_ID,
    authorizationParams: {
      audience: AUDIENCE,
      scope: AUTH_SCOPE,
      redirect_uri: window.location.origin + window.location.pathname,
    },
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
  })

  if (hasAuthRedirectParams()) {
    try {
      const { appState } = await client.handleRedirectCallback()
      if (appState?.returnTo) {
        pendingReturnTo = appState.returnTo
        sessionStorage.setItem(RETURN_KEY, pendingReturnTo)
      }
    } catch (error) {
      console.error('Auth0 redirect handling failed', error)
    } finally {
      clearAuthRedirectParams()
    }
  }

  return client
})()

const getAuthClient = () => auth0ClientPromise

function hasAuthRedirectParams() {
  const params = new URLSearchParams(window.location.search)
  return params.has('code') && params.has('state')
}

function clearAuthRedirectParams() {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  const search = url.searchParams.toString()
  const cleaned = `${url.origin}${url.pathname}${search ? `?${search}` : ''}${url.hash}`
  window.history.replaceState({}, document.title, cleaned)
}

const consumeReturnTo = () => {
  const stored = pendingReturnTo ?? sessionStorage.getItem(RETURN_KEY) ?? null
  pendingReturnTo = null
  if (stored) {
    sessionStorage.removeItem(RETURN_KEY)
  }
  return stored
}

const login = async (options = {}) => {
  const client = await getAuthClient()
  const returnTo = options.returnTo ?? window.location.href
  pendingReturnTo = returnTo
  sessionStorage.setItem(RETURN_KEY, returnTo)
  return client.loginWithRedirect({ appState: { returnTo } })
}

const logout = async (options = {}) => {
  const client = await getAuthClient()
  localStorage.removeItem('userToken')
  sessionStorage.removeItem(RETURN_KEY)
  delete window.GOG_USER
  document.querySelectorAll('[is="auth-creator"]').forEach((el) => el.connectedCallback())
  await client.logout({ logoutParams: { returnTo: options.returnTo ?? window.location.origin } })
}

async function refreshSession(button) {
  const client = await getAuthClient()
  let isAuthenticated
  try {
    isAuthenticated = await client.isAuthenticated()
  } catch (error) {
    console.error('Auth0 authentication check failed', error)
    isAuthenticated = false
  }

  if (!isAuthenticated) {
    button.innerText = 'Login'
    button.onclick = () => login()
    button.removeAttribute('disabled')
    if (!button.dataset.public) {
      await login()
    }
    return
  }

  try {
    const [user, claims] = await Promise.all([
      client.getUser(),
      client.getIdTokenClaims().catch(() => null),
    ])
    const accessToken = await client.getTokenSilently().catch(() => null)

    const claimsPayload = claims ? { ...claims } : {}
    if (claimsPayload.__raw) {
      delete claimsPayload.__raw
    }

    window.GOG_USER = {
      ...(user ?? {}),
      ...(claimsPayload ?? {}),
      authorization: accessToken,
      idToken: claims?.__raw,
    }

    if (window.GOG_USER) {
      localStorage.setItem('userToken', window.GOG_USER.idToken ?? '')
    }

    document.querySelectorAll('[is="auth-creator"]').forEach((el) => el.connectedCallback())

    const nickname = window.GOG_USER?.nickname ?? window.GOG_USER?.name ?? 'User'
    button.innerText = `Logout ${nickname}`
    button.onclick = () => logout()
    button.removeAttribute('disabled')

    const loginEvent = new CustomEvent('glossing-authenticated', {
      detail: {
        ...window.GOG_USER,
        returnTo: consumeReturnTo(),
      },
    })
    button.dispatchEvent(loginEvent)
  } catch (error) {
    console.error('Auth0 session refresh failed', error)
    await logout({ returnTo: window.location.origin })
  }
}

class AuthButton extends HTMLButtonElement {
  constructor() {
    super()
    this.login = login
    this.logout = logout
    this.dataset.public = this.hasAttribute('disabled') ? 'true' : ''
  }

  connectedCallback() {
    refreshSession(this)
  }
}

customElements.define('auth-button', AuthButton, { extends: 'button' })

class AuthCreator extends HTMLInputElement {
  connectedCallback() {
    if (!window.GOG_USER) {
      return
    }
    this.value = GOG_USER['http://store.rerum.io/agent'] ?? 'anonymous'
  }
}

customElements.define('auth-creator', AuthCreator, { extends: 'input' })

export { login, logout, getAuthClient }
export default { AuthButton, AuthCreator, login, logout, getAuthClient }
