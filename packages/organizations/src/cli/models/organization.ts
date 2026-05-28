export interface Organization {
  id: string
  businessName: string
}

/**
 * Decodes a base64-encoded GraphQL global id like
 * `gid://organization/Organization/123` and returns the bare numeric id.
 * Returns undefined when the input doesn't match that shape.
 */
export function decodeOrganizationGid(gid: string): string | undefined {
  const decoded = Buffer.from(gid, 'base64').toString('ascii')
  const match = decoded.match(/\/(\d+)$/)
  return match ? match[1] : undefined
}
