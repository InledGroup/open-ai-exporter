# Análisis de Lógica de Extracción de Mensajes (del código fuente proporcionado)

## 1. ChatGPT (Selector DOM)
La extensión utiliza selectores CSS para identificar los mensajes en la interfaz de ChatGPT.

```javascript
class ChatGPTAdapter {
  _selector = "main article > div.text-base > div";
  
  getElements() {
    return document.querySelectorAll(this._selector);
  }
  
  detectChatType(element) {
    let parent = element.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      if (parent.tagName === "ARTICLE") {
        const srOnly = parent.querySelectorAll(".sr-only");
        for (let j = 0; j < srOnly.length; j++) {
          if ((srOnly[j].textContent?.toLowerCase() || "").includes("chatgpt")) {
            return "assistant"; // Respuesta de la IA
          }
        }
        break;
      }
      parent = parent.parentElement;
    }
    return "user"; // Prompt del usuario
  }
}
```

## 2. Claude (API & Selector)
Para Claude, parece combinar la inyección de checkboxes en el DOM con la obtención de datos reales mediante su API interna.

**Selector para Checkboxes:**
`_selector = "[data-test-render-count]";`

**Extracción vía API:**
```javascript
static async fetchClaudeData(orgId, convId) {
  const url = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${convId}?tree=True&rendering_mode=messages&render_all_tools=true`;
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept": "*/*",
      "Content-Type": "application/json"
    }
  });
  return await response.json();
}
```

## 3. Gemini (Google RPC)
Gemini no usa selectores simples para el contenido, sino que intercepta o parsea las respuestas RPC de Google que vienen en formatos de arrays anidados.

```javascript
static parseResponse(rawData) {
  // Limpia el prefijo de seguridad de Google )]}'
  let data = rawData.replace(/^\)\]\}'\s*\n/, "");
  const parts = data.split("\n").filter(l => l.trim() !== "");
  // ... lógica compleja de navegación por arrays (wt es una utilidad de navegación segura)
  // Utiliza índices específicos como [3, 0, 0, 1] para el contenido.
}
```

## 4. NotebookLM
Aunque está en la lista de dominios, NotebookLM parece compartir la infraestructura de Google (RPC) y no tiene un adaptador DOM dedicado en los fragmentos principales, lo que sugiere que se trata de forma similar a Gemini o mediante la captura de tráfico.

## 5. Otros (Grok, DeepSeek, Kimi)
- **Grok:** Selector `.message-bubble`.
- **DeepSeek:** Extracción vía API interna.
- **Kimi:** Extracción vía API interna.

## 6. Lógica de Exportación (Markdown)
La extensión genera Markdown de forma manual o mediante transformaciones de los objetos de mensaje extraídos.

```javascript
static generateMarkdown(messages) {
  return messages.map(m => {
    const rolePrefix = m.role === 'user' ? '### Usuario' : '### IA';
    return `${rolePrefix}\n\n${m.content}\n\n---`;
  }).join('\n\n');
}
```
