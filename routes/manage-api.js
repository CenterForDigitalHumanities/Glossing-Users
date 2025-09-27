import express from 'express'
import { ManagementClient, AuthenticationClient } from 'auth0'

const router = express.Router()

const ROLE_CONFIG = [
  { name: 'manager', envKey: 'ROLE_MANAGER_ID' },
  { name: 'contributor', envKey: 'ROLE_CONTRIBUTOR_ID' },
  { name: 'public', envKey: 'ROLE_PUBLIC_ID' },
]

const resolvedRoles = ROLE_CONFIG.map(({ name, envKey }) => ({
  name,
  id: String(process.env[envKey] ?? '').split(' ')[0],
})).filter(({ id }) => Boolean(id))

const roleIds = resolvedRoles.map(({ id }) => id)

const resolveRoleIdByName = (roleName) => {
  const normalized = String(roleName ?? '').toLowerCase()
  return resolvedRoles.find(({ name }) => name === normalized)?.id
}

const extractUsers = (group) => {
  if (!group) {
    return []
  }

  if (Array.isArray(group)) {
    return group
  }

  if (Array.isArray(group.data)) {
    return group.data
  }

  if (Array.isArray(group.users)) {
    return group.users
  }

  return []
}

const DEFAULT_APP_METADATA_KEYS = ['appflag', 'apps', 'app', 'applications']
const APP_IDENTIFIER = (process.env.GLOSSING_APP_IDENTIFIER ?? 'glossing').toLowerCase()
const APP_CLAIM = process.env.GLOSSING_APP_CLAIM ?? ''
const ROLE_PAGE_SIZE = Number.parseInt(process.env.GLOSSING_ROLE_PAGE_SIZE ?? '100', 10)
const metadataKeys = (process.env.GLOSSING_APP_METADATA_KEYS ?? DEFAULT_APP_METADATA_KEYS.join(','))
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean)

const requestedFields = (() => {
  const fields = new Set(['user_id', 'email', 'name', 'nickname', 'picture', 'app_metadata'])
  if (APP_CLAIM) {
    fields.add(APP_CLAIM)
  }
  return Array.from(fields).join(',')
})()

const normalizeValue = (value) => {
  if (typeof value === 'string') {
    return value.trim().toLowerCase()
  }
  return undefined
}

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value
  }
  if (value === undefined || value === null) {
    return []
  }
  return [value]
}

const collectAppFlags = (user) => {
  const metadata = user.app_metadata ?? {}
  const collected = []

  metadataKeys.forEach((key) => {
    collected.push(...ensureArray(metadata[key]))
  })

  if (APP_CLAIM) {
    collected.push(...ensureArray(user[APP_CLAIM]))
  }

  return collected
}

const isGlossingUser = (user) => {
  if (!APP_IDENTIFIER) {
    return true
  }
  return collectAppFlags(user).some((value) => normalizeValue(value) === APP_IDENTIFIER)
}

const resolvePageSize = () => {
  if (Number.isNaN(ROLE_PAGE_SIZE) || ROLE_PAGE_SIZE <= 0) {
    return 100
  }
  return Math.min(ROLE_PAGE_SIZE, 100)
}

async function listUsersForRole(roleId) {
  const aggregated = []
  const perPage = resolvePageSize()
  let page = 0
  let shouldContinue = true

  while (shouldContinue) {
    const response = await managementClient.roles.getUsers({
      id: roleId,
      page,
      per_page: perPage,
      include_totals: true,
      include_fields: true,
      fields: requestedFields,
    })

    const pageUsers = extractUsers(response)

    if (!pageUsers.length) {
      shouldContinue = false
      continue
    }

    aggregated.push(...pageUsers)

    const limit = typeof response?.limit === 'number' ? response.limit : perPage
    const total = typeof response?.total === 'number' ? response.total : undefined

    if ((total !== undefined && aggregated.length >= total) || pageUsers.length < limit) {
      shouldContinue = false
    } else {
      page += 1
    }
  }

  return aggregated.filter(isGlossingUser)
}

const managementClient = new ManagementClient({
  domain: process.env.DOMAIN,
  clientId: process.env.CLIENTID,
  clientSecret: process.env.CLIENT_SECRET,
  scope:
    'create:users read:users read:user_idp_tokens update:users delete:users read:roles create:roles update:roles delete:roles',
})

const authenticationClient = new AuthenticationClient({
  domain: process.env.DOMAIN,
  clientId: process.env.CLIENTID,
})

