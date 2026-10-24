const express = require('express')
const criptografia = require('node:crypto')
const bcrypt = require('bcryptjs')
const conexao = require('../config/database')
const { transferirCarrinhoVisitante } = require('../services/carrinho')
const { enviarCodigoRedefinicao } = require('../services/email')
const router = express.Router()

router.get('/registro', (req, res) => {
  if (req.session.usuario) return res.redirect('/')
  res.render('auth/registro')
})


// ROTA POST PARA CADASTRO DE USUÁRIO
router.post('/registro', (req, res) => {
  if (req.session.usuario) return res.redirect('/')

  const { nome, email, telefone, senha, confirm_senha } = req.body
  const nomeUsuario = typeof nome === 'string' ? nome.trim() : ''
  const emailUsuario = typeof email === 'string' ? email.trim() : ''
  const telefoneUsuario = typeof telefone === 'string' ? telefone.trim() : ''

  if (!nomeUsuario || !emailUsuario || !telefoneUsuario || typeof senha !== 'string' || !senha) {
    return res.render('auth/registro', { erro: 'Preencha todos os campos' })
  }

  if (senha.length < 8) {
    return res.render('auth/registro', { erro: 'A senha precisa ter no mínimo 8 caracteres' })
  }

  if (senha !== confirm_senha) {
    return res.render('auth/registro', {  erro: 'As senhas não conferem'  })
  }

  const sqlSelectEmail = 'SELECT COUNT(*) AS Existe FROM usuario WHERE email = ?'

  conexao.query(sqlSelectEmail, [emailUsuario], (erro, resultado) => {
    if(erro) {
      console.log(erro);
      return res.status(500).send('Erro do servidor')
    }

    if(resultado[0].Existe > 0) {
      return res.render('auth/registro', { erro: 'Esse e-mail já existe' })
    }

    // AQUI É GERADO O HASH PARA PROTEGER A SENHA
    bcrypt.hash(senha, 10, (erro, hash) => {
      if(erro) {
        console.log(erro);
        return res.status(500).send('Erro do servidor')
      }

      const sqlInsert = 'INSERT INTO usuario(nome_usuario, email, telefone, senha) VALUES (?, ?, ?, ?)'

      conexao.query(sqlInsert, [nomeUsuario, emailUsuario, telefoneUsuario, hash], (erroInsert, resultadoInsert) => {
        if(erroInsert) {
          if(erroInsert.code === 'ER_DUP_ENTRY') {
            return res.render('auth/registro', { erro: 'Esse e-mail já existe' })
          }
          console.log(erroInsert);
          return res.status(500).send('Erro do servidor')
        }

        return res.redirect('/login')
      })
    })
  })
})

router.get('/login', (req, res) => {
  if (req.session.usuario) return res.redirect('/')
  res.render('auth/login')
})

router.post('/login', (req, res) => {
  if (req.session.usuario) return res.redirect('/')

  const { email, password } = req.body
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || password.length > 256) {
    return res.status(400).render('auth/login', { erro: 'Informe e-mail e senha.' })
  }

  const sql = 'SELECT id_usuario, nome_usuario, acesso, senha FROM usuario WHERE email = ? LIMIT 1'

  // Busca a conta pelo e-mail, como no cadastro.
  conexao.query(sql, [email.trim()], (erro, usuarios) => {
    if (erro) {
      console.log(erro)
      return res.status(500).render('auth/login', { erro: 'Não foi possível entrar. Tente novamente.' })
    }

    const usuario = usuarios[0]
    if (!usuario) {
      return res.status(401).render('auth/login', { erro: 'E-mail ou senha inválidos.' })
    }

    // Compara a senha digitada com o hash salvo no banco.
    bcrypt.compare(password, usuario.senha, (erroCompare, senhaValida) => {
      if (erroCompare) {
        console.log(erroCompare)
        return res.status(500).render('auth/login', { erro: 'Não foi possível entrar. Tente novamente.' })
      }

      if (!senhaValida) {
        return res.status(401).render('auth/login', { erro: 'E-mail ou senha inválidos.' })
      }

      // Guarda o token do carrinho do visitante ANTES de recriar a sessão:
      // o regenerate apaga tudo o que estava na sessão antiga.
      const tokenVisitante = req.session.tokenCarrinhoVisitante

      // Cria um identificador novo de sessão após o login.
      req.session.regenerate(erroSessao => {
        if (erroSessao) {
          console.log(erroSessao)
          return res.status(500).render('auth/login', { erro: 'Não foi possível entrar. Tente novamente.' })
        }

        // Guarda só os dados necessários do usuário; a senha não vai para a sessão.
        req.session.usuario = {
          id_usuario: usuario.id_usuario,
          nome_usuario: usuario.nome_usuario,
          acesso: usuario.acesso
        }

        // Leva o carrinho montado como visitante para a conta (junta com o carrinho que já existir).
        // Se a transferência falhar, o login continua: o erro fica registrado no terminal.
        transferirCarrinhoVisitante(usuario.id_usuario, tokenVisitante)
          .catch(erroCarrinho => console.log(erroCarrinho))
          .then(() => {
            req.session.save(erroSalvar => {
              if (erroSalvar) {
                console.log(erroSalvar)
                return res.status(500).render('auth/login', { erro: 'Não foi possível entrar. Tente novamente.' })
              }

              return res.redirect('/carrinho')
            })
          })
      })
    })
  })
})

