#!/usr/bin/env python3
"""
Servidor HTTP simple para desarrollo.
Ejecutar: python serve.py
Abrir: http://localhost:8000
"""

import http.server
import socketserver
import webbrowser
import os

PORT = 8000

# Cambiar al directorio del script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler

# Agregar MIME types para WebAssembly
Handler.extensions_map['.wasm'] = 'application/wasm'

print(f"Servidor iniciado en http://localhost:{PORT}")
print("Presiona Ctrl+C para detener")

# Abrir navegador automaticamente
webbrowser.open(f'http://localhost:{PORT}')

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido")
