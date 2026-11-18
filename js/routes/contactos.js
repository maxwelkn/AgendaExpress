import { Router } from 'express';

export function crearRutasContactos(almacen) {
  const rutas = Router();

  rutas.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await almacen.listar());
  });

  rutas.post('/', async (req, res) => {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Envía el contacto como application/json.' });
    }

    const datos = req.body;
    const limites = { nombre: 100, apellido: 100, telefono: 30 };
    const contacto = {};

    for (const [campo, limite] of Object.entries(limites)) {
      if (typeof datos?.[campo] !== 'string' || !datos[campo].trim()) {
        return res.status(400).json({ error: `El campo ${campo} es obligatorio y debe ser texto.` });
      }
      contacto[campo] = datos[campo].trim();
      if (contacto[campo].length > limite) {
        return res.status(400).json({ error: `El campo ${campo} admite hasta ${limite} caracteres.` });
      }
    }

    const guardado = await almacen.guardar(contacto);
    res.status(201).json(guardado);
  });

  return rutas;
}
