const conexao = require('../config/database')

// Conta as avaliações pendentes para o selo do menu "Avaliações" do painel admin.
// Fica num arquivo próprio para valer em TODAS as páginas do admin
// (antes só rodava em parte delas e o selo aparecia zerado nas outras).
//
// A contagem só acontece quando uma página vai ser montada (res.render):
// redirecionamentos, erros e respostas JSON não fazem essa consulta à toa.
function avaliacoesPendentes(req, res, next) {
  const renderOriginal = res.render.bind(res)
  res.render = (view, dados, callback) => {
    conexao.promise().query("SELECT COUNT(*) AS n FROM avaliacao_produto WHERE status = 'pendente'")
      .then(([[linha]]) => { res.locals.avaliacoesPendentes = Number(linha.n) })
      .catch(erro => {
        res.locals.avaliacoesPendentes = 0
        console.error('Falha ao contar avaliações pendentes:', erro.code || erro.message)
      })
      .then(() => renderOriginal(view, dados, callback))
  }
  next()
}

module.exports = avaliacoesPendentes
