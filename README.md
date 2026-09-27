# Mis Finanzas

App personal de finanzas para Colombia: registra ingresos y gastos, controla tarjetas
y cupos, lleva préstamos y deudas, metas de ahorro y presupuestos. Todo se guarda
**en el dispositivo** — no hay servidor, ni cuentas, ni sincronización en la nube.

Hecha con **React + Vite** y empaquetada como app Android con **Capacitor**.

## Capturas

Los datos que se ven son de demostración.

| Dashboard | Movimientos | Estadísticas |
|---|---|---|
| <img src="docs/screenshots/01-dashboard.png" width="230"> | <img src="docs/screenshots/02-movimientos.png" width="230"> | <img src="docs/screenshots/03-estadisticas.png" width="230"> |
| Balance del mes, patrimonio por cuenta y la gráfica de ingresos vs. gastos. | Historial con filtros, método de pago por movimiento y préstamos por cobrar. | Resumen, tasa de ahorro y reparto del gasto por categoría. |

| Cuentas y tarjetas | Score de crédito | Préstamos |
|---|---|---|
| <img src="docs/screenshots/04-cuentas.png" width="230"> | <img src="docs/screenshots/05-credito.png" width="230"> | <img src="docs/screenshots/06-prestamos.png" width="230"> |
| Saldos, cupos y porcentaje de uso de cada tarjeta. | Utilización del cupo, score estimado y guía por tramos. | Capital, interés, cuotas y registro de abonos parciales. |

<img src="docs/screenshots/07-agregar.png" width="230" align="right">

**Nuevo movimiento** — gasto o ingreso, con categoría, cuenta de origen (o reparto
entre varias), método de pago, nota y fecha. Cada cuenta muestra su saldo o cupo
disponible en el mismo selector.

<br clear="right">

## Funciones

- **Dashboard** — balance, ingresos vs. gastos y gráfica de área con periodos (día, semana, 15 días, mes, año o rango personalizado).
- **Movimientos** — alta de ingresos/gastos con categoría, método de pago, fecha y cuenta de origen. Soporta **pago dividido** entre varias cuentas, validando fondos y cupo disponible.
- **Cuentas y tarjetas** — débito, ahorros, efectivo y crédito, con logos de bancos y billeteras colombianas (Bancolombia, Nequi, Daviplata, Davivienda, BBVA, Banco de Bogotá, Occidente) o logo propio subido por el usuario.
- **Crédito** — utilización del cupo, score estimado, planes de compras a cuotas y gastos recurrentes mensuales.
- **Consejos** — análisis local por reglas sobre utilización, balance y categoría de mayor gasto, con sugerencia de qué tarjeta pagar primero. No usa ninguna API externa.
- **Préstamos y deudas** — dinero que prestaste y dinero que te prestaron, con interés simple o compuesto, plazos y abonos parciales.
- **Metas, presupuestos y categorías** — personalizables.
- **Exportar / importar** — respaldo en CSV compartible desde Android.

## Privacidad

Los datos viven solo en el teléfono: `localStorage` en web y **Capacitor Preferences**
(`SharedPreferences` nativo) en Android, que sobrevive a la limpieza de caché del WebView.
La app no hace peticiones de red; el único permiso Android es `INTERNET`, requerido por el WebView.

## Stack

| | |
|---|---|
| UI | React 19, Recharts, Inter (`@fontsource`) |
| Build | Vite 8 |
| Móvil | Capacitor 8 (`app`, `preferences`, `filesystem`, `share`, `status-bar`) |
| Lint | ESLint 10 |

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # compila a dist/
npm run preview  # sirve dist/
npm run lint
```

## Android

```bash
npm run build
npx cap sync android
npx cap open android      # abre Android Studio
```

El **keystore de firma (`*.jks`) no está en el repositorio** y no debe subirse.
Guárdalo aparte junto con sus contraseñas; sin él no se pueden publicar
actualizaciones del mismo app ID (`com.andrey.finanzas`) en Play Store.

Los iconos y el splash se regeneran desde `assets/icon.png` y `assets/splash.png`:

```bash
npx @capacitor/assets generate --android
```

## Estructura

```
src/App.jsx     toda la app (vistas, estado, persistencia)
src/*.css       estilos base y reset
assets/         icono y splash fuente para @capacitor/assets
android/        proyecto nativo generado por Capacitor
```
