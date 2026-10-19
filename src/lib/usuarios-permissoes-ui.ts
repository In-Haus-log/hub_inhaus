type Cliente = { id: number; nome: string }
type TelaCliente = { key: string; emBreve?: boolean }
type ClienteHub = { label: string; telas: TelaCliente[] }

function normalizarNomeCliente(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim()
}

export function idsContratantesSelecionados(contratantes: number[], visibleScreens: string[]) {
  const idsTelas = visibleScreens.flatMap((tela) => {
    const match = /^cliente-bi:([1-9]\d*)$/.exec(tela)
    const id = match ? Number(match[1]) : NaN
    return Number.isSafeInteger(id) ? [id] : []
  })
  return Array.from(new Set([...contratantes, ...idsTelas]))
}

export function idsDeSistemasCliente(visibleScreens: string[], clientes: Cliente[], clientesHub: ClienteHub[]) {
  const telasExistentes = new Set(visibleScreens)
  return clientes.filter((cliente) => {
    const portal = clientesHub.find((item) => normalizarNomeCliente(item.label) === normalizarNomeCliente(cliente.nome))
    return portal?.telas.some((tela) => telasExistentes.has(tela.key)) ?? false
  }).map((cliente) => cliente.id)
}

export function sincronizarTelasDeClientes(
  visibleScreens: string[],
  selecionados: number[],
  clientes: Cliente[],
  clientesHub: ClienteHub[],
) {
  const portaisConhecidos = clientesHub.filter((portal) =>
    clientes.some((cliente) => normalizarNomeCliente(cliente.nome) === normalizarNomeCliente(portal.label)),
  )
  const chavesConhecidas = new Set([
    ...clientes.map((cliente) => `cliente-bi:${cliente.id}`),
    ...portaisConhecidos.flatMap((portal) => portal.telas.map((tela) => tela.key)),
  ])
  const telasPreservadas = visibleScreens.filter((chave) => !chavesConhecidas.has(chave))
  const novasTelas = new Set<string>()
  for (const cliente of clientes) {
    if (!selecionados.includes(cliente.id)) continue
    novasTelas.add(`cliente-bi:${cliente.id}`)
    const portal = portaisConhecidos.find((item) => normalizarNomeCliente(item.label) === normalizarNomeCliente(cliente.nome))
    portal?.telas.filter((tela) => !tela.emBreve).forEach((tela) => novasTelas.add(tela.key))
  }
  return Array.from(new Set([...telasPreservadas, ...novasTelas]))
}
