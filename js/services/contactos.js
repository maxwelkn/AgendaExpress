import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const archivoPredeterminado = new URL('../../data/contactos.json', import.meta.url);

export function crearAlmacenContactos(archivo = archivoPredeterminado) {
  const ruta = archivo instanceof URL ? fileURLToPath(archivo) : archivo;
  // Las escrituras se atienden en orden para no perder contactos simultáneos.
  let escrituraPendiente = Promise.resolve();

  async function leerArchivo() {
    let contenido;
    try {
      contenido = await readFile(ruta, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }

    const contactos = JSON.parse(contenido);
    const campos = ['nombre', 'apellido', 'telefono'];
    if (!Array.isArray(contactos) || !contactos.every((contacto) =>
      contacto && campos.every((campo) =>
        typeof contacto[campo] === 'string' && contacto[campo].trim()))) {
      throw new Error('El archivo de contactos tiene un formato incorrecto.');
    }
    return contactos;
  }

  async function listar() {
    await escrituraPendiente;
    return leerArchivo();
  }

  function guardar(contacto) {
    const operacion = escrituraPendiente.then(async () => {
      const contactos = await leerArchivo();
      contactos.push(contacto);
      // Se reemplaza el archivo solo después de escribir el JSON completo.
      const temporal = `${ruta}.tmp`;
      await mkdir(dirname(ruta), { recursive: true });
      await writeFile(temporal, `${JSON.stringify(contactos, null, 2)}\n`, 'utf8');
      await rename(temporal, ruta);
      return contacto;
    });
    // Un fallo se devuelve al cliente, pero no bloquea los próximos intentos.
    escrituraPendiente = operacion.catch(() => {});
    return operacion;
  }

  return { listar, guardar };
}
