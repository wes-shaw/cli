import {decodeOrganizationGid} from './organization.js'
import {describe, expect, test} from 'vitest'

describe('decodeOrganizationGid', () => {
  test('extracts the numeric id from a base64-encoded GraphQL global id', () => {
    const gid = Buffer.from('gid://organization/Organization/1234').toString('base64')
    expect(decodeOrganizationGid(gid)).toBe('1234')
  })

  test('returns undefined when the decoded string does not end with a numeric id', () => {
    const gid = Buffer.from('not-a-gid').toString('base64')
    expect(decodeOrganizationGid(gid)).toBeUndefined()
  })

  test('returns undefined for non-base64 garbage that decodes without a trailing numeric id', () => {
    expect(decodeOrganizationGid('!!!')).toBeUndefined()
  })
})
