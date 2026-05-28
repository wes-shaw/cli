export function extractHost(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const lowered = value.toLowerCase()
  try {
    return new URL(lowered).hostname
  } catch {
    return lowered.replace(/^https?:\/\//, '').split('/')[0]
  }
}

export function extractMyshopifyHandle(value: string | null | undefined): string | undefined {
  const host = extractHost(value)
  if (!host) return undefined
  const match = host.match(/^([^.]+)\.myshopify\.com$/)
  return match ? match[1] : undefined
}
