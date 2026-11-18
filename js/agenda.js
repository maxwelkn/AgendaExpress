const formulario = document.querySelector('#contact-form');
const guardar = document.querySelector('#save-button');
const actualizar = document.querySelector('#refresh-button');
const busqueda = document.querySelector('#search');
const lista = document.querySelector('#contact-list');
const contador = document.querySelector('#count');
const estadoLista = document.querySelector('#list-status');
const estadoFormulario = document.querySelector('#form-status');
let contactos = [];

function mostrarEstado(elemento, mensaje, estado = '') {
  elemento.textContent = mensaje;
  elemento.dataset.state = estado;
}

function mostrarContactos() {
  const consulta = busqueda.value.trim().toLocaleLowerCase('es');
  const visibles = contactos.filter((contacto) =>
    `${contacto.nombre} ${contacto.apellido} ${contacto.telefono}`.toLocaleLowerCase('es').includes(consulta));
  const fragmento = document.createDocumentFragment();

  for (const contacto of visibles) {
    const elemento = document.createElement('li');
    elemento.className = 'contact';
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = `${contacto.nombre[0]}${contacto.apellido[0]}`.toLocaleUpperCase('es');
    const informacion = document.createElement('div');
    informacion.className = 'contact-info';
    const nombre = document.createElement('span');
    nombre.className = 'contact-name';
    nombre.textContent = `${contacto.nombre} ${contacto.apellido}`;
    const telefono = document.createElement('span');
    telefono.className = 'phone';
    telefono.textContent = contacto.telefono;
    informacion.append(nombre, telefono);
    elemento.append(avatar, informacion);
    fragmento.append(elemento);
  }
  lista.replaceChildren(fragmento);
  contador.textContent = contactos.length;
  mostrarEstado(estadoLista, contactos.length === 0
    ? 'Todavía no hay contactos. Agrega el primero con el formulario.'
    : visibles.length === 0 ? 'No hay contactos que coincidan con la búsqueda.'
      : `Mostrando ${visibles.length} de ${contactos.length} contactos.`);
}

async function consultarServicio(opciones) {
  const respuesta = await fetch('/contactos', { ...opciones, signal: AbortSignal.timeout(10000) });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la solicitud.');
  return datos;
}

async function cargarContactos() {
  actualizar.disabled = true;
  mostrarEstado(estadoLista, 'Cargando contactos…');
  try {
    contactos = await consultarServicio({ cache: 'no-store' });
    mostrarContactos();
    return true;
  } catch {
    mostrarEstado(estadoLista, 'No se pudo actualizar la lista. Comprueba que el servidor esté disponible e inténtalo de nuevo.', 'error');
    return false;
  } finally {
    actualizar.disabled = false;
  }
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const contacto = Object.fromEntries(['nombre', 'apellido', 'telefono'].map((campo) =>
    [campo, formulario.elements[campo].value.trim()]));
  if (Object.values(contacto).some((valor) => !valor)) {
    mostrarEstado(estadoFormulario, 'Completa los tres campos sin dejarlos solo con espacios.', 'error');
    return;
  }
  guardar.disabled = true;
  mostrarEstado(estadoFormulario, 'Guardando contacto…');
  try {
    await consultarServicio({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contacto) });
    formulario.reset();
    const actualizada = await cargarContactos();
    mostrarEstado(estadoFormulario, actualizada ? 'Contacto guardado correctamente.'
      : 'Contacto guardado, pero la lista no se pudo actualizar. Pulsa Actualizar lista.', 'success');
  } catch (error) {
    mostrarEstado(estadoFormulario, error.name === 'TimeoutError' || error instanceof TypeError
      ? 'No se pudo confirmar el guardado. Comprueba la conexión y actualiza la lista antes de volver a intentarlo.'
      : `No se pudo guardar el contacto. ${error.message}`, 'error');
  } finally {
    guardar.disabled = false;
  }
});

actualizar.addEventListener('click', cargarContactos);
busqueda.addEventListener('input', mostrarContactos);
cargarContactos();
