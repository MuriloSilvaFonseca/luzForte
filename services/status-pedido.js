const statusInfo = {
  solicitado: { rotulo: 'Solicitado', cor: 'yellow' },
  aprovado: { rotulo: 'Aprovado', cor: 'blue' },
  finalizado: { rotulo: 'Finalizado', cor: 'green' },
  cancelado: { rotulo: 'Cancelado', cor: 'red' }
}
const transicoes = {
  solicitado: ['aprovado', 'cancelado'],
  aprovado: ['finalizado', 'cancelado'],
  finalizado: [],
  cancelado: []
}

module.exports = { statusInfo, transicoes }
