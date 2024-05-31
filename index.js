const express = require('express');
const multer = require('multer');
const readline = require('readline');
const stream = require('stream');

// Configura o multer para armazenar arquivos em memória
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Inicializa o app Express
const app = express();

// Função para verificar o dígito 10 e chamar outra função se necessário
async function processFile(buffer, lineCallback, specificCallback) {
  const readStream = new stream.PassThrough();
  readStream.end(buffer);

  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  const adjustedLines = [];
  
  for await (const line of rl) {
    lineNumber++;
    let adjustedLine = lineCallback(line, lineNumber);
    if (line[9] === '3') { // Verifica se o décimo caractere é '3'
      adjustedLine = specificCallback(line, lineNumber);
    }
    adjustedLines.push(adjustedLine);
  }
  return adjustedLines;
}

// Função que calcula o CRC-16 Modbus e retorna a linha alterada
function calcularCRC16Modbus(input) {
  let crc = 0xFFFF;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) !== 0) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  }
  return input + crc.toString(16).toUpperCase().padStart(4, '0');
}

// Função que será chamada quando o dígito 10 for '3'
function handleSpecificLine(line, lineNumber) {
  return calcularCRC16Modbus(line);
}

// Função de callback para linha padrão
function defaultLineHandler(line, lineNumber) {
  return line;
}

// Endpoint para receber o upload do arquivo .txt
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nenhum arquivo enviado.');
  }

  // Função para contar e processar linhas
  processFile(
    req.file.buffer,
    defaultLineHandler,
    handleSpecificLine
  ).then(adjustedLines => {
    const adjustedFileBuffer = Buffer.from(adjustedLines.join('\n'));

    res.setHeader('Content-Disposition', 'attachment; filename=adjusted-file.txt');
    res.setHeader('Content-Type', 'text/plain');
    res.send(adjustedFileBuffer);
  }).catch(err => {
    console.error(err);
    res.status(500).send('Erro ao processar o arquivo.');
  });
});

// Inicia o servidor
const PORT = 10000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
