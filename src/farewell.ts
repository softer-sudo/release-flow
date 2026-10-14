export function farewell(name: string): string {
  const trimmed = name.trim()
  return `Goodbye, ${trimmed === '' ? 'world' : trimmed}!`
}
