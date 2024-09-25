/**
 * @module AuthButton Adds custom element for login/logout of Auth0, based on configuration below.
 * @author cubap
 *
 * @description This module includes a custom `<button is="auth-button">` element for authentication
 * Notes:
 * - Include this module and a button[is='auth-button'] element to use.
 * - Add the `disabled` property on any page that should be available to the public, but knowing the user may be helpful.
 * - This can be made more generic by passing in the constants and parameterizing {app:'tpen'}.
 */

import "./jwt.js"

const returnTo = origin

function authenticateInterfaces(returnTo) {
  const incomingToken = new URLSearchParams(window.location.search).get("idToken")
  const authenticatedElements = document.querySelectorAll('[requires-auth]')
  if(authenticatedElements.length === 0) {
    return
  }

  const userToken = incomingToken ?? localStorage.getItem("TPEN_USER").authentication
  
  // Redirect to login if no userToken
  if(!userToken) {
    location.href = `https://three.t-pen.org/login?returnTo=${returnTo ?? location.href}`
  }
  
  // Override the userToken if it is in the query string
  const TPEN_USER = !incomingToken ? localStorage.getItem("TPEN_USER") 
    : ()=> {
      const userData = jwtDecode(userToken)
      const user = {}
      user.authentication = userToken
      user.id = userData["http://store.rerum.io/agent"]?.split("/").pop()
      user.expires = userData.exp
      return user
    }
  authenticatedElements.forEach(el => {
    el.setAttribute("tpen-user", TPEN_USER.id)
    el.setAttribute("tpen-token-expires", TPEN_USER.expires)
    el.tpenAuthToken = userToken
  })
  localStorage.setItem("TPEN_USER", TPEN_USER)
}

const logout = () => {
  localStorage.removeItem("TPEN_USER")
  delete window.TPEN_USER
  document
    .querySelectorAll('[requires-auth]')
    .forEach((el) => {
      el.setAttribute("tpen-user", "")
      el.setAttribute("tpen-token-expires", "")
      delete el.tpenAuthToken
    })
  location.href = `https://three.t-pen.org/logout?returnTo=${origin}`
}

const login = (redirect) => location.href = `https://three.t-pen.org/login?returnTo=${redirect ?? location.href}`

class TpenAuth extends HTMLElement {
  static get observedAttributes() {
    return ["tpen-user", "tpen-token-expires"]
  }

  constructor() {
    super()
    this.login = login
    this.logout = logout
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "tpen-user") {
      this.dispatchEvent(
        new CustomEvent("user-login", {
          detail: { user: newValue },
        })
      )
    }
    if (name === "tpen-token-expires") {
        this.expiring = setTimeout(() => {        
        this.dispatchEvent(
          new CustomEvent("token-expiration", {
            detail: { expires: newValue },
          })
        )
      }, newValue - Date.now())
    }
  }

  connectedCallback() {
    const returnTo = this.getAttribute("returnTo")
    if (window.authenticating) {
      window.authenticating.then(() => {
        authenticateInterfaces(returnTo)
        delete window.authenticating
      })
    } else {
      window.authenticating = new Promise((resolve) => {
        authenticateInterfaces(returnTo)
        resolve()
      }).then(() => {
        delete window.authenticating
      })
    }

    this.addEventListener("user-login", () => {
      this.connectedCallback()
    })

    this.addEventListener("token-expiration", () => {
      this.addClass("authentication-expired")
    })
  }
}

customElements.define("tpen-auth", TpenAuth)

export default TpenAuth
