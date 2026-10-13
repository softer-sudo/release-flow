import { TICKET_KEY_SOURCE } from './tools/ticket.ts'

const ticketScope = new RegExp(`^${TICKET_KEY_SOURCE}$`)

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'scope-is-ticket': ({ scope }) => [
          scope !== null && ticketScope.test(scope),
          'scope must be a ticket key, e.g. feat(ABC-1234): add greeting',
        ],
      },
    },
  ],
  rules: {
    'scope-empty': [2, 'never'],
    'scope-case': [0],
    'scope-is-ticket': [2, 'always'],
    'header-max-length': [2, 'always', 100],
  },
  ignores: [(message) => message.startsWith('chore(release):')],
}