// /**
//  * Let Glossing Apps Users update THEIR OWN profile info.
//  *
//  * Make sure the user making the request is the user to update.
//  */
// router.put('/updateProfileInfo', async function (req, res, next) {
//   console.log("update profile info")
//   let token = req.header("Authorization") ?? ""
//   token = token.replace("Bearer ", "")
//   if (token) {
//     authenticator.getProfile(token)
//       .then(async (current_user) => {
//         if (isGlossingUser(current_user)) {
//           //The user object is in the body, and the id is present or fail.
//           let userObj = req.body ?? {}
//           const userid = userObj.sub ?? userObj.user_id ?? userObj.id ?? ""
//           delete userObj.sub
//           delete userObj.user_id
//           delete userObj.id
//           if (userid) {
//             if (current_user.sub === userid) {
//               let params = { id: current_user.sub }
//               manager.updateUser(params, userObj)
//                 .then(user => {
//                   res.status(200).json(user)
//                 })
//                 .catch(err => {
//                   console.error("Trouble updating using profile.")
//                   console.error(err)
//                   res.status(500).send(err)
//                 })
//             }
//             else {
//               res.status(401).send("You can only update your own profile.  Please check the id of the user in the request body.")
//             }
//           }
//           else {
//             res.status(400).send("The user object was not JSON or did not have an id.")
//           }
//         }
//         else {
//           res.status(401).send("You are not a Glossing Apps user, this API is not for you.")
//         }
//       })
//       .catch(err => {
//         res.status(500).send(err)
//       })
//   }
//   else {
//     res.status(403).send("You must be a Glossing Apps user.  Please provide an access token in the Authorization header.")
//   }
// })

/**
 * Get all the users from the Auth0 Tenant with app "glossing".
 */
router.get('/getAllUsers', async function (req, res, next) {
  const token = (req.header('Authorization') ?? '').replace('Bearer ', '').trim()

  if (!token) {
    res.status(401).send('You must provide an access token in the Authorization header.')
    return
  }

  try {
    const currentUser = await authenticationClient.getProfile(token)

    if (!isAdmin(currentUser)) {
      res.status(403).send('You are not an admin')
      return
    }

    const roleUsers = await Promise.all(
      resolvedRoles.map(async ({ id, name }) => ({
        name,
        users: await listUsersForRole(id),
      }))
    )

    const usersWithRoles = roleUsers.flatMap(({ name, users }) =>
      users.map((user) => ({ ...user, role: name }))
    )

    res.json(usersWithRoles)
  } catch (error) {
    if (error?.status === 401 || error?.statusCode === 401) {
      res.status(401).send('Unable to authenticate request')
      return
    }
    next(error)
  }
})

/**
 * Tell our Glossing Auth0 to assign the given user id to the Glossing Public role.
 * This limits access token scope.
 * Other roles are removed.
 */
router.post('/assignRole', async function (req, res) {
  const token = (req.header('Authorization') ?? '').replace('Bearer ', '').trim()
  const { userid, role } = req.body ?? {}
  const normalizedRole = String(role ?? '').toLowerCase()
  const targetRoleId = resolveRoleIdByName(normalizedRole)

  if (!token) {
    res.status(401).send('Unable to authenticate request')
    return
  }

  if (normalizedRole === 'admin') {
    res.status(501).send('No changing Admin roles here')
    return
  }

  if (!userid || !targetRoleId) {
    res.status(406).send('Failed to provide data for assignment')
    return
  }

  try {
    const currentUser = await authenticationClient.getProfile(token)

    if (!isAdmin(currentUser)) {
      res.status(403).send('Unable to authorize request by non-administrator')
      return
    }

    await managementClient.users.assignRoles({ id: userid }, { roles: [targetRoleId] })

    const remainingRoleIds = roleIds.filter((existingRole) => existingRole !== targetRoleId)
    if (remainingRoleIds.length) {
      await managementClient.users.removeRoles({ id: userid }, { roles: remainingRoleIds })
    }

    const roleLabel = normalizedRole
      ? `${normalizedRole.charAt(0).toUpperCase()}${normalizedRole.slice(1)}`
      : 'Role'

    res.status(200).send(`${roleLabel} role was successfully assigned to the user`)
  } catch (error) {
    if (error?.status === 401 || error?.statusCode === 401) {
      res.status(401).send('Unable to authenticate request')
      return
    }

    res.status(500).send(error)
  }
})

/**
 *  Given a user profile, check if that user is a Glossing Apps admin.
 */
function isAdmin(user) {
  let roles = { roles: [] }
  if (user[process.env.GLOSSING_ROLES_CLAIM]) {
    roles = user[process.env.GLOSSING_ROLES_CLAIM].roles ?? { roles: [] }
  }
  return roles.includes('glossing_user_admin')
}

export default router
