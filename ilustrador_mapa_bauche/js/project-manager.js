/**
 * project-manager.js - Gestion de proyectos con backend (persistencia en disco)
 * Editor Plano San Rafael
 */

const ProjectManager = {

    /**
     * Inicializa el manager (no requiere setup especial con backend)
     */
    async init() {
        // Con backend no necesitamos inicializar nada
        return Promise.resolve();
    },

    /**
     * Crea un nuevo proyecto
     */
    async crearProyecto(nombre, imagenFile) {
        const formData = new FormData();
        formData.append('nombre', nombre);
        formData.append('imagen', imagenFile, imagenFile.name);

        const response = await fetch('/api/projects', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Error al crear proyecto');
        }

        const metadata = await response.json();
        return metadata.id;
    },

    /**
     * Obtiene todos los proyectos
     */
    async obtenerProyectos() {
        const response = await fetch('/api/projects');

        if (!response.ok) {
            throw new Error('Error al obtener proyectos');
        }

        return await response.json();
    },

    /**
     * Obtiene la URL de imagen de un proyecto
     */
    obtenerImagenURL(proyectoId) {
        return `/api/projects/${proyectoId}/image`;
    },

    /**
     * Obtiene la URL del thumbnail de un proyecto
     */
    obtenerThumbnailURL(proyectoId) {
        return `/api/projects/${proyectoId}/thumbnail`;
    },

    /**
     * Obtiene la BD guardada de un proyecto (como ArrayBuffer)
     */
    async obtenerDatabase(proyectoId) {
        const response = await fetch(`/api/projects/${proyectoId}/database`);

        if (response.status === 204) {
            return null; // No hay BD guardada
        }

        if (!response.ok) {
            throw new Error('Error al obtener base de datos');
        }

        return await response.arrayBuffer();
    },

    /**
     * Guarda la BD actual del proyecto en el servidor
     */
    async guardarDatabase(proyectoId) {
        if (!AppState.db) return;

        const data = AppState.db.export();
        const buffer = data.buffer;

        // Guardar la BD
        const dbResponse = await fetch(`/api/projects/${proyectoId}/database`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: buffer
        });

        if (!dbResponse.ok) {
            throw new Error('Error al guardar base de datos');
        }

        // Actualizar metadata
        const metaResponse = await fetch(`/api/projects/${proyectoId}/metadata`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fecha_modificacion: new Date().toISOString(),
                total_lotes: obtenerTotalLotes()
            })
        });

        if (!metaResponse.ok) {
            console.warn('No se pudo actualizar metadata');
        }
    },

    /**
     * Elimina un proyecto y todos sus datos
     */
    async eliminarProyecto(proyectoId) {
        const response = await fetch(`/api/projects/${proyectoId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Error al eliminar proyecto');
        }
    }
};
