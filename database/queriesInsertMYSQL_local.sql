-- LuzForte: dados fictícios para praticar consultas (MySQL 8).
-- Compatível com o schema completo de database/Luz_ForteDB.sql.
-- Execute APENAS em um banco de testes com as tabelas vazias já criadas.
-- Execute uma única vez: os IDs são fixos e uma repetição gera duplicidades.
-- Este arquivo não apaga dados nem altera a estrutura.
-- Se houver erro durante a execução, interrompa e execute ROLLBACK;
-- antes de tentar novamente. Não prossiga até o COMMIT após um erro.
-- ATENÇÃO: o dump original contém DROP TABLE e apaga dados ao ser executado.
-- Usuários usam um marcador inválido para login, NÃO uma senha real/hash bcrypt.
-- São apenas dados para SELECT; gere hashes com bcrypt na aplicação para login.
-- Caminhos de imagens são exemplos; os arquivos não estão incluídos.
-- Estoque representa o saldo atual, após as vendas já confirmadas.
-- Neste conjunto: solicitado = pendente; aprovado = confirmado;
-- finalizado = retirado. A definição definitiva desses status cabe à equipe.
-- Carrinho fica no navegador: não criamos pedidos no status carrinho.
USE luz_forte;
SET NAMES utf8mb4;
START TRANSACTION;

-- categoria
INSERT INTO categoria (id_categoria, nome) VALUES
(1, 'Iluminação'),
(2, 'Fios e cabos'),
(3, 'Proteção elétrica'),
(4, 'Tomadas e interruptores'),
(5, 'Ferramentas');

-- subcategoria
INSERT INTO subcategoria (id_subcategoria, nome, categoria_id) VALUES
(1, 'Lâmpadas LED', 1),
(2, 'Luminárias', 1),
(3, 'Cabos flexíveis', 2),
(4, 'Disjuntores', 3),
(5, 'Tomadas', 4),
(6, 'Interruptores', 4),
(7, 'Ferramentas manuais', 5),
(8, 'Refletores', 1);

-- marca
INSERT INTO marca (id_marca, nome) VALUES
(1, 'Clareia'),
(2, 'FioSul'),
(3, 'Protec'),
(4, 'Conecta'),
(5, 'Oficina'),
(6, 'Marca sem produtos');

-- forma_pagamento
INSERT INTO forma_pagamento (id_forma_pagamento, nome_pagamento, ativo) VALUES
(1, 'Pix', 'sim'),
(2, 'Cartão de crédito', 'sim'),
(3, 'Dinheiro', 'sim'),
(4, 'Cartão débito', 'sim');

-- usuario
INSERT INTO usuario (id_usuario, nome_usuario, senha, data_criacao, email, acesso, telefone) VALUES
(1, 'Administrador Teste', '!LOGIN_DESABILITADO_SEED!', '2026-08-01 10:00:00', 'usuario1@example.com', 'admin', '19000000001'),
(2, 'Ana Oliveira', '!LOGIN_DESABILITADO_SEED!', '2026-08-02 10:00:00', 'usuario2@example.com', 'cliente', '19000000002'),
(3, 'Bruno Santos', '!LOGIN_DESABILITADO_SEED!', '2026-08-03 10:00:00', 'usuario3@example.com', 'cliente', '19000000003'),
(4, 'Carla Almeida', '!LOGIN_DESABILITADO_SEED!', '2026-08-04 10:00:00', 'usuario4@example.com', 'cliente', '19000000004'),
(5, 'Diego Costa', '!LOGIN_DESABILITADO_SEED!', '2026-08-05 10:00:00', 'usuario5@example.com', 'cliente', '19000000005'),
(6, 'Elisa Pereira', '!LOGIN_DESABILITADO_SEED!', '2026-08-06 10:00:00', 'usuario6@example.com', 'cliente', '19000000006'),
(7, 'Felipe Rocha', '!LOGIN_DESABILITADO_SEED!', '2026-08-07 10:00:00', 'usuario7@example.com', 'cliente', '19000000007'),
(8, 'Gabriela Lima', '!LOGIN_DESABILITADO_SEED!', '2026-08-08 10:00:00', 'usuario8@example.com', 'cliente', '19000000008');

