-- LuzForte: ESTRUTURA do banco (MySQL 8). Não contém dados.
-- Cria o banco luz_forte e todas as tabelas usadas pela aplicação.
-- ATENÇÃO: apaga e recria as tabelas (DROP TABLE). Use só em instalação nova
-- ou num banco de testes cujos dados podem ser perdidos.
-- Depois de rodar este arquivo, rode database/queriesInsertMYSQL_local.sql
-- para inserir os dados de demonstração.

CREATE DATABASE  IF NOT EXISTS `luz_forte` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `luz_forte`;
-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: luz_forte
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Tabelas da biblioteca de textos (criadas no fim do arquivo)
DROP TABLE IF EXISTS `produto_modelo_texto`;
DROP TABLE IF EXISTS `modelo_texto`;

--
-- Table structure for table `avaliacao_produto`
--

DROP TABLE IF EXISTS `avaliacao_produto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `avaliacao_produto` (
  `id_avaliacao_produto` int NOT NULL AUTO_INCREMENT,
  `nota` int NOT NULL,
  `comentario` text,
  `status` enum('pendente','aprovada','rejeitada') NOT NULL DEFAULT 'pendente',
  `motivo_rejeicao` varchar(100) DEFAULT NULL,
  `resposta` text,
  `data_resposta` timestamp NULL DEFAULT NULL,
  `data_criacao` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `produto_sku` int NOT NULL,
  `usuario_id` int NOT NULL,
  PRIMARY KEY (`id_avaliacao_produto`),
  UNIQUE KEY `uq_avaliacao_usuario_produto` (`usuario_id`,`produto_sku`),
  KEY `fk_avaliacao_produto` (`produto_sku`),
  KEY `idx_avaliacao_status` (`status`,`data_criacao`),
  CONSTRAINT `fk_avaliacao_produto` FOREIGN KEY (`produto_sku`) REFERENCES `produto` (`sku`) ON DELETE CASCADE,
  CONSTRAINT `fk_avaliacao_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE,
  CONSTRAINT `chk_avaliacao_motivo` CHECK (((`motivo_rejeicao` is null) or (`status` = _utf8mb4'rejeitada'))),
  CONSTRAINT `chk_avaliacao_nota` CHECK ((`nota` between 1 and 5)),
  CONSTRAINT `chk_avaliacao_resposta` CHECK (((`data_resposta` is null) or (`resposta` is not null)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `categoria`
--

DROP TABLE IF EXISTS `categoria`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categoria` (
  `id_categoria` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(70) NOT NULL,
  PRIMARY KEY (`id_categoria`),
  UNIQUE KEY `uq_categoria_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `descricao`
--

DROP TABLE IF EXISTS `descricao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `descricao` (
  `id_descricao` int NOT NULL AUTO_INCREMENT,
  `nome_descricao` varchar(70) NOT NULL,
  `texto_descricao` text NOT NULL,
  `produto_sku` int NOT NULL,
  PRIMARY KEY (`id_descricao`),
  KEY `fk_descricao_produto` (`produto_sku`),
  CONSTRAINT `fk_descricao_produto` FOREIGN KEY (`produto_sku`) REFERENCES `produto` (`sku`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `especificacao`
--

DROP TABLE IF EXISTS `especificacao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `especificacao` (
  `id_especificacao` int NOT NULL AUTO_INCREMENT,
  `nome_especificacao` varchar(70) NOT NULL,
  `texto_especificacao` text NOT NULL,
  `produto_sku` int NOT NULL,
  PRIMARY KEY (`id_especificacao`),
  KEY `fk_especificacao_produto` (`produto_sku`),
  CONSTRAINT `fk_especificacao_produto` FOREIGN KEY (`produto_sku`) REFERENCES `produto` (`sku`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `forma_pagamento`
--

DROP TABLE IF EXISTS `forma_pagamento`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `forma_pagamento` (
  `id_forma_pagamento` int NOT NULL AUTO_INCREMENT,
  `nome_pagamento` varchar(80) NOT NULL,
  `ativo` enum('sim','nao') NOT NULL DEFAULT 'sim',
  PRIMARY KEY (`id_forma_pagamento`),
  UNIQUE KEY `uq_forma_pagamento_nome` (`nome_pagamento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `imagem_produto`
--

DROP TABLE IF EXISTS `imagem_produto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `imagem_produto` (
  `id_imagem_produto` int NOT NULL AUTO_INCREMENT,
  `ordem` int NOT NULL DEFAULT '1',
  `url` varchar(500) NOT NULL,
  `produto_sku` int NOT NULL,
  PRIMARY KEY (`id_imagem_produto`),
  UNIQUE KEY `uq_imagem_produto_ordem` (`produto_sku`,`ordem`),
  CONSTRAINT `fk_imagem_produto_produto` FOREIGN KEY (`produto_sku`) REFERENCES `produto` (`sku`) ON DELETE CASCADE,
  CONSTRAINT `chk_imagem_ordem` CHECK ((`ordem` >= 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `instalacao`
--

DROP TABLE IF EXISTS `instalacao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `instalacao` (
  `id_instalacao` int NOT NULL AUTO_INCREMENT,
  `nome_instalacao` varchar(70) NOT NULL,
  `texto_instalacao` text NOT NULL,
  `produto_sku` int NOT NULL,
  PRIMARY KEY (`id_instalacao`),
  KEY `fk_instalacao_produto` (`produto_sku`),
  CONSTRAINT `fk_instalacao_produto` FOREIGN KEY (`produto_sku`) REFERENCES `produto` (`sku`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `marca`
--

DROP TABLE IF EXISTS `marca`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `marca` (
  `id_marca` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(50) NOT NULL,
  PRIMARY KEY (`id_marca`),
  UNIQUE KEY `uq_marca_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pedido`
--

DROP TABLE IF EXISTS `pedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pedido` (
  `id_pedido` int NOT NULL AUTO_INCREMENT,
  `valor_produtos` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `observacoes` text,
  `status` enum('carrinho','solicitado','aprovado','finalizado','cancelado') NOT NULL,
  `data_criacao` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `usuario_id` int DEFAULT NULL,
  `forma_pagamento_id` int DEFAULT NULL,
  `visitante_token_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `carrinho_usuario_id` int GENERATED ALWAYS AS ((case when (`status` = _utf8mb4'carrinho') then `usuario_id` else NULL end)) VIRTUAL,
  PRIMARY KEY (`id_pedido`),
  UNIQUE KEY `uq_pedido_visitante_token_hash` (`visitante_token_hash`),
  UNIQUE KEY `uq_pedido_carrinho_usuario` (`carrinho_usuario_id`),
  KEY `fk_pedido_usuario` (`usuario_id`),
  KEY `fk_pedido_forma_pagamento` (`forma_pagamento_id`),
  KEY `idx_pedido_status_data` (`status`,`data_criacao`),
  CONSTRAINT `fk_pedido_forma_pagamento` FOREIGN KEY (`forma_pagamento_id`) REFERENCES `forma_pagamento` (`id_forma_pagamento`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pedido_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`) ON DELETE RESTRICT,
  CONSTRAINT `chk_pedido_proprietario` CHECK ((((`usuario_id` is not null) and (`visitante_token_hash` is null)) or ((`usuario_id` is null) and (`visitante_token_hash` is not null) and (`status` = _utf8mb4'carrinho')))),
  CONSTRAINT `chk_pedido_total` CHECK ((`total` >= 0)),
  CONSTRAINT `chk_pedido_valor_produtos` CHECK ((`valor_produtos` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `produto`
--

DROP TABLE IF EXISTS `produto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produto` (
  `sku` int NOT NULL,
  `titulo_produto` varchar(70) NOT NULL,
  `estoque_produto` int NOT NULL DEFAULT '0',
  `preco_produto` decimal(10,2) NOT NULL,
  `custo_produto` decimal(10,2) NOT NULL DEFAULT '0.00',
  `ativo` enum('ativo','desativado','oculto') NOT NULL DEFAULT 'ativo',
  `GTIN_EAN` char(14) DEFAULT NULL,
  `marca_id` int NOT NULL,
  `categoria_id` int NOT NULL,
  `subcategoria_id` int DEFAULT NULL,
  PRIMARY KEY (`sku`),
  UNIQUE KEY `uq_produto_gtin_ean` (`GTIN_EAN`),
  KEY `fk_produto_marca` (`marca_id`),
  KEY `fk_produto_categoria` (`categoria_id`),
  KEY `fk_produto_subcategoria` (`subcategoria_id`),
  CONSTRAINT `fk_produto_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categoria` (`id_categoria`) ON DELETE RESTRICT,
  CONSTRAINT `fk_produto_marca` FOREIGN KEY (`marca_id`) REFERENCES `marca` (`id_marca`) ON DELETE RESTRICT,
  CONSTRAINT `fk_produto_subcategoria` FOREIGN KEY (`subcategoria_id`) REFERENCES `subcategoria` (`id_subcategoria`) ON DELETE RESTRICT,
  CONSTRAINT `chk_produto_custo` CHECK ((`custo_produto` >= 0)),
  CONSTRAINT `chk_produto_estoque` CHECK ((`estoque_produto` >= 0)),
  CONSTRAINT `chk_produto_preco` CHECK ((`preco_produto` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `produto_pedido`
--

DROP TABLE IF EXISTS `produto_pedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produto_pedido` (
  `produto_sku` int NOT NULL,
  `pedido_id` int NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `preco_unitario` decimal(10,2) NOT NULL,
  `quantidade` int NOT NULL DEFAULT '1',
  `custo_unitario` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`pedido_id`,`produto_sku`),
  KEY `fk_produto_pedido_produto` (`produto_sku`),
  CONSTRAINT `fk_produto_pedido_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedido` (`id_pedido`) ON DELETE CASCADE,
  CONSTRAINT `fk_produto_pedido_produto` FOREIGN KEY (`produto_sku`) REFERENCES `produto` (`sku`) ON DELETE RESTRICT,
  CONSTRAINT `chk_produto_pedido_custo` CHECK (((`custo_unitario` is null) or (`custo_unitario` >= 0))),
  CONSTRAINT `chk_produto_pedido_preco` CHECK ((`preco_unitario` >= 0)),
  CONSTRAINT `chk_produto_pedido_quantidade` CHECK ((`quantidade` > 0)),
  CONSTRAINT `chk_produto_pedido_subtotal_calc` CHECK ((`subtotal` = (`quantidade` * `preco_unitario`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `redefinicao_senha`
--

DROP TABLE IF EXISTS `redefinicao_senha`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `redefinicao_senha` (
  `id_redefinicao` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `codigo_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `expira_em` datetime NOT NULL,
  `tentativas` int NOT NULL DEFAULT '0',
  `enviado_em` datetime NOT NULL,
  PRIMARY KEY (`id_redefinicao`),
  UNIQUE KEY `uq_redefinicao_usuario` (`usuario_id`),
  CONSTRAINT `fk_redefinicao_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE,
  CONSTRAINT `chk_redefinicao_tentativas` CHECK ((`tentativas` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `subcategoria`
--

DROP TABLE IF EXISTS `subcategoria`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subcategoria` (
  `id_subcategoria` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(70) NOT NULL,
  `categoria_id` int NOT NULL,
  PRIMARY KEY (`id_subcategoria`),
  UNIQUE KEY `uq_subcategoria_categoria_nome` (`categoria_id`,`nome`),
  CONSTRAINT `fk_subcategoria_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categoria` (`id_categoria`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usuario`
--

DROP TABLE IF EXISTS `usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuario` (
  `id_usuario` int NOT NULL AUTO_INCREMENT,
  `nome_usuario` varchar(200) NOT NULL,
  `senha` varchar(255) NOT NULL,
  `data_criacao` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `email` varchar(255) NOT NULL,
  `acesso` enum('admin','cliente') NOT NULL DEFAULT 'cliente',
  `telefone` varchar(20) NOT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `uq_usuario_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Biblioteca de textos reutilizáveis (descrição, especificação, instalação)
CREATE TABLE modelo_texto (
  id_modelo_texto INT NOT NULL AUTO_INCREMENT,
  tipo ENUM('descricao', 'especificacao', 'instalacao') NOT NULL,
  nome VARCHAR(70) NOT NULL,
  texto TEXT NOT NULL,
  assinatura BINARY(32) GENERATED ALWAYS AS (UNHEX(SHA2(CONCAT(TRIM(nome), CHAR(0), TRIM(REPLACE(REPLACE(texto, CHAR(13,10), CHAR(10)), CHAR(13), CHAR(10)))), 256))) STORED,
  UNIQUE KEY uq_modelo_tipo_conteudo (tipo, assinatura),
  PRIMARY KEY (id_modelo_texto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE produto_modelo_texto (
  produto_sku INT NOT NULL,
  modelo_texto_id INT NOT NULL,
  PRIMARY KEY (produto_sku, modelo_texto_id),
  CONSTRAINT fk_produto_modelo_produto FOREIGN KEY (produto_sku)
    REFERENCES produto (sku) ON DELETE CASCADE,
  CONSTRAINT fk_produto_modelo_texto FOREIGN KEY (modelo_texto_id)
    REFERENCES modelo_texto (id_modelo_texto) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
