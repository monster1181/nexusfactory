# NexusFactory

Planificador y simulador de fábricas para **Satisfactory 1.x**, en español, hecho para el equipo (Tharvex, Giosepe, Jhafretd, Danida y Aleguies).

**Abrir la app:** https://monster1181.github.io/nexusfactory/

## Qué hace

- **Planificador:** eliges qué producir por minuto y calcula las máquinas exactas, cuántas construir y a qué reloj, la energía, los mineros, la cinta que necesita cada flujo y los subproductos. Se ve como diagrama de flujo, tabla o repartido por persona.
- **Megafábricas del equipo:** vienen cargadas las 12 del Plan maestro (hoja «Satisfactory – Plan del equipo»), con responsable y nivel de inicio.
- **Taller:** lienzo donde cada máquina aparece por separado (con divisores y fusionadores en cadena, o agrupadas si se prefiere) para colocar mineros, máquinas, divisores, fusionadores, almacenes y el triturador AWESOME, y conectarlos con cintas Mk.1–Mk.6 o tuberías. El simulador muestra el rendimiento de cada máquina, las cintas llenas y las salidas sin conectar. Puede generar la construcción completa a partir de un plan.
- **Recetas y alternativas:** consulta de todas las recetas por minuto; marcas las alternativas desbloqueadas y el optimizador elige las que gastan menos recursos escasos.
- **Extracción y energía:** calculadoras de mineros, extractores y generadores.

Los planes se guardan en el navegador de cada uno. Para pasarse un plan usen **Compartir → Importar**.

## Datos

Recetas, máquinas y consumos sacados del archivo de datos oficial del juego (`Docs.json`) vía [SatisfactoryTools](https://github.com/greeny/SatisfactoryTools) (licencia MIT), versión 1.0. Los nombres en español siguen los de la hoja del equipo.

Para actualizar a una versión nueva del juego:

```bash
python3 tools/extract.py ruta/al/data.json   # regenera src/data.json
python3 tools/build.py                       # regenera index.html
```

## Estructura

- `src/core.js` — cálculo del plan y simulador del taller
- `src/ui.js` — interfaz
- `src/app.css`, `src/body.html` — estilos y estructura
- `src/data.json` — datos del juego
- `tools/` — extracción de datos y armado de `index.html`
