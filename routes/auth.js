const express = require('express')
const criptografia = require('node:crypto')
const bcrypt = require('bcryptjs')
const conexao = require('../config/database')
const { transferirCarrinhoVisitante } = require('../services/carrinho')
const { enviarCodigoRedefinicao } = require('../services/email')
const router = express.Router()

function renderizarRegistro(res, erro, valores = {}, status = 200) {
  return res.status(status).render('auth/registro', { erro, valores })
}

router.get('/registro', (req, res) => {
  if (req.session.usuario) {
    if (req.session.usuario.acesso === 'admin') return res.redirect('/admin')
    return res.redirect('/')
  }
  res.render('auth/registro')
})


// ROTA POST PARA CADASTRO DE USUÁRIO
router.post('/registro', (req, res) => {
  if (req.session.usuario) {
    if (req.session.usuario.acesso === 'admin') return res.redirect('/admin')
    return res.redirect('/')
  }

  const { nome, email, telefone, senha, confirm_senha } = req.body
  const nomeUsuario = typeof nome === 'string' ? nome.trim() : ''
  const emailUsuario = typeof email === 'string' ? email.trim() : ''
  const telefoneUsuario = typeof telefone === 'string' ? telefone.trim() : ''
  const valores = { nome: nomeUsuario, email: emailUsuario, telefone: telefoneUsuario }

  if (!nomeUsuario || !emailUsuario || !telefoneUsuario || typeof senha !== 'string' || !senha) {
    return renderizarRegistro(res, 'Preencha todos os campos', valores)
  }

  if (nomeUsuario.length > 200) {
    return renderizarRegistro(res, 'O nome pode ter no máximo 200 caracteres', valores)
  }

  // Formato simples de e-mail: algo@algo.algo, sem espaços
  if (emailUsuario.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailUsuario)) {
    return renderizarRegistro(res, 'Informe um e-mail válido', valores)
  }

  // Telefone com DDD: 10 ou 11 números (aceita digitar com parênteses, espaço e traço)
  const numerosTelefone = telefoneUsuario.replace(/\D/g, '')
  if (numerosTelefone.length < 10 || numerosTelefone.length > 11) {
    return renderizarRegistro(res, 'Informe o telefone com DDD (10 ou 11 números)', valores)
  }

  if (senha.length < 8) {
    return renderizarRegistro(res, 'A senha precisa ter no mínimo 8 caracteres', valores)
  }

  if (senha !== confirm_senha) {
    return renderizarRegistro(res, 'As senhas não conferem', valores)
  }

  const sqlSelectEmail = 'SELECT COUNT(*) AS Existe FROM usuario WHERE email = ?'

  conexao.query(sqlSelectEmail, [emailUsuario], (erro, resultado) => {
    if(erro) {
      console.log(erro);
      return renderizarRegistro(res, 'Não foi possível criar a conta. Tente novamente.', valores, 500)
    }

    if(resultado[0].Existe > 0) {
      return renderizarRegistro(res, 'Esse e-mail já existe', valores)
    }

    // AQUI É GERADO O HASH PARA PROTEGER A SENHA
    bcrypt.hash(senha, 10, (erro, hash) => {
      if(erro) {
        console.log(erro);
        return renderizarRegistro(res, 'Não foi possível criar a conta. Tente novamente.', valores, 500)
      }

      const sqlInsert = 'INSERT INTO usuario(nome_usuario, email, telefone, senha) VALUES (?, ?, ?, ?)'

      conexao.query(sqlInsert, [nomeUsuario, emailUsuario, telefoneUsuario, hash], (erroInsert, resultadoInsert) => {
        if(erroInsert) {
          if(erroInsert.code === 'ER_DUP_ENTRY') {
            return renderizarRegistro(res, 'Esse e-mail já existe', valores)
          }
          console.log(erroInsert);
          return renderizarRegistro(res, 'Não foi possível criar a conta. Tente novamente.', valores, 500)
        }

        return res.redirect('/login')
      })
    })
  })
})

// ---------------------------------------------------------------------------
// LIMITE DE TENTATIVAS NO LOGIN
// Depois de 5 senhas erradas para o mesmo e-mail (vindas do mesmo IP), o login
// fica bloqueado por 15 minutos. Isso impede alguém de testar milhares de senhas.
// Fica guardado na memória do servidor (zera quando o servidor reinicia).
// ---------------------------------------------------------------------------
const MAX_ERROS_LOGIN = 5
const MINUTOS_BLOQUEIO_LOGIN = 15
const errosLogin = new Map()

function chaveLogin(req, email) {
  return email.trim().toLowerCase() + '|' + req.ip
}