-- produto
INSERT INTO produto (sku, titulo_produto, estoque_produto, preco_produto, custo_produto, ativo, GTIN_EAN, marca_id, subcategoria_id) VALUES
(1001, 'Lâmpada LED 9W branca', 50, 12.90, 7.00, 'ativo', NULL, 1, 1),
(1002, 'Lâmpada LED 12W neutra', 24, 18.50, 10.00, 'ativo', NULL, 1, 1),
(1003, 'Painel LED 18W de sobrepor', 8, 59.90, 35.00, 'ativo', NULL, 1, 2),
(1004, 'Cabo flexível 2,5 mm² azul - metro', 150, 3.90, 2.20, 'ativo', NULL, 2, 3),
(1005, 'Cabo flexível 4 mm² preto - metro', 80, 6.50, 3.80, 'ativo', NULL, 2, 3),
(1006, 'Disjuntor monopolar 20A', 15, 22.00, 13.00, 'ativo', NULL, 3, 4),
(1007, 'Disjuntor bipolar 32A', 0, 48.00, 29.00, 'ativo', NULL, 3, 4),
(1008, 'Tomada 10A branca', 35, 14.90, 8.00, 'ativo', NULL, 4, 5),
(1009, 'Tomada 20A branca', 18, 17.90, 10.00, 'ativo', NULL, 4, 5),
(1010, 'Interruptor simples branco', 22, 11.50, 6.00, 'ativo', NULL, 4, 6),
(1011, 'Alicate universal 8 polegadas', 4, 39.90, 24.00, 'oculto', NULL, 5, 7),
(1012, 'Chave de fenda 1/4', 0, 16.90, 9.50, 'desativado', NULL, 5, 7);

-- descricao
INSERT INTO descricao (id_descricao, nome_descricao, texto_descricao, produto_sku) VALUES
(1, 'Descrição', 'Produto fictício para consultas: Lâmpada LED 9W branca.', 1001),
(2, 'Descrição', 'Produto fictício para consultas: Lâmpada LED 12W neutra.', 1002),
(3, 'Descrição', 'Produto fictício para consultas: Painel LED 18W de sobrepor.', 1003),
(4, 'Descrição', 'Produto fictício para consultas: Cabo flexível 2,5 mm² azul - metro.', 1004),
(5, 'Descrição', 'Produto fictício para consultas: Cabo flexível 4 mm² preto - metro.', 1005),
(6, 'Descrição', 'Produto fictício para consultas: Disjuntor monopolar 20A.', 1006),
(7, 'Descrição', 'Produto fictício para consultas: Disjuntor bipolar 32A.', 1007),
(8, 'Descrição', 'Produto fictício para consultas: Tomada 10A branca.', 1008),
(9, 'Descrição', 'Produto fictício para consultas: Tomada 20A branca.', 1009),
(10, 'Descrição', 'Produto fictício para consultas: Interruptor simples branco.', 1010),
(11, 'Descrição', 'Produto fictício para consultas: Alicate universal 8 polegadas.', 1011),
(12, 'Descrição', 'Produto fictício para consultas: Chave de fenda 1/4.', 1012),
(13, 'Conteúdo da embalagem', 'Uma unidade. Imagem ilustrativa.', 1001);

-- especificacao
INSERT INTO especificacao (id_especificacao, nome_especificacao, texto_especificacao, produto_sku) VALUES
(1, 'Potência', '9 W', 1001),
(2, 'Cor da luz', 'Branca', 1001),
(3, 'Potência', '12 W', 1002),
(4, 'Potência', '18 W', 1003),
(5, 'Seção nominal', '2,5 mm²', 1004),
(6, 'Unidade de venda', 'Metro', 1004),
(7, 'Seção nominal', '4 mm²', 1005),
(8, 'Corrente nominal', '20 A', 1006),
(9, 'Corrente nominal', '32 A', 1007),
(10, 'Corrente nominal', '10 A', 1008),
(11, 'Corrente nominal', '20 A', 1009),
(12, 'Cor', 'Branca', 1010);

-- imagem_produto
INSERT INTO imagem_produto (id_imagem_produto, ordem, url, produto_sku) VALUES
(1, 1, '/img/products/produto-1001.jpg', 1001),
(2, 1, '/img/products/produto-1002.jpg', 1002),
(3, 1, '/img/products/produto-1003.jpg', 1003),
(4, 1, '/img/products/produto-1004.jpg', 1004),
(5, 1, '/img/products/produto-1005.jpg', 1005),
(6, 1, '/img/products/produto-1006.jpg', 1006),
(7, 1, '/img/products/produto-1007.jpg', 1007),
(8, 1, '/img/products/produto-1008.jpg', 1008),
(9, 1, '/img/products/produto-1009.jpg', 1009),
(10, 1, '/img/products/produto-1010.jpg', 1010),
(11, 2, '/img/products/produto-1001-detalhe.jpg', 1001);

-- instalacao
INSERT INTO instalacao (id_instalacao, nome_instalacao, texto_instalacao, produto_sku) VALUES
(1, 'Manual', 'Consulte o manual do fabricante antes do uso.', 1001),
(2, 'Instalação', 'Instalação por profissional qualificado conforme manual.', 1003),
(3, 'Instalação', 'Dimensionamento e instalação por profissional qualificado.', 1006),
(4, 'Instalação', 'Instalação por profissional qualificado conforme manual.', 1008);

