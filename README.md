# PantaMeteo

Cruscotto meteorologico multi-provider con calibrazione skill-based per variabile. Aggrega le previsioni di 13 modelli numerici operativi, pesandoli in base alla performance storica per ciascuna località e variabile meteorologica.

## Modelli integrati

| Modello | Ente | Paese | Risoluzione |
|---------|------|-------|-------------|
| ECMWF IFS | European Centre for Medium-Range Weather Forecasts | Internazionale | 9 km |
| ECMWF AIFS | ECMWF (AI-based) | Internazionale | 25 km |
| GFS | NOAA / National Weather Service | USA | 25 km |
| ICON | Deutscher Wetterdienst (DWD) | Germania | 13 km |
| ARPEGE/AROME | Météo-France | Francia | 25 km |
| GSM | Japan Meteorological Agency (JMA) | Giappone | 33 km |
| GEM | Canadian Meteorological Centre (CMC) | Canada | 25 km |
| UKMO | Met Office | Regno Unito | 10 km |
| ICON-2I | ItaliaMeteo / ARPAE | Italia | 2 km |
| Harmonie | KNMI | Paesi Bassi | 2.5 km |
| ICON-CH2 | MeteoSwiss | Svizzera | 2 km |
| Harmonie | DMI | Danimarca | 2 km |
| MetCoOp | MET Norway | Norvegia | 1 km |

## Funzionalità

- Media ponderata di 13 modelli previsionali (globali + regionali ad alta risoluzione)
- Calibrazione automatica per variabile: pesi separati per temperatura, precipitazione, vento, direzione del vento e weather code
- Ground truth indipendente: ERA5-Land reanalysis (Copernicus/ECMWF)
- Panoramica 15 giorni con indicatore di consenso tra provider (alto/medio/basso)
- Vista Sintesi (grafici orari temperatura, pioggia, vento) e Vista Confronto (dettaglio per modello)
- Colorazione consenso: verde (accordo), giallo (incertezza), rosso (forte disaccordo)
- Dati live da stazioni METAR (Aeronautica Militare e aeroporti internazionali)
- Dati live da Weather Underground Personal Weather Stations (PWS)
- Ricerca globale città con geocoding
- Preferiti con auto-aggiunta delle città con stazioni WU
- Nota metodologica integrata
- Dark mode automatico
- PWA installabile

## Dati live

### METAR
Dati osservati dalle stazioni aeroportuali più vicine, aggiornati ogni 20–60 minuti. Fonte: [Aviation Weather Center](https://aviationweather.gov/).

### Weather Underground PWS
Stazioni meteorologiche personali registrate sulla rete Weather Underground. Configurabili dall'utente tramite Station ID (supporto multi-stazione).

## Calibrazione

Il sistema misura la performance storica (ultimi 30 giorni) di ciascun modello contro ERA5-Land, calcolando un MAE separato per temperatura, precipitazione, velocità e direzione del vento. I MAE vengono trasformati in pesi tramite inversione, compressione (√), normalizzazione (media=1) e cap [0.5, 1.5]. I pesi del weather code sono derivati dalla media temperatura + precipitazione. Dettagli completi nella nota metodologica in-app.

## Stack tecnico

| Componente | Tecnologia |
|-----------|-----------|
| Previsioni multi-modello | [Open-Meteo Forecast API](https://open-meteo.com/en/docs) |
| Dati storici modelli | [Open-Meteo Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api) |
| Ground truth | [Open-Meteo Archive API](https://open-meteo.com/en/docs/historical-weather-api) → ERA5-Land |
| Osservazioni locali | [Weather Underground PWS API](https://www.wunderground.com/) |
| METAR | [Aviation Weather Center (AWC)](https://aviationweather.gov/) |
| Frontend | HTML/CSS/JS vanilla, SVG charts |
| Proxy server | Node.js (Render) |

## Deploy

Il progetto richiede un proxy server Node.js per le API esterne (Open-Meteo, WU, METAR).

### Render
1. Push su GitHub
2. render.com > New > Web Service > Collega repo
3. Build Command: `npm install`
4. Start Command: `node server.js`

## Licenza
MIT
