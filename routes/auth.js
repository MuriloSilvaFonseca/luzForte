const express = require('express')
const bcrypt = require('bcryptjs')
const conexao = require('../config/database')
const router = express.Router()

router.get('/registro', (req, res) => {
  res.render('auth/registro')
})


// ROTA POST PARA CADASTRO DE USUÁRIO
router.post('/registro', (req, res) => {
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
  res.render('auth/login')
})

router.post('/login', (req, res) => {
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

router.get('/esqueci-senha', (req, res) => {
  res.render('auth/esqueci-senha')
})



module.exports = router