-- pedido
INSERT INTO pedido (id_pedido, valor_produtos, total, observacoes, status, data_criacao, usuario_id, forma_pagamento_id, visitante_token_hash) VALUES
(1, 77.40, 77.40, 'Retirado na loja.', 'finalizado', '2026-08-10 12:30:00', 2, 1, NULL),
(2, 149.00, 149.00, NULL, 'finalizado', '2026-08-18 17:00:00', 3, 2, NULL),
(3, 94.40, 94.40, NULL, 'finalizado', '2026-09-05 14:10:00', 2, 3, NULL),
(4, 113.00, 113.00, 'Cliente desistiu antes da confirmação.', 'cancelado', '2026-09-12 19:20:00', 4, 1, NULL),
(5, 128.30, 128.30, NULL, 'finalizado', '2026-09-20 13:00:00', 5, 2, NULL),
(6, 122.70, 122.70, 'Confirmado; aguardando retirada.', 'aprovado', '2026-10-10 11:45:00', 3, 1, NULL),
(7, 37.30, 37.30, 'Aguardar confirmação da loja.', 'solicitado', '2026-10-11 18:00:00', 6, 3, NULL),
(8, 119.50, 119.50, NULL, 'solicitado', '2026-10-12 12:15:00', 4, 1, NULL),
(9, 54.90, 54.90, 'Confirmado; aguardando retirada.', 'aprovado', '2026-10-13 16:30:00', 2, 2, NULL),
(10, 119.80, 119.80, 'Pedido cancelado antes da confirmação.', 'cancelado', '2026-10-13 20:00:00', 5, 3, NULL);

-- produto_pedido
INSERT INTO produto_pedido (produto_sku, pedido_id, subtotal, preco_unitario, quantidade, custo_unitario) VALUES
(1001, 1, 47.60, 11.90, 4, 6.50),
(1008, 1, 29.80, 14.90, 2, 8.00),
(1004, 2, 105.00, 3.50, 30, 2.00),
(1006, 2, 44.00, 22.00, 2, 13.00),
(1003, 3, 59.90, 59.90, 1, 35.00),
(1010, 3, 34.50, 11.50, 3, 6.00),
(1007, 4, 48.00, 48.00, 1, 29.00),
(1005, 4, 65.00, 6.50, 10, 3.80),
(1002, 5, 92.50, 18.50, 5, 10.00),
(1009, 5, 35.80, 17.90, 2, 10.00),
(1004, 6, 78.00, 3.90, 20, 2.20),
(1008, 6, 44.70, 14.90, 3, 8.00),
(1001, 7, 25.80, 12.90, 2, 7.00),
(1010, 7, 11.50, 11.50, 1, 6.00),
(1005, 8, 97.50, 6.50, 15, 3.80),
(1006, 8, 22.00, 22.00, 1, 13.00),
(1002, 9, 37.00, 18.50, 2, 10.00),
(1009, 9, 17.90, 17.90, 1, 10.00),
(1003, 10, 119.80, 59.90, 2, 35.00);

-- avaliacao_produto
INSERT INTO avaliacao_produto (id_avaliacao_produto, nota, comentario, status, motivo_rejeicao, resposta, data_resposta, data_criacao, produto_sku, usuario_id) VALUES
(1, 5, 'Gostei da iluminação.', 'pendente', NULL, NULL, NULL, '2026-08-12 13:00:00', 1001, 2),
(2, 4, 'Bom acabamento.', 'pendente', NULL, NULL, NULL, '2026-08-13 13:00:00', 1008, 2),
(3, 5, 'Atendeu ao que eu precisava.', 'pendente', NULL, NULL, NULL, '2026-08-20 13:00:00', 1004, 3),
(4, 3, 'Produto razoável.', 'pendente', NULL, NULL, NULL, '2026-08-21 13:00:00', 1006, 3),
(5, 4, 'Fácil de usar.', 'pendente', NULL, NULL, NULL, '2026-09-07 13:00:00', 1010, 2),
(6, 5, 'Boa compra.', 'pendente', NULL, NULL, NULL, '2026-09-22 13:00:00', 1002, 5),
(7, 2, 'Não gostei do acabamento.', 'pendente', NULL, NULL, NULL, '2026-09-23 13:00:00', 1009, 5);

COMMIT;

-- Conferência: esta consulta deve retornar ZERO linhas.
SELECT p.id_pedido, p.total, SUM(pp.subtotal) AS soma_itens
FROM pedido p
JOIN produto_pedido pp ON pp.pedido_id = p.id_pedido
GROUP BY p.id_pedido, p.total, p.valor_produtos
HAVING p.total <> SUM(pp.subtotal) OR p.valor_produtos <> SUM(pp.subtotal);
