import express from 'express';
import { crearRutasContactos } from './routes/contactos.js';
import { crearAlmacenContactos } from './services/contactos.js';

export function crearApp(archivoContactos) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.get('/', (req, res) => {
    res.json({ mensaje: 'Servicio de agenda en preparación.' });
  });

  app.use('/contactos', crearRutasContactos(crearAlmacenContactos(archivoContactos)));

  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' });
  });

  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'El cuerpo debe contener JSON válido.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'El cuerpo supera el límite de 10 KB.' });
    }
    console.error('Error del servicio:', error.message);
    res.status(500).json({ error: 'No se pudo acceder al archivo de contactos.' });
  });

  return app;
}

export default crearApp();
