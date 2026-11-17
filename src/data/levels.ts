export type QuizMode = "choice" | "image_choice" | "open_ended";

export interface QuizOption {
  id: string;
  label: string;
  imageSrc?: string;
  isCorrect: boolean;
  feedback: string;
}

export interface QuizQuestion {
  id: string;
  checkpointTitle: string;
  lessonTip: string;
  question: string;
  mode: QuizMode;
  options: QuizOption[];
  expectedConcept: string;
  openHint?: string;
  achievementTitle: string;
  achievementDesc: string;
}

export interface FinancialLevel {
  id: number;
  title: string;
  subtitle: string;
  topic: string;
  skyColor: string;
  fogColor: string;
  groundTint: string;
  accentHex: string;
  routeLength: number;
  baseSpeed: number;
  obstacleCount: number;
  coinCount: number;
  routeBonusCoins: number;
  bossJackpotCoins: number;
  introMessage: string;
  questions: QuizQuestion[];
}

export const FINANCIAL_LEVELS: FinancialLevel[] = [
  {
    id: 1,
    title: "El Sendero del Ahorro",
    subtitle: "Necesidades vs. Deseos",
    topic: "Aprender a distinguir necesidades de deseos y usar tu alcancía",
    skyColor: "#CBEBF7",
    fogColor: "#DFEEF4",
    groundTint: "#67A857",
    accentHex: "#0D9488",
    routeLength: 170,
    baseSpeed: 12.5,
    obstacleCount: 10,
    coinCount: 22,
    routeBonusCoins: 60,
    bossJackpotCoins: 300,
    introMessage:
      "¡Esquiva las trampas de dulces impulsivos, supera retos visuales y preguntas abiertas con Tito y llega hasta Don Búho al final del camino!",
    questions: [
      {
        id: "l1-q1",
        checkpointTitle: "Puerta 1: Selecciona la Imagen Correcta",
        lessonTip:
          "Una necesidad es algo esencial para aprender, cuidarte y crecer sano. Un deseo es un antojo divertido que puede esperar.",
        question:
          "Tienes 30 monedas antes de clases. ¡Toca la imagen que muestra una NECESIDAD real!",
        mode: "image_choice",
        options: [
          {
            id: "a",
            label: "Cuaderno, lápices y manzana",
            imageSrc: "/src/assets/images/item_utiles_escolares_1794942722747.jpg",
            isCorrect: true,
            feedback:
              "¡Exacto! Los útiles para estudiar y una merienda sana son necesidades importantes.",
          },
          {
            id: "b",
            label: "Montaña de dulces y paletas",
            imageSrc: "/src/assets/images/item_dulces_impulso_1794942721890.jpg",
            isCorrect: false,
            feedback:
              "¡Cuidado! Esos dulces se ven ricos pero son un deseo impulsivo, no una necesidad.",
          },
        ],
        expectedConcept:
          "Distinguir necesidades básicas como útiles o comida sana de deseos impulsivos",
        achievementTitle: "Cazador de Necesidades",
        achievementDesc: "Identificaste qué cosas son esenciales antes de gastar.",
      },
      {
        id: "l1-q2",
        checkpointTitle: "Puerta 2: Elige la Mejor Decisión Visual",
        lessonTip:
          "Si guardas una parte de cada moneda que recibes, pronto tendrás suficiente para cumplir una meta grande.",
        question:
          "Quieres una bicicleta de 100 monedas y hoy recibiste 20 monedas de regalo. ¿Qué imagen muestra el mejor hábito para lograr tu meta?",
        mode: "image_choice",
        options: [
          {
            id: "a",
            label: "Guardar monedas en tu alcancía",
            imageSrc: "/src/assets/images/item_alcancia_ahorro_1794942720877.jpg",
            isCorrect: true,
            feedback:
              "¡Genial! Llenar tu alcancía poco a poco te acerca rapidísimo a la bicicleta.",
          },
          {
            id: "b",
            label: "Gastar todo hoy en golosinas",
            imageSrc: "/src/assets/images/item_dulces_impulso_1794942721890.jpg",
            isCorrect: false,
            feedback:
              "Si gastas todo hoy en antojos, tu meta de la bicicleta quedará en cero.",
          },
        ],
        expectedConcept: "Ahorrar parte del dinero recibido para metas futuras",
        achievementTitle: "Guardián de la Alcancía",
        achievementDesc: "Elegiste ahorrar hoy para lograr una meta más grande.",
      },
      {
        id: "l1-q3",
        checkpointTitle: "Puerta 3: Reto Abierto con Tito",
        lessonTip:
          "Esperar unos minutos antes de comprar algo nos ayuda a saber si de verdad lo necesitamos o si solo es un impulso.",
        question:
          "Pregunta abierta (escribe o responde con tu voz): Imagina que ves un juguete carísimo en una vitrina. ¿Qué harías tú antes de comprarlo para no arrepentirte después?",
        mode: "open_ended",
        options: [],
        openHint:
          "Pista de Tito: Puedes pensar en esperar unos días, revisar si ya tienes algo parecido o preguntar cuánto te falta para tu meta.",
        expectedConcept:
          "Pensar con calma, esperar antes de comprar, revisar si lo necesita o comparar con su meta de ahorro para evitar compras impulsivas.",
        achievementTitle: "Sabio del Camino",
        achievementDesc: "Explicaste con tus palabras cómo vencer las compras impulsivas.",
      },
    ],
  },
  {
    id: 2,
    title: "El Mercado Inteligente",
    subtitle: "Comparar y Presupuestar",
    topic: "Hacer presupuestos simples, comparar precios y revisar el cambio",
    skyColor: "#FDE6BD",
    fogColor: "#F9ECCE",
    groundTint: "#83A84B",
    accentHex: "#D97706",
    routeLength: 195,
    baseSpeed: 14.2,
    obstacleCount: 13,
    coinCount: 26,
    routeBonusCoins: 80,
    bossJackpotCoins: 300,
    introMessage:
      "¡El mercado va más rápido! Salta obstáculos, resuelve retos visuales y preguntas abiertas hasta alcanzar a Don Búho.",
    questions: [
      {
        id: "l2-q1",
        checkpointTitle: "Puerta 1: Comprador Astuto",
        lessonTip:
          "Comparar precios entre dos tiendas antes de comprar el mismo producto te ayuda a pagar menos y quedarte con más monedas.",
        question:
          "Una mochila cuesta 45 monedas en la Tienda Sol, y exactamente la misma cuesta 35 monedas en la Tienda Luna. ¿Cuántas monedas ahorras si eliges Tienda Luna?",
        mode: "choice",
        options: [
          {
            id: "a",
            label: "Ahorras 10 monedas para tu alcancía",
            isCorrect: true,
            feedback:
              "¡Excelente cálculo! 45 menos 35 son 10 monedas extra que siguen siendo tuyas.",
          },
          {
            id: "b",
            label: "No ahorras nada porque es la misma mochila",
            isCorrect: false,
            feedback:
              "¡Sí ahorras! Aunque sea el mismo producto, el precio más bajo cuida tu bolsillo.",
          },
          {
            id: "c",
            label: "Pierdes 5 monedas",
            isCorrect: false,
            feedback:
              "Al pagar menos no pierdes, ¡ganas 10 monedas de ahorro!",
          },
        ],
        expectedConcept: "Comparar precios y calcular el ahorro",
        achievementTitle: "Comprador Astuto",
        achievementDesc: "Comparaste precios y ahorraste 10 monedas inteligentes.",
      },
      {
        id: "l2-q2",
        checkpointTitle: "Puerta 2: Elige la Imagen de Organización",
        lessonTip:
          "Dividir nuestras monedas por propósito nos ayuda a nunca quedarnos sin dinero para lo importante.",
        question:
          "¿Cuál de estas imágenes muestra una forma inteligente de organizar tu presupuesto y metas?",
        mode: "image_choice",
        options: [
          {
            id: "a",
            label: "Tres frascos: Ahorrar, Gastar y Compartir",
            imageSrc: "/src/assets/images/item_frascos_metas_1794942722420.jpg",
            isCorrect: true,
            feedback:
              "¡Perfecto! Organizar tu dinero en frascos separados te da control total.",
          },
          {
            id: "b",
            label: "Gastar todo de golpe en dulces",
            imageSrc: "/src/assets/images/item_dulces_impulso_1794942721890.jpg",
            isCorrect: false,
            feedback:
              "¡Uy! Si gastamos sin planear, luego no queda nada para nuestras metas.",
          },
        ],
        expectedConcept: "Organizar el presupuesto en categorías de ahorro y gasto",
        achievementTitle: "Maestro del Presupuesto",
        achievementDesc: "Elegiste planear y organizar tus monedas por metas.",
      },
      {
        id: "l2-q3",
        checkpointTitle: "Puerta 3: Reto Abierto en el Mercado",
        lessonTip:
          "Siempre revisa tu cambio y tu recibo después de pagar, con amabilidad y atención.",
        question:
          "Pregunta abierta (escribe o habla por micrófono): Acabas de pagar en una tienda con un billete grande. ¿Qué debes revisar antes de guardar tus monedas en el bolsillo y por qué?",
        mode: "open_ended",
        options: [],
        openHint:
          "Pista de Tito: Piensa en las monedas que te devuelve el vendedor cuando pagas de más.",
        expectedConcept:
          "Contar y revisar el cambio o vuelto recibido para asegurarse de que esté completo y cuidar el dinero.",
        achievementTitle: "Ojo de Lince",
        achievementDesc: "Explicaste cómo cuidar tu cambio al hacer compras.",
      },
    ],
  },
  {
    id: 3,
    title: "La Bóveda del Futuro",
    subtitle: "Metas, Esfuerzo y Generosidad",
    topic: "Planear metas grandes, ganar con esfuerzo y compartir con responsabilidad",
    skyColor: "#D8E4FF",
    fogColor: "#E8EEFF",
    groundTint: "#509E77",
    accentHex: "#059669",
    routeLength: 220,
    baseSpeed: 15.6,
    obstacleCount: 15,
    coinCount: 30,
    routeBonusCoins: 100,
    bossJackpotCoins: 300,
    introMessage:
      "¡Última ruta hacia Don Búho en la Bóveda Dorada! Demuestra todo lo aprendido antes de la gran entrevista final.",
    questions: [
      {
        id: "l3-q1",
        checkpointTitle: "Puerta 1: El Valor del Esfuerzo",
        lessonTip:
          "El dinero se gana con trabajo, creatividad, esfuerzo y cuidando nuestras cosas.",
        question:
          "¿Cuál imagen representa un hábito positivo que te prepara para estudiar, esforzarte y cuidar tu futuro?",
        mode: "image_choice",
        options: [
          {
            id: "a",
            label: "Preparar tus útiles y aprender cada día",
            imageSrc: "/src/assets/images/item_utiles_escolares_1794942722747.jpg",
            isCorrect: true,
            feedback:
              "¡Brillante! Aprender y prepararse abre las puertas para lograr grandes metas.",
          },
          {
            id: "b",
            label: "Comer antojos sin parar",
            imageSrc: "/src/assets/images/item_dulces_impulso_1794942721890.jpg",
            isCorrect: false,
            feedback:
              "Los gustos pequeños están bien a veces, pero el esfuerzo y aprendizaje valen oro.",
          },
        ],
        expectedConcept: "Valorar el aprendizaje, la preparación y el esfuerzo",
        achievementTitle: "Creador de Valor",
        achievementDesc: "Reconociste la importancia de aprender y esforzarte.",
      },
      {
        id: "l3-q2",
        checkpointTitle: "Puerta 2: Regla de las 3 Alcancías",
        lessonTip:
          "Dividir tus monedas en Ahorrar, Gastar y Compartir equilibra tus metas con la generosidad.",
        question:
          "Observa los 3 frascos (Ahorrar, Gastar, Compartir). ¿Para qué sirve el frasco de COMPARTIR?",
        mode: "image_choice",
        options: [
          {
            id: "a",
            label: "Ayudar a otros y compartir con cariño",
            imageSrc: "/src/assets/images/item_frascos_metas_1794942722420.jpg",
            isCorrect: true,
            feedback:
              "¡Hermoso! Ser responsable con el dinero también incluye ayudar y compartir.",
          },
          {
            id: "b",
            label: "Esconder todas las monedas sin usarlas nunca",
            imageSrc: "/src/assets/images/item_alcancia_ahorro_1794942720877.jpg",
            isCorrect: false,
            feedback:
              "La alcancía sirve para metas de ahorro; el frasco de compartir es específicamente para ayudar o dar un detalle a otros.",
          },
        ],
        expectedConcept: "Dividir el dinero en ahorrar, gastar y compartir",
        achievementTitle: "Corazón Generoso",
        achievementDesc: "Entendiste el equilibrio entre ahorrar, gastar y compartir.",
      },
      {
        id: "l3-q3",
        checkpointTitle: "Puerta 3: Tu Gran Consejo Financiero",
        lessonTip:
          "Estás a un paso de llegar frente a Don Búho Tesorero. ¡Comparte tu propia sabiduría!",
        question:
          "Pregunta abierta (escribe o habla por micrófono): ¿Qué consejo propio le darías a un amigo de 8 o 9 años que quiere ahorrar para un regalo especial?",
        mode: "open_ended",
        options: [],
        openHint:
          "Pista de Tito: Cuéntale cuánto guardar, cómo evitar gastar en dulces o cómo tener paciencia.",
        expectedConcept:
          "Dar un consejo práctico sobre ahorrar parte del dinero, tener paciencia, evitar gastos impulsivos o comparar precios para alcanzar una meta.",
        achievementTitle: "Campeón de la Bóveda",
        achievementDesc: "Compartiste tu propio consejo financiero con claridad.",
      },
    ],
  },
];
