const { AwsClient } = require('aws4fetch');
const crypto = require('crypto');

const bucket = 'luz-forte-assets';

const {
  AWS_ENDPOINT_URL_S3,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION
} = process.env;

const configuracao = [
  AWS_ENDPOINT_URL_S3,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION
];

if (configuracao.some((valor) => !valor)) {
  throw new Error(
    'As variáveis de ambiente do Neon Object Storage não foram configuradas.'
  );
}

const cliente = new AwsClient({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  service: 's3',
  region: AWS_REGION
});

function criarUrl(chave) {
  const endpoint = AWS_ENDPOINT_URL_S3.replace(/\/+$/, '');

  const partes = chave
    .split('/')
    .map((parte) => encodeURIComponent(parte));

  return `${endpoint}/${bucket}/${partes.join('/')}`;
}

async function enviarImagem(arquivo) {
  const extensoes = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif'
  };

  const extensao = extensoes[arquivo.mimetype];

  if (!extensao) {
    throw new Error('Formato de imagem não permitido.');
  }

  const id = crypto.randomUUID();
  const chave = `produtos/${id}.${extensao}`;

  const resposta = await cliente.fetch(criarUrl(chave), {
    method: 'PUT',
    headers: {
      'Content-Type': arquivo.mimetype
    },
    body: arquivo.buffer
  });

  if (!resposta.ok) {
    throw new Error(
      `Falha ao enviar imagem ao Neon: HTTP ${resposta.status}`
    );
  }

  return {
    chave,
    url: criarUrl(chave)
  };
}

module.exports = {
  enviarImagem
};