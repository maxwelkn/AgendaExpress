import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { crearApp } from '../js/app.js';

let carpeta;
let archivo;
let servidor;
let url;

async function iniciarServidor() {
  servidor = crearApp(archivo).listen(0, '127.0.0.1');
  await new Promise((resolve) => servidor.once('listening', resolve));
  url = `http://127.0.0.1:${servidor.address().port}`;
}

function cerrarServidor() {
  return new Promise((resolve, reject) => {
    servidor.close((error) => error ? reject(error) : resolve());
  });
}

beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'agenda-express-'));
  archivo = join(carpeta, 'data', 'contactos.json');
  await iniciarServidor();
});

afterEach(async () => {
  await cerrarServidor();
  assert.equal(dirname(resolve(carpeta)), resolve(tmpdir()));
  assert.ok(basename(carpeta).startsWith('agenda-express-'));
  await rm(carpeta, { recursive: true, force: true });
});

const contacto = { nombre: 'Ana', apellido: 'Ejemplo', telefono: '000-000-0000' };

function enviar(datos) {
  return fetch(`${url}/contactos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
}

test('una agenda nueva devuelve una lista vacía sin crear el archivo', async () => {
  const respuesta = await fetch(`${url}/contactos`);
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await respuesta.json(), []);
  await assert.rejects(readFile(archivo), { code: 'ENOENT' });
});

test('guarda los tres campos, limpia espacios y persiste al reiniciar', async () => {
  const respuesta = await enviar({ ...contacto, nombre: '  Ana  ', extra: 'ignorar' });
  assert.equal(respuesta.status, 201);
  assert.deepEqual(await respuesta.json(), contacto);
  assert.deepEqual(JSON.parse(await readFile(archivo, 'utf8')), [contacto]);
  await cerrarServidor();
  await iniciarServidor();
  assert.deepEqual(await (await fetch(`${url}/contactos`)).json(), [contacto]);
});

test('rechaza campos ausentes, vacíos, tipos incorrectos y longitudes excesivas', async () => {
  const invalidos = [null, [], {}, { ...contacto, nombre: '   ' },
    { ...contacto, apellido: 123 }, { ...contacto, telefono: null },
    { ...contacto, nombre: 'a'.repeat(101) },
    { ...contacto, apellido: 'a'.repeat(101) },
    { ...contacto, telefono: '0'.repeat(31) }];
  for (const datos of invalidos) {
    const respuesta = await enviar(datos);
    assert.equal(respuesta.status, 400);
    assert.equal(typeof (await respuesta.json()).error, 'string');
  }
  assert.deepEqual(await (await fetch(`${url}/contactos`)).json(), []);
});

test('devuelve errores JSON para JSON roto, contenido no admitido y cuerpos grandes', async () => {
  for (const [body, tipo, estado] of [
    ['{"nombre":', 'application/json', 400],
    ['nombre=Ana', 'application/x-www-form-urlencoded', 415],
    [JSON.stringify({ nombre: 'a'.repeat(11000) }), 'application/json', 413],
  ]) {
    const respuesta = await fetch(`${url}/contactos`, {
      method: 'POST', headers: { 'Content-Type': tipo }, body,
    });
    assert.equal(respuesta.status, estado);
    assert.equal(typeof (await respuesta.json()).error, 'string');
  }
});

test('conserva todos los contactos enviados simultáneamente', async () => {
  const contactos = Array.from({ length: 12 }, (_, i) => ({ ...contacto, nombre: `Ejemplo ${i}` }));
  const respuestas = await Promise.all(contactos.map(enviar));
  assert.ok(respuestas.every((respuesta) => respuesta.status === 201));
  const guardados = await (await fetch(`${url}/contactos`)).json();
  assert.equal(guardados.length, contactos.length);
  assert.deepEqual(guardados.map((item) => item.nombre).sort(), contactos.map((item) => item.nombre).sort());
});

test('un archivo dañado produce 500, se conserva y permite recuperarse tras corregirlo', async () => {
  await enviar(contacto);
  for (const contenido of ['JSON dañado', '{}', '[{"nombre":42}]']) {
    await writeFile(archivo, contenido);
    const lectura = await fetch(`${url}/contactos`);
    assert.equal(lectura.status, 500);
    assert.equal(typeof (await lectura.json()).error, 'string');
    const escritura = await enviar(contacto);
    assert.equal(escritura.status, 500);
    assert.equal(await readFile(archivo, 'utf8'), contenido);
  }
  await writeFile(archivo, '[]');
  assert.equal((await enviar(contacto)).status, 201);
});

test('un fallo de escritura no confirma el contacto ni cambia la lista', async () => {
  await enviar(contacto);
  // Un directorio en la ruta temporal impide escribir de forma determinista.
  await mkdir(`${archivo}.tmp`);
  const respuesta = await enviar({ ...contacto, nombre: 'Otro' });
  assert.equal(respuesta.status, 500);
  assert.deepEqual(await (await fetch(`${url}/contactos`)).json(), [contacto]);
  await rmdir(`${archivo}.tmp`);
  assert.equal((await enviar({ ...contacto, nombre: 'Otro' })).status, 201);
});

test('rutas y operaciones no disponibles devuelven 404 en JSON', async () => {
  for (const [ruta, method] of [['/inexistente', 'GET'], ['/contactos', 'DELETE']]) {
    const respuesta = await fetch(`${url}${ruta}`, { method });
    assert.equal(respuesta.status, 404);
    assert.deepEqual(await respuesta.json(), { error: 'Ruta no encontrada.' });
  }
});
