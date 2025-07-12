import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "🚗 Plataforma de Vehículos - API V1",
      version: "1.0.0",
      description:
        "Documentación de endpoints del sistema de control vehicular.",
      contact: {
        name: "Soporte Técnico",
        email: "support@herndevs.com",
      },
    },
    servers: [
      {
        url: "https://autologapi-production.up.railway.app/api",
        description: "Servidor local de desarrollo",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

const swaggerCustomOptions = {
  customCss: `
    /* General body and typography */
    body {
      font-family: 'Inter', sans-serif; /* Usamos una fuente moderna como Inter */
      color: #334155; /* Texto principal oscuro pero suave */
      line-height: 1.6;
    }

    /* Top bar styling */
    .swagger-ui .topbar {
      background-color: #1a202c; /* Un gris oscuro profundo para la barra superior */
      border-bottom: 3px solid #6366f1; /* Línea de acento morada */
    }
    .swagger-ui .topbar .topbar-wrapper img {
      content: url('https://i.imgur.com/a09hkJj.png'); /* Asegúrate de que esta URL sea tu logo final */
      width: 150px; /* Tamaño del logo un poco más pequeño */
      height: auto;
      margin-left: 20px;
    }
    .swagger-ui .topbar .topbar-wrapper span {
      display: none; /* Oculta el texto por defecto de Swagger UI */
    }

    /* Info section (title, description) */
    .swagger-ui .info {
      margin-top: 40px;
      margin-bottom: 40px;
      padding: 0 30px;
      text-align: center; /* Centramos el título y la descripción */
    }
    .swagger-ui .info h2 {
      color: #1a202c; /* Color más oscuro para el título principal */
      font-size: 2.8em; /* Título más grande */
      font-weight: 700;
      margin-bottom: 10px;
    }
    .swagger-ui .info .description {
      color: #475569; /* Un gris más suave para la descripción */
      font-size: 1.1em;
      max-width: 800px;
      margin: 0 auto;
    }

    /* Operation and tags styling */
    .swagger-ui .opblock {
      margin: 0 0 20px;
      border-radius: 8px; /* Bordes más redondeados */
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08); /* Sombra suave para un efecto de elevación */
      background-color: #ffffff; /* Fondo blanco para los bloques de operación */
    }
    .swagger-ui .opblock .opblock-summary {
      border-radius: 8px 8px 0 0;
      padding: 15px 25px;
      background-color: #f8fafc; /* Un fondo muy claro para el resumen */
      border-bottom: 1px solid #e2e8f0;
    }
    .swagger-ui .opblock .opblock-summary-path {
      font-family: 'JetBrains Mono', monospace; /* Fuente monoespaciada para las rutas */
      font-size: 0.95em;
      color: #4f46e5; /* Color morado para las rutas */
      font-weight: 500;
    }
    .swagger-ui .opblock .opblock-summary-description {
      font-size: 1.1em;
      font-weight: 600;
      color: #334155;
    }

    /* Method colors (GET, POST, PUT, DELETE) */
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background-color: #22c55e; } /* Verde vibrante */
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background-color: #3b82f6; } /* Azul eléctrico */
    .swagger-ui .opblock.opblock-put .opblock-summary-method { background-color: #f97316; } /* Naranja cálido */
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background-color: #ef4444; } /* Rojo fuerte */
    .swagger-ui .opblock .opblock-summary-method {
      border-radius: 5px;
      padding: 5px 10px;
      font-size: 0.8em;
      font-weight: 700;
      text-transform: uppercase;
      color: #ffffff;
      min-width: 70px;
      text-align: center;
    }

    /* Content and expanded sections */
    .swagger-ui .opblock .opblock-body {
      padding: 20px 25px;
      background-color: #ffffff;
      border-radius: 0 0 8px 8px;
    }
    .swagger-ui .parameters-col_description {
      font-size: 0.9em;
      color: #64748b;
    }

    /* Model and schema styling */
    .swagger-ui .model-box {
      font-family: 'JetBrains Mono', monospace;
      background-color: #f8fafc;
      border-left: 3px solid #6366f1; /* Acento morado */
      border-radius: 4px;
      padding: 15px;
      font-size: 0.9em;
    }
    .swagger-ui .response-col_description__inner pre {
      background-color: #1e293b; /* Fondo oscuro para bloques de código */
      color: #e2e8f0; /* Texto claro */
      border-radius: 6px;
      padding: 15px;
      overflow-x: auto;
    }

    /* Tabs (Parameters, Headers, Responses) */
    .swagger-ui .opblock-body .tab-item {
      font-weight: 600;
      color: #64748b;
      padding: 8px 15px;
      border-bottom: 2px solid transparent;
      transition: all 0.3s ease;
    }
    .swagger-ui .opblock-body .tab-item.active {
      color: #6366f1; /* Morado para la pestaña activa */
      border-bottom-color: #6366f1;
    }
    .swagger-ui .opblock-body .tab-item:hover {
      color: #4f46e5;
    }

    /* Buttons */
    .swagger-ui .btn {
      border-radius: 5px;
      font-weight: 600;
      padding: 8px 15px;
      transition: all 0.3s ease;
    }
    .swagger-ui .btn.execute {
      background-color: #6366f1; /* Morado vibrante para el botón de ejecución */
      color: #ffffff;
    }
    .swagger-ui .btn.execute:hover {
      background-color: #4f46e5;
    }
    .swagger-ui .try-out__btn {
      background-color: #e2e8f0; /* Gris claro para el botón 'Try it out' */
      color: #334155;
    }
    .swagger-ui .try-out__btn:hover {
      background-color: #cbd5e1;
    }

    /* Scheme container (Hide if not needed, as per your original code) */
    .swagger-ui .scheme-container {
      display: none;
    }
  `,
  customSiteTitle: "🚗 API Vehículos", // Título más conciso para la pestaña del navegador
  customfavIcon: "https://i.imgur.com/a09hkJj.png", // Asegúrate de que esta URL sea tu favicon final
  swaggerOptions: {
    docExpansion: "none", // Pestañas cerradas por defecto
    defaultModelsExpandDepth: -1, // Oculta la sección de modelos por defecto
    displayRequestDuration: true, // Muestra el tiempo de respuesta de las solicitudes
    filter: true, // Habilita el filtro de endpoints
    persistAuthorization: true, // Mantiene el token de autorización al recargar
  },
};

export { swaggerUi, swaggerSpec, swaggerCustomOptions };