function loginBloqueado(chave) {
  const registro = errosLogin.get(chave)
  if (!registro) return false
  if (Date.now() - registro.inicio > MINUTOS_BLOQUEIO_LOGIN * 60 * 1000) {
    errosLogin.delete(chave)
    return false
  }
  return registro.erros >= MAX_ERROS_LOGIN
}

function registrarErroLogin(chave) {
  const registro = errosLogin.get(chave)
  if (!registro || Date.now() - registro.inicio > MINUTOS_BLOQUEIO_LOGIN * 60 * 1000) {
    errosLogin.set(chave, { erros: 1, inicio: Date.now() })
  } else {
    registro.erros++
  }
  // Evita a lista crescer sem limite
  if (errosLogin.size > 10000) errosLogin.clear()
}

router.get('/login', (req, res) => {
  if (req.session.usuario) {
    if (req.session.usuario.acesso === 'admin') return res.redirect('/admin')
    return res.redirect('/')
  }
  res.render('auth/login', { erro: req.query.conta === 'desativada' ? 'Sua conta está desativada.' : '' })
})

router.post('/login', (req, res) => {
  if (req.session.usuario) {
    if (req.session.usuario.acesso === 'admin') return res.redirect('/admin')
    return res.redirect('/')
  }

  const { email, password } = req.body
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || password.length > 256) {
    return res.status(400).render('auth/login', { erro: 'Informe e-mail e senha.' })
  }

  const chave = chaveLogin(req, email)
  if (loginBloqueado(chave)) {
    return res.status(429).render('auth/login', { erro: 'Muitas tentativas erradas. Aguarde ' + MINUTOS_BLOQUEIO_LOGIN + ' minutos e tente de novo.' })
  }

  const sql = 'SELECT id_usuario, nome_usuario, acesso, senha, ativo FROM usuario WHERE email = ? LIMIT 1'

  // Busca a conta pelo e-mail, como no cadastro.
  conexao.query(sql, [email.trim()], (erro, usuarios) => {
    if (erro) {
      console.log(erro)
      return res.status(500).render('auth/login', { erro: 'Não foi possível entrar. Tente novamente.' })
    }

    const usuario = usuarios[0]
    if (!usuario || Number(usuario.ativo) !== 1) {
      registrarErroLogin(chave)
      return res.status(401).render('auth/login', { erro: 'E-mail ou senha inválidos.' })
    }

    // Compara a senha digitada com o hash salvo no banco.
    bcrypt.compare(password, usuario.senha, (erroCompare, senhaValida) => {
      if (erroCompare) {
        console.log(erroCompare)
        return res.status(500).render('auth/login', { erro: 'Não foi possível entrar. Tente novamente.' })
      }

      if (!senhaValida) {
        registrarErroLogin(chave)
        return res.status(401).render('auth/login', { erro: 'E-mail ou senha inválidos.' })
      }
      errosLogin.delete(chave)

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

              if (usuario.acesso === 'admin') {
                return res.redirect('/admin')
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

        // Envia sem esperar a resposta do EmailJS: assim a tela demora o mesmo tempo
        // com ou sem conta cadastrada (pelo tempo não dá para descobrir quem tem conta)
        enviarCodigoRedefinicao(email, usuario.nome_usuario, codigo)
          .catch(erroEmail => console.log(erroEmail.message)) // a falha fica no terminal
        res.redirect('/esqueci-senha')
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

  // Primeiro GASTA uma tentativa, num único comando. Se várias requisições chegarem ao mesmo
  // tempo, o banco conta uma por uma: ninguém consegue testar mais de 5 códigos.
  const sqlTentativa = `UPDATE redefinicao_senha SET tentativas = tentativas + 1
    WHERE usuario_id = ? AND tentativas < ? AND expira_em > NOW()`
  conexao.query(sqlTentativa, [processo.usuarioId, MAX_TENTATIVAS], (erro, resultado) => {
    if (erro) {
      console.log(erro)
      return telaRedefinicao(res, 'codigo', { erro: 'Não foi possível continuar. Tente novamente.' })
    }

    // Nenhuma linha alterada: não existe código, expirou ou acabaram as tentativas
    if (resultado.affectedRows === 0) {
      return telaRedefinicao(res, 'codigo', { erro: mensagemInvalido + ' Peça um novo código.' })
    }

    conexao.query('SELECT codigo_hash FROM redefinicao_senha WHERE usuario_id = ?', [processo.usuarioId], (erro2, linhas) => {
      if (erro2) {
        console.log(erro2)
        return telaRedefinicao(res, 'codigo', { erro: 'Não foi possível continuar. Tente novamente.' })
      }
      if (!linhas.length || linhas[0].codigo_hash !== hashCodigo(codigo)) {
        return telaRedefinicao(res, 'codigo', { erro: mensagemInvalido })
      }

      // Acertou: libera a etapa da nova senha
      processo.autorizado = true
      res.redirect('/esqueci-senha')
    })
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
