# PantaMeteo

Confronto multi-modello delle previsioni meteo in tempo reale + integrazione Tempest Weather Station.

## Modelli confrontati

| Modello | Ente | Risoluzione |
|---------|------|-------------|
| ECMWF IFS | Centro Europeo | 25 km |
| GFS | NOAA (USA) | 25 km |
| ICON | DWD (Germania) | 13 km |
| Meteo-France | MF (Francia) | 25 km |
| JMA | Agenzia Meteo Giappone | 33 km |
| GEM | CMC (Canada) | 25 km |
| UKMO | Met Office (UK) | 10 km |
| **Tempest** | **La tua stazione** | **Locale** |

## Funzionalita

- Confronto 7 modelli previsionali globali + dati Tempest live
- Citta: Milano, Roma, Manduria, San Pietro in Bevagna, Londra + ricerca globale
- Panoramica 7 giorni con indice di concordanza
- Vista Sintesi e Vista Confronto dettagliata
- Banner live Tempest con temperatura, umidita, pressione, vento, UV, radiazione solare
- Token Tempest salvato in localStorage

## Configurazione Tempest

1. Vai su [tempestwx.com](https://tempestwx.com) > Settings > Data Authorizations > Create Token
2. Apri PantaMeteo > clicca "Configura stazione Tempest"
3. Inserisci Token e Station ID > Salva

I dati Tempest appariranno come 8o modello per Milano.

## Deploy

### Render (Static Site)
1. Push su GitHub
2. render.com > New > Static Site > Collega repo
3. Publish Directory: `.`

### GitHub Pages
Settings > Pages > Source: main, root `/`

## Dati

- Previsioni: [Open-Meteo API](https://open-meteo.com/)
- Live: [Tempest WeatherFlow API](https://weatherflow.github.io/Tempest/api/)

## Licenza
MIT