router.post('/logout', (req, res) => {
  const caminhoCookie = req.session.cookie.path || '/'
  req.session.destroy(erro => {
    if (erro) {
      console.error('Não foi possível encerrar a sessão:', erro)
      return res.status(500).send('Não foi possível sair. Tente novamente.')
    }

    res.clearCookie('connect.sid', { path: caminhoCookie })
    return res.redirect('/')
  })
})

// ---------------------------------------------------------------------------
// ESQUECI A SENHA
// São 3 etapas, guardadas na sessão (req.session.redefinicao):
//   1. "email"      → o usuário informa o e-mail e recebe um código de 6 dígitos
//   2. "codigo"     → digita o código (vale 15 minutos, no máximo 5 tentativas)
//   3. "nova-senha" → cria a nova senha, que é salva com bcrypt
// O código fica no banco só como hash (tabela redefinicao_senha), nunca em texto.
// ---------------------------------------------------------------------------
const MINUTOS_VALIDADE = 15
const MAX_TENTATIVAS = 5
const SEGUNDOS_ENTRE_ENVIOS = 60

function hashCodigo(codigo) {
  return criptografia.createHash('sha256').update(codigo).digest('hex')
}

// Descobre em qual etapa o usuário está, olhando a sessão
function etapaAtual(req) {
  if (!req.session.redefinicao) return 'email'
  if (req.session.redefinicao.autorizado) return 'nova-senha'
  return 'codigo'
}

function telaRedefinicao(res, etapa, mensagens) {
  res.render('auth/esqueci-senha', { etapa, erro: null, aviso: null, ...mensagens })
}

router.get('/esqueci-senha', (req, res) => {
  // ?recomecar=1 limpa o processo (ex.: digitou o e-mail errado)
  if (req.query.recomecar) delete req.session.redefinicao

  const etapa = etapaAtual(req)
  let aviso = null
  if (etapa === 'codigo') {
    aviso = 'Se o e-mail ' + req.session.redefinicao.email + ' estiver cadastrado, enviamos um código para ele.'
  }
  telaRedefinicao(res, etapa, { aviso })
})

// Etapa 1: recebe o e-mail, gera o código e envia
router.post('/esqueci-senha', (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : ''
  if (!email) {
    return telaRedefinicao(res, 'email', { erro: 'Informe o seu e-mail.' })
  }

  conexao.query('SELECT id_usuario, nome_usuario FROM usuario WHERE email = ? LIMIT 1', [email], (erro, usuarios) => {
    if (erro) {
      console.log(erro)
      return telaRedefinicao(res, 'email', { erro: 'Não foi possível continuar. Tente novamente.' })
    }

    // A tela é a mesma exista ou não a conta: assim ninguém descobre quais e-mails estão cadastrados
    req.session.redefinicao = { email, usuarioId: usuarios.length ? usuarios[0].id_usuario : null, autorizado: false }

    if (usuarios.length === 0) {
      return res.redirect('/esqueci-senha')
    }

    const usuario = usuarios[0]

    // Evita mandar vários e-mails seguidos para a mesma pessoa
    const sqlUltimoEnvio = 'SELECT TIMESTAMPDIFF(SECOND, enviado_em, NOW()) AS segundos FROM redefinicao_senha WHERE usuario_id = ?'
    conexao.query(sqlUltimoEnvio, [usuario.id_usuario], (erro2, envios) => {
      if (erro2) {
        console.log(erro2)
        return telaRedefinicao(res, 'email', { erro: 'Não foi possível continuar. Tente novamente.' })
      }
      if (envios.length && envios[0].segundos < SEGUNDOS_ENTRE_ENVIOS) {
        return res.redirect('/esqueci-senha')
      }

      // Código aleatório de 6 dígitos (crypto, não Math.random)
      const codigo = String(criptografia.randomInt(0, 1000000)).padStart(6, '0')

      // Um código por usuário: se já existir, é substituído e as tentativas zeram
      const sqlSalvar = `
        INSERT INTO redefinicao_senha (usuario_id, codigo_hash, expira_em, tentativas, enviado_em)
        VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${MINUTOS_VALIDADE} MINUTE), 0, NOW())
        ON DUPLICATE KEY UPDATE codigo_hash = VALUES(codigo_hash), expira_em = VALUES(expira_em),
                                tentativas = 0, enviado_em = NOW()
      `
      conexao.query(sqlSalvar, [usuario.id_usuario, hashCodigo(codigo)], (erro3) => {
        if (erro3) {
          console.log(erro3)
          return telaRedefinicao(res, 'email', { erro: 'Não foi possível continuar. Tente novamente.' })
        }

        enviarCodigoRedefinicao(email, usuario.nome_usuario, codigo)
          .catch(erroEmail => console.log(erroEmail.message)) // a falha fica no terminal
          .then(() => res.redirect('/esqueci-senha'))
      })
    })
  })
})

