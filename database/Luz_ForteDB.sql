CREATE DATABASE  IF NOT EXISTS `luz_forte` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `luz_forte`;
-- Arquivo canônico do banco: schema, alterações antes espalhadas em migrações
-- e dados de demonstração. Para uma instalação nova, execute somente este SQL.
-- ATENÇÃO: recria as tabelas e substitui os dados existentes.
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `avaliacao_produto`
--

LOCK TABLES `avaliacao_produto` WRITE;
/*!40000 ALTER TABLE `avaliacao_produto` DISABLE KEYS */;
INSERT INTO `avaliacao_produto` VALUES (1,5,'Gostei da iluminação.','pendente',NULL,NULL,NULL,'2026-08-12 13:00:00',1001,2),(2,4,'Bom acabamento.','pendente',NULL,NULL,NULL,'2026-08-13 13:00:00',1008,2),(3,5,'Atendeu ao que eu precisava.','pendente',NULL,NULL,NULL,'2026-08-20 13:00:00',1004,3),(4,3,'Produto razoável.','pendente',NULL,NULL,NULL,'2026-08-21 13:00:00',1006,3),(5,4,'Fácil de usar.','pendente',NULL,NULL,NULL,'2026-09-07 13:00:00',1010,2),(6,5,'Boa compra.','pendente',NULL,NULL,NULL,'2026-09-22 13:00:00',1002,5),(7,2,'Não gostei do acabamento.','pendente',NULL,NULL,NULL,'2026-09-23 13:00:00',1009,5);
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categoria`
--

LOCK TABLES `categoria` WRITE;
/*!40000 ALTER TABLE `categoria` DISABLE KEYS */;
INSERT INTO `categoria` VALUES (5,'Ferramentas'),(2,'Fios e cabos'),(1,'Iluminação'),(3,'Proteção elétrica'),(4,'Tomadas e interruptores');
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
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `descricao`
--

LOCK TABLES `descricao` WRITE;
/*!40000 ALTER TABLE `descricao` DISABLE KEYS */;
INSERT INTO `descricao` VALUES (1,'Descrição','Produto fictício para consultas: Lâmpada LED 9W branca.',1001),(2,'Descrição','Produto fictício para consultas: Lâmpada LED 12W neutra.',1002),(3,'Descrição','Produto fictício para consultas: Painel LED 18W de sobrepor.',1003),(4,'Descrição','Produto fictício para consultas: Cabo flexível 2,5 mm² azul - metro.',1004),(5,'Descrição','Produto fictício para consultas: Cabo flexível 4 mm² preto - metro.',1005),(6,'Descrição','Produto fictício para consultas: Disjuntor monopolar 20A.',1006),(7,'Descrição','Produto fictício para consultas: Disjuntor bipolar 32A.',1007),(8,'Descrição','Produto fictício para consultas: Tomada 10A branca.',1008),(9,'Descrição','Produto fictício para consultas: Tomada 20A branca.',1009),(10,'Descrição','Produto fictício para consultas: Interruptor simples branco.',1010),(11,'Descrição','Produto fictício para consultas: Alicate universal 8 polegadas.',1011),(12,'Descrição','Produto fictício para consultas: Chave de fenda 1/4.',1012),(13,'Conteúdo da embalagem','Uma unidade. Imagem ilustrativa.',1001);
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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `especificacao`
--

LOCK TABLES `especificacao` WRITE;
/*!40000 ALTER TABLE `especificacao` DISABLE KEYS */;
INSERT INTO `especificacao` VALUES (1,'Potência','9 W',1001),(2,'Cor da luz','Branca',1001),(3,'Potência','12 W',1002),(4,'Potência','18 W',1003),(5,'Seção nominal','2,5 mm²',1004),(6,'Unidade de venda','Metro',1004),(7,'Seção nominal','4 mm²',1005),(8,'Corrente nominal','20 A',1006),(9,'Corrente nominal','32 A',1007),(10,'Corrente nominal','10 A',1008),(11,'Corrente nominal','20 A',1009),(12,'Cor','Branca',1010);
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `forma_pagamento`
--

LOCK TABLES `forma_pagamento` WRITE;
/*!40000 ALTER TABLE `forma_pagamento` DISABLE KEYS */;
INSERT INTO `forma_pagamento` VALUES (1,'Pix','sim'),(2,'Cartão de crédito','sim'),(3,'Dinheiro','sim'),(4,'Cartão débito','sim');
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
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `imagem_produto`
--

LOCK TABLES `imagem_produto` WRITE;
/*!40000 ALTER TABLE `imagem_produto` DISABLE KEYS */;
INSERT INTO `imagem_produto` VALUES (1,1,'/img/products/produto-1001.jpg',1001),(2,1,'/img/products/produto-1002.jpg',1002),(3,1,'/img/products/produto-1003.jpg',1003),(4,1,'/img/products/produto-1004.jpg',1004),(5,1,'/img/products/produto-1005.jpg',1005),(6,1,'/img/products/produto-1006.jpg',1006),(7,1,'/img/products/produto-1007.jpg',1007),(8,1,'/img/products/produto-1008.jpg',1008),(9,1,'/img/products/produto-1009.jpg',1009),(10,1,'/img/products/produto-1010.jpg',1010),(11,2,'/img/products/produto-1001-detalhe.jpg',1001);
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `instalacao`
--

LOCK TABLES `instalacao` WRITE;
/*!40000 ALTER TABLE `instalacao` DISABLE KEYS */;
INSERT INTO `instalacao` VALUES (1,'Manual','Consulte o manual do fabricante antes do uso.',1001),(2,'Instalação','Instalação por profissional qualificado conforme manual.',1003),(3,'Instalação','Dimensionamento e instalação por profissional qualificado.',1006),(4,'Instalação','Instalação por profissional qualificado conforme manual.',1008);
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `marca`
--

LOCK TABLES `marca` WRITE;
/*!40000 ALTER TABLE `marca` DISABLE KEYS */;
INSERT INTO `marca` VALUES (1,'Clareia'),(4,'Conecta'),(2,'FioSul'),(6,'Marca sem produtos'),(5,'Oficina'),(3,'Protec');
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
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pedido`
--

