declare module '@semantic-release/release-notes-generator' {
  export function generateNotes(pluginConfig: object, context: object): Promise<string>
}
