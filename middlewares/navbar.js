const conexao = require('../config/database')

// O ranking considera produtos ativos, sem ocultar categorias vazias do menu completo.
const categoriasSql = `
  SELECT c.id_categoria, c.nome, COUNT(p.sku) AS produtos_ativos
  FROM categoria c
  LEFT JOIN subcategoria s ON s.categoria_id = c.id_categoria
  LEFT JOIN produto p ON p.subcategoria_id = s.id_subcategoria AND p.ativo = 'ativo'
  GROUP BY c.id_categoria, c.nome
  ORDER BY produtos_ativos DESC, c.nome ASC, c.id_categoria ASC
`
const subcategoriasSql = `
  SELECT id_subcategoria, nome, categoria_id
  FROM subcategoria
  ORDER BY nome ASC, id_subcategoria ASC
`

async function carregarNavbar(req, res, next) {
  res.locals.navbarCategorias = []
  res.locals.navbarPrincipais = []
  res.locals.navbarIndisponivel = false
  try {
    const banco = conexao.promise()
    const [categorias] = await banco.query({ sql: categoriasSql, timeout: 5000 })
    const [subcategorias] = await banco.query({ sql: subcategoriasSql, timeout: 5000 })
    const categoriasComSubcategorias = categorias.map(categoria => ({
      ...categoria,
      subcategorias: subcategorias.filter(sub => sub.categoria_id === categoria.id_categoria)
    }))
    res.locals.navbarPrincipais = categoriasComSubcategorias.slice(0, 5)
    res.locals.navbarCategorias = [...categoriasComSubcategorias].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR') || a.id_categoria - b.id_categoria)
  } catch (erro) {
    res.locals.navbarIndisponivel = true
    console.error('Falha ao carregar navbar:', erro.code || 'ERRO_BANCO')
  }
  next()
}

module.exports = carregarNavbar
