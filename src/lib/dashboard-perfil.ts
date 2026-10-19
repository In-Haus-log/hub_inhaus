/** A experiência de preenchimento exclusivo só vale sem outras telas concedidas. */
export function preenchedorExclusivo(input: {
  epiValida: boolean; epiConfig: boolean; isAdmin: boolean; isAnalista?: boolean; visibleScreens: string[]
}): boolean {
  return input.epiValida && !input.epiConfig && !input.isAdmin && !input.isAnalista &&
    !input.visibleScreens.some(key => !key.startsWith("epi-"))
}
