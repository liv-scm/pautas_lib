# Estúdio de Pautas · Hipertrofia com Evidência

Aplicação web que transforma estudos sobre hipertrofia muscular em pautas de conteúdo prontas: roteiro de Reels, carrossel, legenda, post de LinkedIn, stories e roteiro de aula, sempre com o dado de impacto e a referência completa.

## O que tem

- **Banco de evidências:** 32 pautas (mitos, erros e conceitos) baseadas em 19 fontes.
- **Estúdio:** escolha público (leigo, praticante, profissional), tom e formato, e copie o roteiro.
- **Calendário editorial:** 4 semanas, geração automática do mês e exportação em Markdown.
- **Biblioteca de evidências:** adicione fontes manualmente ou importe PDFs de artigos; exporte e importe suas fontes em .json.

## Estrutura

```
index.html   interface e lógica
data.js      fontes (SOURCES) e pautas (ITEMS)
pdf.js       leitor de PDF que roda no navegador
.nojekyll    evita processamento do Jekyll no GitHub Pages
```

Sem build, sem dependências e sem servidor: é HTML, CSS e JavaScript puros.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub (por exemplo, `estudio-pautas`).
2. Envie os arquivos desta pasta para a raiz do repositório (botão **Add file → Upload files**, ou `git push`).
3. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
4. Em um ou dois minutos o site fica em `https://SEU-USUARIO.github.io/estudio-pautas/`.

## Rodar localmente

Abra o `index.html` no navegador. Para testar exatamente como no GitHub Pages, sirva a pasta com qualquer servidor estático, por exemplo `python3 -m http.server` e acesse `http://localhost:8000`.

## Onde ficam os dados

Tudo fica no navegador de quem usa:

- calendário e fontes adicionadas: `localStorage`;
- PDFs importados: `IndexedDB`.

Nada é enviado a servidor. Cada visitante do site tem sua própria biblioteca. Para levar suas fontes para outro navegador, use **Exportar minhas fontes** e depois **Importar .json** (os PDFs não vão no .json).

Para que uma fonte nova apareça para **todos** os visitantes, adicione-a diretamente em `data.js`.

## Aviso

Os números foram extraídos dos resumos e resultados das fontes citadas. Confira sempre no artigo original antes de publicar. O conteúdo é educativo e não substitui orientação profissional.
