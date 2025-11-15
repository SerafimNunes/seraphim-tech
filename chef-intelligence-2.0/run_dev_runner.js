// Runner para capturar erros de inicialização do projeto
try {
  require("ts-node").register({ transpileOnly: true });
  require("dotenv").config();
  require("./src/index.ts");
} catch (err) {
  console.error(
    "FALHA AO IMPORTAR src/index.ts:",
    err && err.stack ? err.stack : err
  );
  process.exit(1);
}
