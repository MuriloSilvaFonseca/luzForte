const express = require('express')
const bcrypt = require('bcryptjs')
const conexao = require('../config/database')
const { userEstaLogado } = require('../middlewares/auth')
const { montarLinkDuvida } = require('../services/whatsapp')
const router = express.Router()

// Mensagens que aparecem no topo da página depois de salvar.
// A rota de POST redireciona com ?ok=... ou ?erro=... e aqui a gente traduz o código em texto.
const mensagensOk = {
  dados: 'Dados atualizados com sucesso.',
  senha: 'Senha alterada com sucesso.'
}
const mensagensErro = {
  campos: 'Preencha todos os campos obrigatórios.',
  telefone: 'Informe um telefone válido com DDD.',
  senhaAtual: 'A senha atual está incorreta.',
  senhaCurta: 'A nova senha precisa ter no mínimo 8 caracteres.',
  senhaDiferente: 'A confirmação não confere com a nova senha.',
  servidor: 'Não foi possível salvar agora. Tente novamente.'
}

// Qual aba abre primeiro: depois de mexer na senha, volta para a aba de senha.
function abaDaMensagem(codigo) {
  if (codigo === 'senha' || codigo === 'senhaAtual' || codigo === 'senhaCurta' || codigo === 'senhaDiferente') return 'senha'
  return 'dados'
}

function erroServidor(res, erro) {
  console.log(erro)
  return res.status(500).render('loja/erro', {
    tituloPagina: 'Erro no servidor',
    codigo: '500',
    titulo: 'Tivemos um problema por aqui',
    mensagem: 'Não foi possível carregar sua conta agora. Tente novamente em instantes.'
  })
}

// ========== PÁGINA MINHA CONTA ==========
router.get('/minha-conta', userEstaLogado, (req, res) => {
  const idUsuario = req.session.usuario.id_usuario

  // 1) Dados do usuário. A senha NÃO entra no SELECT.
  const sqlUsuario = 'SELECT nome_usuario, email, telefone, acesso, data_criacao FROM usuario WHERE id_usuario = ?'

  // 2) Pedidos do usuário. O status 'carrinho' fica de fora: carrinho ainda não é pedido.
  const sqlPedidos = `
    SELECT p.id_pedido, p.status, p.total, p.observacoes, p.data_criacao,
           f.nome_pagamento
    FROM pedido p
    LEFT JOIN forma_pagamento f ON f.id_forma_pagamento = p.forma_pagamento_id
    WHERE p.usuario_id = ? AND p.status <> 'carrinho'
    ORDER BY p.data_criacao DESC
  `

  // 3) Itens de TODOS os pedidos de uma vez. "IN (?)" recebe um vetor de ids.
  const sqlItens = `
    SELECT pp.pedido_id, pp.quantidade, pp.preco_unitario, pp.subtotal,
           pr.titulo_produto, i.url AS imagem
    FROM produto_pedido pp
    JOIN produto pr ON pr.sku = pp.produto_sku
    LEFT JOIN imagem_produto i ON i.produto_sku = pr.sku AND i.ordem = 1
    WHERE pp.pedido_id IN (?)
    ORDER BY pr.titulo_produto
  `

  conexao.query(sqlUsuario, [idUsuario], (erro, resultadoUsuario) => {
    if (erro) return erroServidor(res, erro)

    // Usuário apagado do banco com a sessão ainda aberta: manda logar de novo.
    if (resultadoUsuario.length === 0) return res.redirect('/login')
    const dados = resultadoUsuario[0]

    conexao.query(sqlPedidos, [idUsuario], (erro2, pedidos) => {
      if (erro2) return erroServidor(res, erro2)

      const codigoOk = req.query.ok
      const codigoErro = req.query.erro
      const pagina = {
        tituloPagina: 'Minha conta',
        dados,
        pedidos,
        linkWhatsAppDuvida: montarLinkDuvida(), // null se WHATSAPP_LOJA não estiver no .env
        sucesso: mensagensOk[codigoOk] || null,
        erro: mensagensErro[codigoErro] || null,
        // Abre a aba certa: ?aba=pedidos no link, ou a aba da mensagem
        aba: req.query.aba || abaDaMensagem(codigoOk || codigoErro)
      }

      // Sem pedidos: não precisa buscar itens.
      if (pedidos.length === 0) return res.render('loja/conta', pagina)

      // Monta o vetor só com os ids: [9, 7, 1]
      const idsPedidos = []
      for (let i = 0; i < pedidos.length; i++) {
        idsPedidos.push(pedidos[i].id_pedido)
        pedidos[i].itens = []
      }

      conexao.query(sqlItens, [idsPedidos], (erro3, itens) => {
        if (erro3) return erroServidor(res, erro3)

        // Coloca cada item dentro do pedido certo
        for (let i = 0; i < itens.length; i++) {
          for (let j = 0; j < pedidos.length; j++) {
            if (pedidos[j].id_pedido === itens[i].pedido_id) {
              pedidos[j].itens.push(itens[i])
            }
          }
        }

        res.render('loja/conta', pagina)
      })
    })
  })
})

