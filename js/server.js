import app from './app.js';

const puerto = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
  throw new Error('PORT debe ser un número entero entre 1 y 65535.');
}

const servidor = app.listen(puerto, () => {
  console.log(`Agenda Express disponible en http://localhost:${puerto}`);
});

servidor.on('error', (error) => {
  console.error(`No se pudo iniciar el servidor: ${error.message}`);
  process.exitCode = 1;
});
