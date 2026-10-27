# Abrir AgencyOS: guía desde cero

La aplicación no tiene todavía un enlace público en Internet. Esta guía la abre **en tu propia computadora**, con datos de demostración. No necesitas pagar anuncios ni tener claves de inteligencia artificial para probarla.

## 1. Instala Docker Desktop

Descarga Docker Desktop desde https://www.docker.com/products/docker-desktop/ y elige Windows o Mac, según tu computadora. Instálalo y ábrelo. Si pide reiniciar o instalar WSL en Windows, sigue sus instrucciones. Espera hasta que indique que Docker está funcionando.

Docker instala y ejecuta los componentes necesarios. No necesitas instalar Node, PostgreSQL ni FFmpeg por separado.

## 2. Descomprime el proyecto

Descarga el ZIP proporcionado en el chat y selecciona **Extraer todo** (Windows), o haz doble clic (Mac). Entra en la carpeta `AgencyOS`. Dentro debes ver `compose.demo.yaml`, `Dockerfile`, `README.md` y la carpeta `src`.

No ejecutes los comandos dentro del ZIP sin extraerlo.

## 3. Abre una terminal dentro de esa carpeta

- **Windows:** abre la carpeta en el Explorador, escribe `powershell` en la barra de dirección superior y presiona Enter.
- **Mac:** abre Terminal, escribe `cd ` (con un espacio al final), arrastra la carpeta `AgencyOS` a la ventana y presiona Enter.

La terminal es la ventana donde pegarás los comandos siguientes.

## 4. Inicia la aplicación

Con Docker Desktop abierto, pega este comando y presiona Enter:

```bash
docker compose -f compose.demo.yaml up --build -d
```

La primera vez descarga componentes y construye la aplicación; puede tardar varios minutos y necesita Internet. Deja que termine. No cierres Docker Desktop.

Luego pega:

```bash
docker compose -f compose.demo.yaml ps -a
```

`web`, `worker` y `postgres` deben estar en ejecución. `web` y `postgres` mostrarán `healthy` cuando estén listos. Es normal que `initialize` termine con `Exited (0)`: su trabajo es preparar la base de datos y los ejemplos.

## 5. Abre AgencyOS

Abre Chrome, Edge o Safari **en la misma computadora**. Escribe esto en su barra de direcciones:

```text
http://localhost:3000
```

`localhost` significa “esta computadora”. No es un enlace público ni sirve para abrir la aplicación desde otro dispositivo.

En la pantalla de acceso, pulsa **Explore demo workspace**. No necesitas introducir una contraseña para este modo local.

## 6. Prueba el ejemplo completo

1. Entra en **Creative library**, en el menú de la izquierda.
2. Selecciona **Terra Rituals · Demo** si aparece otro cliente.
3. Abre **Terra — The Daily Ritual.mp4**.
4. Si está procesando, espera a que termine. La página se actualiza automáticamente.
5. Revisa la recomendación, el CPA y ROAS de equilibrio y los escenarios.
6. Abre las pestañas **Scorecard**, **Timeline**, **Profit forecast**, **Creative variants**, **Sources** y **Fingerprint**.
7. Pulsa **Create experiment** para guardar un plan de prueba. Esto no compra ni publica anuncios.

Los datos de clientes, competidores, tendencias y juicios creativos del ejemplo están etiquetados como **simulados**. Sirven para probar el recorrido; no son resultados reales de campañas.

## 7. Usa un cliente y un video tuyos

1. Ve a **Clients → Add client**.
2. Escribe el negocio, producto, oferta y los costos reales. Los porcentajes se introducen como porcentajes: por ejemplo, `3` significa 3%.
3. Si no conoces los costos, desmarca la casilla del perfil financiero. La aplicación no inventará esos datos; los cálculos financieros quedarán pendientes.
4. Guarda el cliente.
5. Ve a **Analyze creative** y selecciona ese cliente real, no un cliente que diga Demo.
6. Arrastra un MP4, MOV o WebM: máximo 100 MB y 3 minutos. Puedes añadir la transcripción si la tienes.
7. Pulsa **Analyze creative** y espera el resultado.

Sin una clave de IA, funcionan la extracción del video, audio, fotogramas, texto en pantalla y los cálculos financieros. Los aspectos creativos que requieren interpretación profunda aparecen como no evaluados. No confundas esa revisión limitada con una evaluación profesional completa por IA.

Para activar IA o búsqueda en vivo, consulta `INTEGRATIONS.md`. No pegues claves privadas en el chat ni en archivos que vayas a compartir. La configuración sencilla de este archivo Compose no conecta servicios externos.

## Qué hace cada sección

| Menú | Uso |
| --- | --- |
| Agency overview | Resumen de clientes y creativos |
| Clients | Crear clientes y editar costos, producto y oferta |
| Analyze creative | Subir un video |
| Creative library | Abrir análisis guardados |
| Market intelligence | Añadir fuentes públicas y revisar su procedencia |
| Competitors | Registrar competidores |
| Gap analysis | Revisar hipótesis de oportunidades, no hechos garantizados |
| Trend radar | Revisar señales; sin historial, la velocidad de una tendencia es desconocida |
| Profitability | Cambiar supuestos y comparar ganancias o pérdidas estimadas |
| Experiments | Diseñar pruebas y registrar resultados manualmente |
| Reports | Abrir informes y exportar JSON |
| Integrations | Ver qué conexiones existen o siguen pendientes |
| Settings | Configurar la agencia, miembros y cuenta |

## Cerrar y volver a abrir

Para detener la aplicación sin borrar los datos:

```bash
docker compose -f compose.demo.yaml stop
```

Para abrirla otro día, inicia Docker Desktop, abre la terminal en la carpeta y ejecuta:

```bash
docker compose -f compose.demo.yaml up -d
```

Vuelve a escribir `http://localhost:3000` en el navegador. No borres los volúmenes de Docker: ahí están la base de datos y los videos.

## Si no funciona

- **No reconoce `docker`:** termina de instalar Docker Desktop, ábrelo y vuelve a abrir la terminal.
- **No encuentra `compose.demo.yaml`:** la terminal no está dentro de la carpeta correcta. Busca la carpeta que contiene ese archivo.
- **No se conecta al navegador:** verifica que Docker esté abierto y que `web` aparezca saludable con el comando `ps -a`.
- **El video se queda en cola:** comprueba que `worker` esté ejecutándose.
- **Error de puerto 3000 ocupado:** otra aplicación utiliza ese puerto. Detén esa aplicación antes de volver a iniciar AgencyOS.

Para ver los últimos mensajes de error:

```bash
docker compose -f compose.demo.yaml logs --tail=50 web worker initialize
```

Si necesitas ayuda, comparte el mensaje de error y si usas Windows o Mac. No compartas contraseñas ni claves privadas.

Esta configuración es exclusivamente local. Para tener un enlace público y acceso desde varios dispositivos, usa un despliegue con HTTPS, credenciales de producción y `DEMO_MODE=false`, siguiendo `SETUP.md` y `SECURITY.md`.
