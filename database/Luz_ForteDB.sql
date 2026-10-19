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
  `data_criacao` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `produto_sku` int NOT NULL,
  `usuario_id` int NOT NULL,
  PRIMARY KEY (`id_avaliacao_produto`),
  UNIQUE KEY `uq_avaliacao_usuario_produto` (`usuario_id`,`produto_sku`),
  KEY `fk_avaliacao_produto` (`produto_sku`),
  CONSTRAINT `fk_avaliacao_produto` FOREIGN KEY (`produto_sku`) REFERENCES `produto` (`sku`) ON DELETE CASCADE,
  CONSTRAINT `fk_avaliacao_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE,
  CONSTRAINT `chk_avaliacao_nota` CHECK ((`nota` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `avaliacao_produto`
--

LOCK TABLES `avaliacao_produto` WRITE;
/*!40000 ALTER TABLE `avaliacao_produto` DISABLE KEYS */;
/*!40000 ALTER TABLE `avaliacao_produto` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `categoria`
--

LOCK TABLES `categoria` WRITE;
/*!40000 ALTER TABLE `categoria` DISABLE KEYS */;
/*!40000 ALTER TABLE `categoria` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `descricao`
--

LOCK TABLES `descricao` WRITE;
/*!40000 ALTER TABLE `descricao` DISABLE KEYS */;
/*!40000 ALTER TABLE `descricao` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `especificacao`
--

LOCK TABLES `especificacao` WRITE;
/*!40000 ALTER TABLE `especificacao` DISABLE KEYS */;
/*!40000 ALTER TABLE `especificacao` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `forma_pagamento`
--

LOCK TABLES `forma_pagamento` WRITE;
/*!40000 ALTER TABLE `forma_pagamento` DISABLE KEYS */;
/*!40000 ALTER TABLE `forma_pagamento` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `imagem_produto`
--

LOCK TABLES `imagem_produto` WRITE;
/*!40000 ALTER TABLE `imagem_produto` DISABLE KEYS */;
/*!40000 ALTER TABLE `imagem_produto` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `instalacao`
--

LOCK TABLES `instalacao` WRITE;
/*!40000 ALTER TABLE `instalacao` DISABLE KEYS */;
/*!40000 ALTER TABLE `instalacao` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `marca`
--

LOCK TABLES `marca` WRITE;
/*!40000 ALTER TABLE `marca` DISABLE KEYS */;
/*!40000 ALTER TABLE `marca` ENABLE KEYS */;
UNLOCK TABLES;

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
  PRIMARY KEY (`id_pedido`),
  UNIQUE KEY `uq_pedido_visitante_token_hash` (`visitante_token_hash`),
  KEY `fk_pedido_usuario` (`usuario_id`),
  KEY `fk_pedido_forma_pagamento` (`forma_pagamento_id`),
  CONSTRAINT `fk_pedido_forma_pagamento` FOREIGN KEY (`forma_pagamento_id`) REFERENCES `forma_pagamento` (`id_forma_pagamento`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pedido_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`) ON DELETE RESTRICT,
  CONSTRAINT `chk_pedido_proprietario` CHECK ((((`usuario_id` is not null) and (`visitante_token_hash` is null)) or ((`usuario_id` is null) and (`visitante_token_hash` is not null) and (`status` = _utf8mb4'carrinho')))),
  CONSTRAINT `chk_pedido_total` CHECK ((`total` >= 0)),
  CONSTRAINT `chk_pedido_valor_produtos` CHECK ((`valor_produtos` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pedido`
--

LOCK TABLES `pedido` WRITE;
/*!40000 ALTER TABLE `pedido` DISABLE KEYS */;
/*!40000 ALTER TABLE `pedido` ENABLE KEYS */;
UNLOCK TABLES;

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
  `subcategoria_id` int NOT NULL,
  PRIMARY KEY (`sku`),
  UNIQUE KEY `GTIN_EAN` (`GTIN_EAN`),
  KEY `fk_produto_marca` (`marca_id`),
  KEY `fk_produto_subcategoria` (`subcategoria_id`),
  CONSTRAINT `fk_produto_marca` FOREIGN KEY (`marca_id`) REFERENCES `marca` (`id_marca`) ON DELETE RESTRICT,
  CONSTRAINT `fk_produto_subcategoria` FOREIGN KEY (`subcategoria_id`) REFERENCES `subcategoria` (`id_subcategoria`) ON DELETE RESTRICT,
  CONSTRAINT `chk_produto_custo` CHECK ((`custo_produto` >= 0)),
  CONSTRAINT `chk_produto_estoque` CHECK ((`estoque_produto` >= 0)),
  CONSTRAINT `chk_produto_preco` CHECK ((`preco_produto` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produto`
--

LOCK TABLES `produto` WRITE;
/*!40000 ALTER TABLE `produto` DISABLE KEYS */;
/*!40000 ALTER TABLE `produto` ENABLE KEYS */;
UNLOCK TABLES;

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
  CONSTRAINT `chk_produto_pedido_preco` CHECK ((`preco_unitario` >= 0)),
  CONSTRAINT `chk_produto_pedido_quantidade` CHECK ((`quantidade` > 0)),
  CONSTRAINT `chk_produto_pedido_subtotal_calc` CHECK ((`subtotal` = (`quantidade` * `preco_unitario`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produto_pedido`
--

LOCK TABLES `produto_pedido` WRITE;
/*!40000 ALTER TABLE `produto_pedido` DISABLE KEYS */;
/*!40000 ALTER TABLE `produto_pedido` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `subcategoria`
--

LOCK TABLES `subcategoria` WRITE;
/*!40000 ALTER TABLE `subcategoria` DISABLE KEYS */;
/*!40000 ALTER TABLE `subcategoria` ENABLE KEYS */;
UNLOCK TABLES;

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
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `uq_usuario_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario`
--

LOCK TABLES `usuario` WRITE;
/*!40000 ALTER TABLE `usuario` DISABLE KEYS */;
/*!40000 ALTER TABLE `usuario` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-13 22:13:06


-- Moderação de avaliações: acrescenta o que FALTA em avaliacao_produto.
-- A coluna `status` (pendente / aprovada / rejeitada) já existe no banco, então não é criada aqui.
-- No Workbench: abra este arquivo e execute TUDO (raio sem cursor, ou Ctrl+Shift+Enter).

USE luz_forte;

ALTER TABLE avaliacao_produto
  ADD COLUMN motivo_rejeicao VARCHAR(100) NULL,
  ADD COLUMN resposta TEXT NULL,
  ADD COLUMN data_resposta TIMESTAMP NULL;

-- Acelera a contagem de pendentes e o filtro por status do painel.
CREATE INDEX idx_avaliacao_status ON avaliacao_produto (status, data_criacao);

