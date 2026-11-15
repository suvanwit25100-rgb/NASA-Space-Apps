// A small interface translation layer: Spanish, Portuguese and Hindi for the navigation, front page, controls and map.
// The long explanatory text (method, validation, chart sentences) is still English. The translations were written with AI
// assistance and have NOT been reviewed by native speakers; they are marked as such in the language menu.
import { MONTHS } from "./analytics";

export const LANGS = { en: "English", es: "Español", pt: "Português", hi: "हिन्दी" };

const D = {
  es: {
    "Guided tour": "Visita guiada", "The Calendar": "El Calendario", "Fire Seasons": "Temporadas de fuego", "The Map": "El Mapa", Compare: "Comparar", "The Method": "El Método", About: "Acerca de",
    "Every day since 2000 as a calendar, with the story of the year in a sentence.": "Cada día desde 2000 en un calendario, con la historia del año en una frase.",
    "When a region's fire season starts, peaks and ends, and how every year compares.": "Cuándo empieza, alcanza su máximo y termina la temporada de fuego de una región, y cómo se compara cada año.",
    "Where it burned, month by month, anywhere on Earth. Draw your own area.": "Dónde ardió, mes a mes, en cualquier lugar de la Tierra. Dibuja tu propia área.",
    "Do two places burn at the same time of year? Set them side by side.": "¿Arden dos lugares en la misma época del año? Ponlos lado a lado.",
    "How two decades of mismatched sensors become one record, and how we checked it.": "Cómo dos décadas de sensores distintos se convierten en un solo registro, y cómo lo comprobamos.",
    "The NASA data behind it, how AI was used, and what the limits are.": "Los datos de la NASA detrás, cómo se usó la IA y cuáles son los límites.",
    Open: "Abrir", Scroll: "Desplázate", "About the project": "Sobre el proyecto", "Twenty-five years of fire,": "Veinticinco años de fuego,", "one consistent record.": "un registro coherente.",
    LEAD: "Los satélites vigilan los incendios de la Tierra desde 2000, pero el registro está dividido entre sensores que no se pueden comparar directamente: VIIRS detecta unas seis veces más incendios que MODIS, así que un conteo simple salta en 2012. Global Burn Log calibra los sensores entre sí para que los equipos de alerta temprana, los gestores del territorio y los científicos vean cuándo empieza la temporada de fuego de una región, cuándo alcanza su máximo y cómo se compara este año.",
    "Years of record": "Años de registro", Countries: "Países", "Burning cell-days": "Celdas-día con fuego", "Satellite sensors": "Sensores satelitales", Explore: "Explorar", "Six ways in": "Seis formas de entrar",
    "Right now": "Ahora mismo", "Furthest from normal": "Lo más alejado de lo normal", "this week.": "esta semana.", "Where it comes from": "De dónde viene", "Built on NASA data,": "Construido con datos de la NASA,", "openly.": "con transparencia.",
    "Take the guided tour": "Haz la visita guiada", "How we checked it": "Cómo lo comprobamos", "Source code": "Código fuente", "The demo question": "La pregunta de la demo", "When does": "¿Cuándo arde", your: "tu", "region burn?": "región?", "See fire seasons": "Ver temporadas de fuego",
    Area: "Área", "Search a country": "Buscar un país", "Type a country…": "Escribe un país…", Year: "Año",
    "Draw area": "Dibujar área", Cancel: "Cancelar", "Reset view": "Restablecer vista", "Full screen": "Pantalla completa", Exit: "Salir", Layers: "Capas", Activity: "Actividad", Unusual: "Inusual", "Two years": "Dos años",
    "Burning days": "Días con fuego", Few: "Pocos", Many: "Muchos", "Below usual": "Menos de lo usual", "Above usual": "Más de lo usual", "burning cells": "celdas con fuego",
    Colours: "Colores", "Fire colours": "Colores de fuego", "Colour-blind safe": "Apto para daltonismo", "Use the data": "Usa los datos", Language: "Idioma", Home: "Inicio", "Front page": "Portada", "Back to": "Volver a",
  },
  pt: {
    "Guided tour": "Visita guiada", "The Calendar": "O Calendário", "Fire Seasons": "Temporadas de fogo", "The Map": "O Mapa", Compare: "Comparar", "The Method": "O Método", About: "Sobre",
    "Every day since 2000 as a calendar, with the story of the year in a sentence.": "Cada dia desde 2000 em um calendário, com a história do ano em uma frase.",
    "When a region's fire season starts, peaks and ends, and how every year compares.": "Quando a temporada de fogo de uma região começa, atinge o pico e termina, e como cada ano se compara.",
    "Where it burned, month by month, anywhere on Earth. Draw your own area.": "Onde queimou, mês a mês, em qualquer lugar da Terra. Desenhe a sua própria área.",
    "Do two places burn at the same time of year? Set them side by side.": "Dois lugares queimam na mesma época do ano? Coloque-os lado a lado.",
    "How two decades of mismatched sensors become one record, and how we checked it.": "Como duas décadas de sensores diferentes viram um único registro, e como o verificamos.",
    "The NASA data behind it, how AI was used, and what the limits are.": "Os dados da NASA por trás, como a IA foi usada e quais são os limites.",
    Open: "Abrir", Scroll: "Role", "About the project": "Sobre o projeto", "Twenty-five years of fire,": "Vinte e cinco anos de fogo,", "one consistent record.": "um registro consistente.",
    LEAD: "Satélites observam a Terra queimar desde 2000, mas o registro está dividido entre sensores que não podem ser comparados diretamente: o VIIRS detecta cerca de seis vezes mais focos que o MODIS, então uma contagem simples dá um salto em 2012. O Global Burn Log calibra os sensores entre si para que equipes de alerta precoce, gestores de terras e cientistas vejam quando a temporada de fogo de uma região começa, quando atinge o pico e como este ano se compara.",
    "Years of record": "Anos de registro", Countries: "Países", "Burning cell-days": "Células-dia com fogo", "Satellite sensors": "Sensores de satélite", Explore: "Explore", "Six ways in": "Seis formas de entrar",
    "Right now": "Agora mesmo", "Furthest from normal": "Mais longe do normal", "this week.": "esta semana.", "Where it comes from": "De onde vem", "Built on NASA data,": "Construído com dados da NASA,", "openly.": "de forma aberta.",
    "Take the guided tour": "Faça a visita guiada", "How we checked it": "Como verificamos", "Source code": "Código-fonte", "The demo question": "A pergunta da demonstração", "When does": "Quando a", your: "sua", "region burn?": "região pega fogo?", "See fire seasons": "Ver temporadas de fogo",
    Area: "Área", "Search a country": "Buscar um país", "Type a country…": "Digite um país…", Year: "Ano",
    "Draw area": "Desenhar área", Cancel: "Cancelar", "Reset view": "Redefinir vista", "Full screen": "Tela cheia", Exit: "Sair", Layers: "Camadas", Activity: "Atividade", Unusual: "Incomum", "Two years": "Dois anos",
    "Burning days": "Dias com fogo", Few: "Poucos", Many: "Muitos", "Below usual": "Abaixo do usual", "Above usual": "Acima do usual", "burning cells": "células com fogo",
    Colours: "Cores", "Fire colours": "Cores de fogo", "Colour-blind safe": "Seguro para daltonismo", "Use the data": "Use os dados", Language: "Idioma", Home: "Início", "Front page": "Página inicial", "Back to": "Voltar para",
  },
  hi: {
    "Guided tour": "निर्देशित भ्रमण", "The Calendar": "कैलेंडर", "Fire Seasons": "आग के मौसम", "The Map": "नक्शा", Compare: "तुलना", "The Method": "पद्धति", About: "परिचय",
    "Every day since 2000 as a calendar, with the story of the year in a sentence.": "2000 से हर दिन एक कैलेंडर में, और साल की कहानी एक वाक्य में।",
    "When a region's fire season starts, peaks and ends, and how every year compares.": "किसी क्षेत्र में आग का मौसम कब शुरू होता है, चरम पर पहुँचता है और खत्म होता है, और हर साल की तुलना कैसी रहती है।",
    "Where it burned, month by month, anywhere on Earth. Draw your own area.": "कहाँ जला, महीने दर महीने, पृथ्वी पर कहीं भी। अपना क्षेत्र खुद बनाएँ।",
    "Do two places burn at the same time of year? Set them side by side.": "क्या दो जगहें साल के एक ही समय में जलती हैं? उन्हें साथ-साथ रखें।",
    "How two decades of mismatched sensors become one record, and how we checked it.": "दो दशकों के अलग-अलग सेंसर कैसे एक रिकॉर्ड बने, और हमने इसे कैसे जाँचा।",
    "The NASA data behind it, how AI was used, and what the limits are.": "इसके पीछे का NASA डेटा, AI का उपयोग कैसे हुआ, और सीमाएँ क्या हैं।",
    Open: "खोलें", Scroll: "नीचे जाएँ", "About the project": "परियोजना के बारे में", "Twenty-five years of fire,": "आग के पच्चीस साल,", "one consistent record.": "एक सुसंगत रिकॉर्ड।",
    LEAD: "उपग्रह 2000 से धरती को जलते हुए देख रहे हैं, लेकिन रिकॉर्ड ऐसे सेंसरों में बँटा है जिनकी सीधी तुलना नहीं हो सकती: VIIRS, MODIS से लगभग छह गुना ज़्यादा आग पकड़ता है, इसलिए सीधी गिनती 2012 में उछल जाती है। Global Burn Log सेंसरों को आपस में कैलिब्रेट करता है, ताकि पूर्व-चेतावनी टीमें, भूमि प्रबंधक और वैज्ञानिक देख सकें कि किसी क्षेत्र का आग का मौसम कब शुरू होता है, कब चरम पर होता है और इस साल की तुलना कैसी है।",
    "Years of record": "रिकॉर्ड के साल", Countries: "देश", "Burning cell-days": "जलते सेल-दिन", "Satellite sensors": "उपग्रह सेंसर", Explore: "खोजें", "Six ways in": "छह रास्ते",
    "Right now": "अभी", "Furthest from normal": "सामान्य से सबसे दूर", "this week.": "इस हफ़्ते।", "Where it comes from": "यह कहाँ से आता है", "Built on NASA data,": "NASA के डेटा पर आधारित,", "openly.": "खुले तौर पर।",
    "Take the guided tour": "निर्देशित भ्रमण करें", "How we checked it": "हमने इसे कैसे जाँचा", "Source code": "सोर्स कोड", "The demo question": "डेमो का सवाल", "When does": "", your: "आपका", "region burn?": "क्षेत्र कब जलता है?", "See fire seasons": "आग के मौसम देखें",
    Area: "क्षेत्र", "Search a country": "देश खोजें", "Type a country…": "देश का नाम लिखें…", Year: "साल",
    "Draw area": "क्षेत्र बनाएँ", Cancel: "रद्द करें", "Reset view": "दृश्य रीसेट", "Full screen": "पूर्ण स्क्रीन", Exit: "बाहर", Layers: "परतें", Activity: "गतिविधि", Unusual: "असामान्य", "Two years": "दो साल",
    "Burning days": "जलने के दिन", Few: "कम", Many: "ज़्यादा", "Below usual": "सामान्य से कम", "Above usual": "सामान्य से ज़्यादा", "burning cells": "जलते सेल",
    Colours: "रंग", "Fire colours": "आग के रंग", "Colour-blind safe": "रंग-अंधता के अनुकूल", "Use the data": "डेटा का उपयोग करें", Language: "भाषा", Home: "मुख्य पृष्ठ", "Front page": "पहला पृष्ठ", "Back to": "वापस",
  },
};

let lang = "en";
const EN_MONTHS = [...MONTHS];
const EN_CHAPTERS = new Map();

export const getLang = () => lang;
export const t = (s) => (lang !== "en" && D[lang] && D[lang][s] !== undefined ? D[lang][s] : s);

// Switch the language: translations for t(), the month names, the page language and, for Hindi, a Devanagari font.
export function setLang(next, chapters = []) {
  if (!LANGS[next]) next = "en";
  lang = next;
  const loc = next === "en" ? null : next;
  const names = loc
    ? Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(loc, { month: "short" }).format(new Date(Date.UTC(2001, m, 15))).replace(/\.$/, ""))
    : EN_MONTHS;
  MONTHS.splice(0, 12, ...names);
  for (const c of chapters) {
    if (!EN_CHAPTERS.has(c.path)) EN_CHAPTERS.set(c.path, { title: c.title, teaser: c.teaser });
    const en = EN_CHAPTERS.get(c.path);
    c.title = t(en.title);
    c.teaser = t(en.teaser);
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    if (next === "hi" && !document.getElementById("font-devanagari")) {
      const l = document.createElement("link");
      l.id = "font-devanagari";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700;800&display=swap";
      document.head.appendChild(l);
    }
  }
}