LOCK TABLES `pedido` WRITE;
/*!40000 ALTER TABLE `pedido` DISABLE KEYS */;
INSERT INTO `pedido` (`id_pedido`, `valor_produtos`, `total`, `observacoes`, `status`, `data_criacao`, `usuario_id`, `forma_pagamento_id`, `visitante_token_hash`) VALUES (1,77.40,77.40,'Retirado na loja.','finalizado','2026-08-10 12:30:00',2,1,NULL),(2,149.00,149.00,NULL,'finalizado','2026-08-18 17:00:00',3,2,NULL),(3,94.40,94.40,NULL,'finalizado','2026-09-05 14:10:00',2,3,NULL),(4,113.00,113.00,'Cliente desistiu antes da confirmação.','cancelado','2026-09-12 19:20:00',4,1,NULL),(5,128.30,128.30,NULL,'finalizado','2026-09-20 13:00:00',5,2,NULL),(6,122.70,122.70,'Confirmado; aguardando retirada.','aprovado','2026-10-10 11:45:00',3,1,NULL),(7,37.30,37.30,'Aguardar confirmação da loja.','solicitado','2026-10-11 18:00:00',6,3,NULL),(8,119.50,119.50,NULL,'solicitado','2026-10-12 12:15:00',4,1,NULL),(9,54.90,54.90,'Confirmado; aguardando retirada.','aprovado','2026-10-13 16:30:00',2,2,NULL),(10,119.80,119.80,'Pedido cancelado antes da confirmação.','cancelado','2026-10-13 20:00:00',5,3,NULL);
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
  UNIQUE KEY `uq_produto_gtin_ean` (`GTIN_EAN`),
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
INSERT INTO `produto` VALUES (1001,'Lâmpada LED 9W branca',50,12.90,7.00,'ativo',NULL,1,1),(1002,'Lâmpada LED 12W neutra',24,18.50,10.00,'ativo',NULL,1,1),(1003,'Painel LED 18W de sobrepor',8,59.90,35.00,'ativo',NULL,1,2),(1004,'Cabo flexível 2,5 mm² azul - metro',150,3.90,2.20,'ativo',NULL,2,3),(1005,'Cabo flexível 4 mm² preto - metro',80,6.50,3.80,'ativo',NULL,2,3),(1006,'Disjuntor monopolar 20A',15,22.00,13.00,'ativo',NULL,3,4),(1007,'Disjuntor bipolar 32A',0,48.00,29.00,'ativo',NULL,3,4),(1008,'Tomada 10A branca',35,14.90,8.00,'ativo',NULL,4,5),(1009,'Tomada 20A branca',18,17.90,10.00,'ativo',NULL,4,5),(1010,'Interruptor simples branco',22,11.50,6.00,'ativo',NULL,4,6),(1011,'Alicate universal 8 polegadas',4,39.90,24.00,'oculto',NULL,5,7),(1012,'Chave de fenda 1/4',0,16.90,9.50,'desativado',NULL,5,7);
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
  CONSTRAINT `chk_produto_pedido_custo` CHECK (((`custo_unitario` is null) or (`custo_unitario` >= 0))),
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
INSERT INTO `produto_pedido` VALUES (1001,1,47.60,11.90,4,6.50),(1008,1,29.80,14.90,2,8.00),(1004,2,105.00,3.50,30,2.00),(1006,2,44.00,22.00,2,13.00),(1003,3,59.90,59.90,1,35.00),(1010,3,34.50,11.50,3,6.00),(1005,4,65.00,6.50,10,3.80),(1007,4,48.00,48.00,1,29.00),(1002,5,92.50,18.50,5,10.00),(1009,5,35.80,17.90,2,10.00),(1004,6,78.00,3.90,20,2.20),(1008,6,44.70,14.90,3,8.00),(1001,7,25.80,12.90,2,7.00),(1010,7,11.50,11.50,1,6.00),(1005,8,97.50,6.50,15,3.80),(1006,8,22.00,22.00,1,13.00),(1002,9,37.00,18.50,2,10.00),(1009,9,17.90,17.90,1,10.00),(1003,10,119.80,59.90,2,35.00);
/*!40000 ALTER TABLE `produto_pedido` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `redefinicao_senha`
--

LOCK TABLES `redefinicao_senha` WRITE;
/*!40000 ALTER TABLE `redefinicao_senha` DISABLE KEYS */;
/*!40000 ALTER TABLE `redefinicao_senha` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subcategoria`
--

LOCK TABLES `subcategoria` WRITE;
/*!40000 ALTER TABLE `subcategoria` DISABLE KEYS */;
INSERT INTO `subcategoria` VALUES (1,'Lâmpadas LED',1),(2,'Luminárias',1),(8,'Refletores',1),(3,'Cabos flexíveis',2),(4,'Disjuntores',3),(6,'Interruptores',4),(5,'Tomadas',4),(7,'Ferramentas manuais',5);
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario`
--

LOCK TABLES `usuario` WRITE;
/*!40000 ALTER TABLE `usuario` DISABLE KEYS */;
INSERT INTO `usuario` VALUES (1,'Administrador Teste','!LOGIN_DESABILITADO_SEED!','2026-08-01 13:00:00','usuario1@example.com','admin','19000000001'),(2,'Ana Oliveira','!LOGIN_DESABILITADO_SEED!','2026-08-02 13:00:00','usuario2@example.com','cliente','19000000002'),(3,'Bruno Santos','!LOGIN_DESABILITADO_SEED!','2026-08-03 13:00:00','usuario3@example.com','cliente','19000000003'),(4,'Carla Almeida','!LOGIN_DESABILITADO_SEED!','2026-08-04 13:00:00','usuario4@example.com','cliente','19000000004'),(5,'Diego Costa','!LOGIN_DESABILITADO_SEED!','2026-08-05 13:00:00','usuario5@example.com','cliente','19000000005'),(6,'Elisa Pereira','!LOGIN_DESABILITADO_SEED!','2026-08-06 13:00:00','usuario6@example.com','cliente','19000000006'),(7,'Felipe Rocha','!LOGIN_DESABILITADO_SEED!','2026-08-07 13:00:00','usuario7@example.com','cliente','19000000007'),(8,'Gabriela Lima','!LOGIN_DESABILITADO_SEED!','2026-08-08 13:00:00','usuario8@example.com','cliente','19000000008');
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

-- Dump completed on 2026-10-19 22:02:58
