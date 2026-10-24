"""Une src/ en un solo index.html (lo que publica GitHub Pages)."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
src = root / 'src'
head = '''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Planificador y simulador de fábricas de Satisfactory con recetas reales del juego.">
<title>NexusFactory</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
'''
css = (src / 'app.css').read_text(encoding='utf-8')
body = (src / 'body.html').read_text(encoding='utf-8')
data = (src / 'data.json').read_text(encoding='utf-8')
js = (src / 'core.js').read_text(encoding='utf-8') + '\n' + (src / 'ui.js').read_text(encoding='utf-8')
html = head + css + '</head>\n<body>\n' + body + '<script type="application/json" id="gamedata">' + data + '</script>\n<script>\n' + js + '\n</script>\n</body>\n</html>\n'
(root / 'index.html').write_text(html, encoding='utf-8')
print('index.html', len(html), 'bytes')
