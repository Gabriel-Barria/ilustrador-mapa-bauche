/**
 * datos-iniciales.js - Datos pre-cargados desde el Excel de clientes
 * 53 clientes con nombre y teléfono
 */

const DATOS_INICIALES = [
    { nombre: "Astrid Gomez", telefono: "+56964894999" },
    { nombre: "Carlos Aguero", telefono: "+56968603541" },
    { nombre: "Carlos Gamin", telefono: "+56983569666" },
    { nombre: "Carlos Nahuelpan", telefono: "+56992904575" },
    { nombre: "Cristian Oyarzo", telefono: "+56988515396" },
    { nombre: "Danilo Soto", telefono: "+56988415663" },
    { nombre: "David Cartes", telefono: "+56957124563" },
    { nombre: "Eduardo Chavez", telefono: "+56922076497" },
    { nombre: "Gabriel Barria", telefono: "+56973550328" },
    { nombre: "Gabriel Farias", telefono: "+56995153542" },
    { nombre: "Gino Reyes", telefono: "+56976087017" },
    { nombre: "Gloria Alvares", telefono: "+56932069629" },
    { nombre: "Gloria Isamar Velasquez", telefono: "+56967897918" },
    { nombre: "Gloria Levil", telefono: "+56986531665" },
    { nombre: "Guido Quintuy", telefono: "+56962847779" },
    { nombre: "Ines Velasquez", telefono: "+56986933060" },
    { nombre: "Joaquin Claramunt", telefono: "+56981528436" },
    { nombre: "Jose Paredes", telefono: "+56934946943" },
    { nombre: "Juan Chavez", telefono: "+56922076497" },
    { nombre: "Leonardo Soto", telefono: "+56988415663" },
    { nombre: "Lishby Fuentes", telefono: "+56937015930" },
    { nombre: "Luis Mondaca", telefono: "+56966470486" },
    { nombre: "Luz Maldonado", telefono: "+56965913448" },
    { nombre: "Marcelo Millanao", telefono: "+56956400315" },
    { nombre: "Maria Elena Velasquez", telefono: "+56976065837" },
    { nombre: "Maria Marin", telefono: "+56942666234" },
    { nombre: "Maria Oliva Soto", telefono: "+56985961781" },
    { nombre: "Maria Sonia Quintuy", telefono: "+56987177967" },
    { nombre: "Mario Velasquez", telefono: "+56933288507" },
    { nombre: "Marisol Castro", telefono: "+56976006959" },
    { nombre: "Marta Ines Diaz Raipane", telefono: "+56990719462" },
    { nombre: "Mauricio Muñoz", telefono: "+56968619494" },
    { nombre: "Miguel Blanco", telefono: "+56987177967" },
    { nombre: "Miriam Alvarado", telefono: "+56953475132" },
    { nombre: "Monica Cuello", telefono: "+56988415663" },
    { nombre: "Nancy Zuñiga", telefono: "+56988584908" },
    { nombre: "Natividad Soto", telefono: "+56985961781" },
    { nombre: "Nelson Mancilla", telefono: "+56965202900" },
    { nombre: "Nora Blanco", telefono: "+56920093412" },
    { nombre: "Norma Sanchez", telefono: "+56979958848" },
    { nombre: "Pablo Contreras", telefono: null },
    { nombre: "Patricia Carcamo", telefono: "+56996147837" },
    { nombre: "Patricio Alvares", telefono: "+56997635530" },
    { nombre: "Pedro Almonacid", telefono: null },
    { nombre: "Pedro Contreras", telefono: "+56989964614" },
    { nombre: "Ramona Mansilla", telefono: "+56985112472" },
    { nombre: "Ramon Maldonado", telefono: "+56944832434" },
    { nombre: "Rosa Mansilla", telefono: "+56931428027" },
    { nombre: "Rosa Nuñez", telefono: "+56977695519" },
    { nombre: "Sandra Mancilla", telefono: "+56965376773" },
    { nombre: "Vanesa Aguilar", telefono: "+56926967602" },
    { nombre: "Victor Fuentealba", telefono: "+56981643379" },
    { nombre: "Yuri Millaquen", telefono: "+56976087017" },
];

/**
 * Carga los datos iniciales en la base de datos
 * Los textos NO se crean automaticamente - el usuario los posiciona manualmente
 */
async function cargarDatosIniciales() {
    // Solo cargar si la BD está vacía
    const lotesExistentes = obtenerLotes();
    if (lotesExistentes.length > 0) {
        console.log('Ya hay datos cargados, saltando datos iniciales');
        return;
    }

    console.log('Cargando ' + DATOS_INICIALES.length + ' clientes desde el Excel...');

    for (const dato of DATOS_INICIALES) {
        // Crear lote en BD (sin posición de texto aún)
        await crearLote({
            nombre_propietario: dato.nombre,
            rol_propiedad: null,
            telefono: dato.telefono,
            es_oficial: 1
        });
    }

    await renderizarListaLotes();
    actualizarBarraEstado();

    mostrarNotificacion(`${DATOS_INICIALES.length} clientes cargados. Selecciona uno de la lista y usa "Texto" para colocarlo en el mapa.`, 'success');
}