// Etapa 2: confere o código
router.post('/esqueci-senha/codigo', (req, res) => {
  const processo = req.session.redefinicao
  if (!processo) return res.redirect('/esqueci-senha')

  const codigo = typeof req.body.codigo === 'string' ? req.body.codigo.trim() : ''
  const mensagemInvalido = 'Código inválido ou expirado.'

  // E-mail sem conta: o código nunca confere (mesma mensagem, de propósito)
  if (!processo.usuarioId || !/^\d{6}$/.test(codigo)) {
    return telaRedefinicao(res, 'codigo', { erro: mensagemInvalido })
  }

  const sql = 'SELECT codigo_hash, tentativas, (expira_em > NOW()) AS dentro_do_prazo FROM redefinicao_senha WHERE usuario_id = ?'
  conexao.query(sql, [processo.usuarioId], (erro, linhas) => {
    if (erro) {
      console.log(erro)
      return telaRedefinicao(res, 'codigo', { erro: 'Não foi possível continuar. Tente novamente.' })
    }

    const registro = linhas[0]
    if (!registro || !registro.dentro_do_prazo || registro.tentativas >= MAX_TENTATIVAS) {
      return telaRedefinicao(res, 'codigo', { erro: mensagemInvalido + ' Peça um novo código.' })
    }

    if (registro.codigo_hash !== hashCodigo(codigo)) {
      // Errou: conta a tentativa
      conexao.query('UPDATE redefinicao_senha SET tentativas = tentativas + 1 WHERE usuario_id = ?', [processo.usuarioId], (erro2) => {
        if (erro2) console.log(erro2)
        telaRedefinicao(res, 'codigo', { erro: mensagemInvalido })
      })
      return
    }

    // Acertou: libera a etapa da nova senha
    processo.autorizado = true
    res.redirect('/esqueci-senha')
  })
})

// Etapa 3: salva a nova senha
router.post('/esqueci-senha/nova-senha', (req, res) => {
  const processo = req.session.redefinicao
  if (!processo || !processo.autorizado || !processo.usuarioId) return res.redirect('/esqueci-senha')

  const senha = typeof req.body.senha === 'string' ? req.body.senha : ''
  const confirmar = typeof req.body.confirmar_senha === 'string' ? req.body.confirmar_senha : ''

  if (senha.length < 8 || senha.length > 256) {
    return telaRedefinicao(res, 'nova-senha', { erro: 'A senha precisa ter no mínimo 8 caracteres.' })
  }
  if (senha !== confirmar) {
    return telaRedefinicao(res, 'nova-senha', { erro: 'As senhas não conferem.' })
  }

  bcrypt.hash(senha, 10, (erro, hash) => {
    if (erro) {
      console.log(erro)
      return telaRedefinicao(res, 'nova-senha', { erro: 'Não foi possível salvar. Tente novamente.' })
    }

    conexao.query('UPDATE usuario SET senha = ? WHERE id_usuario = ?', [hash, processo.usuarioId], (erro2) => {
      if (erro2) {
        console.log(erro2)
        return telaRedefinicao(res, 'nova-senha', { erro: 'Não foi possível salvar. Tente novamente.' })
      }

      // O código já foi usado: apaga para não servir de novo
      conexao.query('DELETE FROM redefinicao_senha WHERE usuario_id = ?', [processo.usuarioId], (erro3) => {
        if (erro3) console.log(erro3)
        delete req.session.redefinicao
        telaRedefinicao(res, 'concluido', {})
      })
    })
  })
})



module.exports = router
