import jwt_decode from '/script/jwt.js'

const auth = document.querySelector('[is="auth-button"]')
const userList = document.getElementById('userList')
const GLOSSING_USER_ROLES_CLAIM = 'http://rerum.io/user_roles'
const ROLES = ['public', 'contributor', 'manager']

auth?.addEventListener('glossing-authenticated', async (event) => {
  const detail = event.detail ?? {}

  if (detail.returnTo && detail.returnTo !== window.location.href) {
    if (typeof stopHeartbeat === 'function') {
      stopHeartbeat()
    }
    location.href = detail.returnTo
    return
  }

  if (window.username) {
    username.innerHTML = detail.name ?? detail.nickname ?? detail.email ?? ''
  }

  if (location.pathname.includes('profile.html')) {
    if (typeof updateUserInfo === 'function') {
      window.userForm?.addEventListener('submit', updateUserInfo)
    }
    for (const [key, value] of Object.entries(detail)) {
      if (value === undefined || value === null) {
        continue
      }
      document.querySelector(`input[name='${key}']`)?.setAttribute('value', value)
      document.querySelector(`[data-${key}]`)?.setAttribute(`data-${key}`, value)
    }
    if (detail.picture) {
      document.querySelector('[data-picture]').innerHTML = `<img src="${detail.picture}"/>`
    }
  }

  if (document.querySelector("[data-user='admin']")) {
    await adminOnly(detail.authorization)
  }
})

async function adminOnly(token = window.GOG_USER?.authorization) {
  if (!userList) {
    return
  }

  userList.innerHTML = ''

  if (!token || !isAdmin(token)) {
    renderCurrentUserFallback()
    history.replaceState(null, null, ' ')
    return
  }

  try {
    const users = await getAllUsers()
    const markup = users
      .map((user) => {
        const options = ROLES.map(
          (role) =>
            `<option ${user.role === role ? 'selected=true' : ''} value="${role}">${role}</option>`
        ).join('')

        return `<li user="${user.name}">
            <p>${user.name}</p>
            <img src="${user.picture}">
            <span class="role badge" userid="${user.user_id}">${user.role}</span>
            <select name="${user.user_id}">${options}</select>
        </li>`
      })
      .join('')

    userList.innerHTML = markup
    userList.querySelectorAll('select').forEach((element) => {
      element.addEventListener('input', (ev) => assignRole(ev.target.name, ev.target.value))
    })
  } catch (error) {
    console.error('Unable to load users', error)
    renderCurrentUserFallback()
  }

  history.replaceState(null, null, ' ')
}

function renderCurrentUserFallback() {
  if (!userList) {
    return
  }

  if (!window.GOG_USER) {
    return
  }

  const roles = window.GOG_USER[GLOSSING_USER_ROLES_CLAIM]?.roles
    ?.map((role) => role.replace(/_/g, '&nbsp;'))
    .join(', ')

  userList.innerHTML = `
    <h1>${window.GOG_USER.nickname ?? window.GOG_USER.name ?? ''}</h1>
    <small>${window.GOG_USER.email ?? ''}</small>
    <p>(${roles ?? 'no assigned roles'})</p>
    <img src="${window.GOG_USER.picture ?? ''}">
  `
}

async function assignRole(userid, role) {
  const roleTag = document.querySelector(`.role[userid="${userid}"]`)

  try {
    const response = await fetch('/glossing-users/manage/assignRole', {
      method: 'POST',
      cache: 'default',
      headers: {
        Authorization: `Bearer ${window.GOG_USER?.authorization}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ role, userid }),
    })

    if (!response.ok) {
      throw response
    }

    if (roleTag) {
      roleTag.innerHTML = role
      roleTag.classList.add('badge-success')
      roleTag.classList.remove('badge-danger')
    }
  } catch (error) {
    console.error('Role assignment failed', error)
    if (roleTag) {
      roleTag.innerHTML = `${roleTag.innerHTML ?? ''}⚠`
      roleTag.classList.remove('badge-success')
      roleTag.classList.add('badge-danger')
    }
  }
}

async function getAllUsers() {
  try {
    const response = await fetch('/glossing-users/manage/getAllUsers', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${window.GOG_USER?.authorization}`,
      },
    })

    if (!response.ok) {
      throw response
    }

    return response.json()
  } catch (error) {
    console.error('Unable to fetch user list', error)
    return []
  }
}

function isAdmin(token) {
  if (!token) {
    return false
  }

  try {
    const user = jwt_decode(token)
    return userHasRole(user, 'glossing_user_admin')
  } catch (error) {
    console.error('Unable to check admin status', error)
    return false
  }
}

function userHasRole(user, roles) {
  const roleList = Array.isArray(roles) ? roles : [roles]
  const storedRoles = user?.[GLOSSING_USER_ROLES_CLAIM]?.roles ?? []
  return storedRoles.some((role) => roleList.includes(role))
}
