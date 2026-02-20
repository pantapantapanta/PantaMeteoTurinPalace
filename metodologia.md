# PantaMeteo — Nota metodologica

## Panoramica

PantaMeteo è un cruscotto meteorologico multi-provider che aggrega le previsioni di **13 modelli numerici** operativi di previsione meteorologica (NWP), provenienti dai principali servizi meteorologici nazionali e internazionali. La previsione finale visualizzata è una **media ponderata** dei 13 modelli, dove i pesi sono determinati da un sistema di calibrazione automatica basato sulla performance storica di ciascun modello per la specifica località selezionata.

---

## I modelli di previsione

PantaMeteo integra i seguenti modelli, accessibili tramite le API di [Open-Meteo](https://open-meteo.com/en/docs):

| Modello | Ente | Paese | Risoluzione |
|---------|------|-------|-------------|
| ECMWF IFS | European Centre for Medium-Range Weather Forecasts | 🇪🇺 Internazionale | 9 km |
| ECMWF AIFS | ECMWF (modello AI-based) | 🇪🇺 Internazionale | 25 km |
| GFS | NOAA / National Weather Service | 🇺🇸 USA | 25 km |
| ICON | Deutscher Wetterdienst (DWD) | 🇩🇪 Germania | 13 km |
| ARPEGE/AROME | Météo-France | 🇫🇷 Francia | 25 km |
| GSM | Japan Meteorological Agency (JMA) | 🇯🇵 Giappone | 33 km |
| GEM | Canadian Meteorological Centre (CMC) | 🇨🇦 Canada | 25 km |
| UKMO | Met Office | 🇬🇧 Regno Unito | 10 km |
| ICON-2I | ItaliaMeteo / ARPAE | 🇮🇹 Italia | 2 km |
| Harmonie | KNMI | 🇳🇱 Paesi Bassi | 2.5 km |
| ICON-CH2 | MeteoSwiss | 🇨🇭 Svizzera | 2 km |
| Harmonie | DMI | 🇩🇰 Danimarca | 2 km |
| MetCoOp | MET Norway | 🇳🇴 Norvegia | 1 km |

I modelli regionali ad alta risoluzione (ItaliaMeteo ARPAE, MeteoSwiss, KNMI, DMI, MET Norway) forniscono previsioni particolarmente accurate nelle rispettive aree di competenza, grazie alla capacità di risolvere fenomeni meteorologici locali come brezze, effetti orografici e convezione.

---

## Il sistema di calibrazione

### Principio

Non tutti i modelli performano allo stesso modo in ogni località. Un modello globale può eccellere nelle grandi pianure ma sottostimare gli effetti orografici in aree montane. Analogamente, un modello regionale ad alta risoluzione può essere eccellente nella sua area di copertura ma meno affidabile al di fuori di essa.

Il sistema di calibrazione affronta questo problema **misurando empiricamente** la performance di ciascun modello per ogni specifica località, assegnando pesi maggiori ai modelli che storicamente si sono dimostrati più accurati in quel punto.

### Dati di riferimento: ERA5 reanalysis

Per valutare la qualità delle previsioni è necessario un **dato di verità** (ground truth) indipendente dai modelli di previsione stessi. PantaMeteo utilizza il dataset **ERA5-Land** del Copernicus Climate Change Service (C3S), prodotto dall'ECMWF.

ERA5-Land è un dataset di **rianalisi** meteorologica: una ricostruzione post-hoc dello stato dell'atmosfera basata sull'assimilazione di milioni di osservazioni reali provenienti da:

- Stazioni meteorologiche terrestri
- Boe oceaniche
- Radiosondaggi
- Dati da aerei commerciali (AMDAR)
- Radar meteorologici
- Osservazioni satellitari (infrarosso, microonde, scatterometri)

La rianalisi combina queste osservazioni con modelli fisici dell'atmosfera attraverso tecniche di **assimilazione dati** (4D-Var), producendo un dataset globale coerente e completo a risoluzione di 9 km. Trattandosi di un prodotto basato su osservazioni reali e non sulle previsioni dei modelli operativi in valutazione, ERA5 garantisce l'indipendenza statistica del processo di calibrazione.

**Riferimenti:**
- [ERA5-Land — Copernicus Climate Data Store](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land?tab=overview)
- [ERA5 — ECMWF](https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5)
- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) (endpoint utilizzato per accedere a ERA5)
- Hersbach, H., et al. (2020). *The ERA5 global reanalysis*. Quarterly Journal of the Royal Meteorological Society, 146(730), 1999–2049. [DOI: 10.1002/qj.3803](https://doi.org/10.1002/qj.3803)

### Calcolo del MAE (Mean Absolute Error)

Per ciascun modello *m* e ciascuna località, il sistema calcola il **MAE** (errore medio assoluto) sugli ultimi **30 giorni** (con un offset di 7 giorni per tenere conto del ritardo di aggiornamento di ERA5).

Per ogni giorno *d*, l'errore giornaliero del modello *m* è:

**err(m, d) = ( |Tmax_m − Tmax_ERA5| + |Tmin_m − Tmin_ERA5| + 0.5 × |Prec_m − Prec_ERA5| ) / 2.5**

Dove:
- **Tmax** = temperatura massima giornaliera (°C)
- **Tmin** = temperatura minima giornaliera (°C)
- **Prec** = precipitazione cumulata giornaliera (mm)

La precipitazione è pesata con coefficiente **0.5** (e conta 0.5 nel denominatore) perché è intrinsecamente più variabile e rumorosa rispetto alla temperatura, e un errore di 1 mm di pioggia è meno significativo di un errore di 1°C.

Il MAE del modello è la media degli errori giornalieri:

**MAE(m) = Σ err(m, d) / N**

dove N è il numero di giorni con dati validi (minimo 3).

### Dai MAE ai pesi

La trasformazione dal MAE ai pesi finali avviene in quattro passaggi:

1. **Inversione**: peso_grezzo = 1 / MAE — chi sbaglia meno pesa di più
2. **Compressione**: peso = √(peso_grezzo) — la radice quadrata comprime le differenze estreme, evitando che un singolo modello domini eccessivamente
3. **Normalizzazione**: i pesi sono scalati affinché la media sia pari a 1.0
4. **Cap**: ogni peso è limitato nell'intervallo **[0.5, 1.5]** — nessun modello può pesare più di 3 volte un altro

Questa scelta progettuale riflette il principio che anche il modello meno performante per una data località può occasionalmente catturare fenomeni che altri modelli mancano. La diversificazione tra modelli, analogamente a quanto avviene nella diversificazione di un portafoglio di investimenti, tende a ridurre l'errore complessivo.

### Cache

I pesi calibrati sono conservati in cache locale per 12 ore, evitando chiamate API ripetute. La ricalibrazione avviene automaticamente alla scadenza della cache o al cambio di località.

---

## Visualizzazione della concordanza

Oltre alla media ponderata, PantaMeteo visualizza il **grado di concordanza** tra i modelli attraverso un sistema di colorazione delle linee nei grafici orari. Per ogni ora, il sistema calcola lo **spread** — la differenza tra il valore massimo e il valore minimo previsti dai 13 modelli — e lo confronta con soglie specifiche per variabile:

| Variabile | 🟢 Alta affidabilità | 🟡 Media | 🔴 Bassa |
|-----------|---------------------|----------|----------|
| Temperatura | spread ≤ 1.5 °C | spread ≤ 3 °C | spread > 3 °C |
| Precipitazione | spread ≤ 2 mm | spread ≤ 8 mm | spread > 8 mm |
| Vento | spread ≤ 5 km/h | spread ≤ 12 km/h | spread > 12 km/h |

Le soglie riflettono la diversa significatività operativa delle variabili: un disaccordo di 2°C tra modelli è rilevante per le decisioni quotidiane, mentre uno spread di 2 mm di pioggia ha un impatto minore. Le soglie del vento sono calibrate sulla scala in cui le differenze diventano percepibili e rilevanti per attività all'aperto.

Questo indicatore fornisce una misura intuitiva dell'**incertezza** della previsione, informazione che i servizi meteo tradizionali raramente comunicano all'utente finale.

---

## Fonti dati aggiuntive

### Tempest Weather Station

Per le località dotate di una stazione [Tempest](https://business.tempest.earth/) (WeatherFlow), PantaMeteo visualizza i dati osservati in tempo reale: temperatura attuale, temperatura percepita e condizioni correnti. Questi dati provengono da sensori fisici locali e sono completamente indipendenti da qualsiasi modello numerico.

### METAR

I dati [METAR](https://aviationweather.gov/) (METeorological Aerodrome Report) delle stazioni dell'Aeronautica Militare italiana e di altri aeroporti internazionali forniscono un ulteriore punto di osservazione ufficiale, aggiornato ogni 20–60 minuti.

---

## Limiti noti

- **Risoluzione ERA5** (9 km): sufficiente per la maggior parte delle località, ma può non catturare microclimi urbani o effetti orografici su scala inferiore
- **Latenza ERA5**: il dataset ha un ritardo di 5–7 giorni, quindi la calibrazione non include i giorni più recenti
- **Finestra di 30 giorni**: un periodo più lungo migliorerebbe la robustezza statistica ma ridurrebbe la reattività a cambiamenti stagionali nella performance dei modelli
- **Precipitazione**: è la variabile più difficile da prevedere e da osservare; la calibrazione basata sulla precipitazione è meno affidabile di quella basata sulla temperatura

---

## Stack tecnico

| Componente | Tecnologia |
|-----------|-----------|
| Previsioni multi-modello | [Open-Meteo Forecast API](https://open-meteo.com/en/docs) |
| Dati storici dei modelli | [Open-Meteo Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api) |
| Ground truth (calibrazione) | [Open-Meteo Archive API](https://open-meteo.com/en/docs/historical-weather-api) → ERA5-Land |
| Osservazioni locali | [WeatherFlow Tempest API](https://weatherflow.github.io/Tempest/api/) |
| METAR | [Aviation Weather Center (AWC)](https://aviationweather.gov/) |
| Frontend | HTML/CSS/JS vanilla, SVG charts |
| Proxy server | Node.js (Render) |

---

*PantaMeteo — Previsioni meteo multi-provider con calibrazione skill-based*