// ========== SALVAR DADOS PESSOAIS ==========
// O e-mail não é editável aqui: ele é o login e é único no banco.
router.post('/minha-conta/dados', userEstaLogado, (req, res) => {
  const idUsuario = req.session.usuario.id_usuario
  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : ''
  const telefone = typeof req.body.telefone === 'string' ? req.body.telefone.trim() : ''

  if (!nome || !telefone) return res.redirect('/minha-conta?erro=campos')

  // Conta só os números: (19) 99999-0000 tem 11 dígitos; fixo tem 10.
  const digitos = telefone.replace(/\D/g, '')
  if (digitos.length < 10 || digitos.length > 11) return res.redirect('/minha-conta?erro=telefone')

  const sql = 'UPDATE usuario SET nome_usuario = ?, telefone = ? WHERE id_usuario = ?'
  conexao.query(sql, [nome, telefone, idUsuario], (erro) => {
    if (erro) {
      console.log(erro)
      return res.redirect('/minha-conta?erro=servidor')
    }

    // Atualiza o nome guardado na sessão, senão o "Olá, ..." do header continua com o nome antigo
    req.session.usuario.nome_usuario = nome
    req.session.save(() => res.redirect('/minha-conta?ok=dados'))
  })
})

// ========== ALTERAR SENHA ==========
router.post('/minha-conta/senha', userEstaLogado, (req, res) => {
  const idUsuario = req.session.usuario.id_usuario
  const { senha_atual, nova_senha, confirma_senha } = req.body

  if (!senha_atual || !nova_senha || !confirma_senha) return res.redirect('/minha-conta?erro=campos&aba=senha')
  if (nova_senha.length < 8) return res.redirect('/minha-conta?erro=senhaCurta')
  if (nova_senha !== confirma_senha) return res.redirect('/minha-conta?erro=senhaDiferente')

  conexao.query('SELECT senha FROM usuario WHERE id_usuario = ?', [idUsuario], (erro, resultado) => {
    if (erro || resultado.length === 0) {
      console.log(erro)
      return res.redirect('/minha-conta?erro=servidor&aba=senha')
    }

    // Compara a senha digitada com o hash salvo (igual ao login)
    bcrypt.compare(senha_atual, resultado[0].senha, (erro2, confere) => {
      if (erro2) {
        console.log(erro2)
        return res.redirect('/minha-conta?erro=servidor&aba=senha')
      }
      if (!confere) return res.redirect('/minha-conta?erro=senhaAtual')

      bcrypt.hash(nova_senha, 10, (erro3, hash) => {
        if (erro3) {
          console.log(erro3)
          return res.redirect('/minha-conta?erro=servidor&aba=senha')
        }

        conexao.query('UPDATE usuario SET senha = ? WHERE id_usuario = ?', [hash, idUsuario], (erro4) => {
          if (erro4) {
            console.log(erro4)
            return res.redirect('/minha-conta?erro=servidor&aba=senha')
          }
          res.redirect('/minha-conta?ok=senha')
        })
      })
    })
  })
})

module.exports = router
