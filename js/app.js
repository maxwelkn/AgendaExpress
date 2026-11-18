import express from 'express';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

app.get('/', (req, res) => {
  res.json({ mensaje: 'Servicio de agenda en preparación.' });
});

export default app;
