async function adquirirLock(conexao, nome, timeoutSegundos = 5) {
  const [[resultado]] = await conexao.execute('SELECT GET_LOCK(?, ?) AS obtida', [nome, timeoutSegundos])
  if (Number(resultado.obtida) !== 1) {
    throw Object.assign(new Error('Carrinho ocupado. Tente novamente.'), {
      code: 'ER_CARRINHO_OCUPADO',
      status: 409
    })
  }
  return nome
}

async function liberarLock(conexao, nome) {
  if (!nome) return
  await conexao.execute('SELECT RELEASE_LOCK(?) AS liberada', [nome])
}

module.exports = { adquirirLock, liberarLock }
