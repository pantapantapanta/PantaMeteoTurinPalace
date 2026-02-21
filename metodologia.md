# PantaMeteo — Nota metodologica

## Panoramica

PantaMeteo è un cruscotto meteorologico multi-provider che aggrega le previsioni di **13 modelli numerici** operativi di previsione meteorologica (NWP), provenienti dai principali servizi meteorologici nazionali e internazionali. La previsione finale visualizzata è una **media ponderata** dei 13 modelli, dove i pesi sono determinati da un sistema di calibrazione automatica basato sulla performance storica di ciascun modello per la specifica località selezionata. I pesi sono calcolati **separatamente per ciascuna variabile meteorologica** (temperatura, precipitazione, vento, direzione del vento, weather code), riconoscendo che un modello può eccellere in una variabile e sottoperformare in un'altra.

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

Non tutti i modelli performano allo stesso modo in ogni località, né la performance di un modello è necessariamente uniforme su tutte le variabili meteorologiche. Un modello può eccellere nella previsione della temperatura ma sottostimare le precipitazioni, o viceversa.

Il sistema di calibrazione affronta questo problema **misurando empiricamente** la performance di ciascun modello per ogni specifica località **e per ciascuna variabile**, assegnando pesi maggiori ai modelli che storicamente si sono dimostrati più accurati in quel punto e per quella specifica grandezza.

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

### Calcolo del MAE per variabile

Per ciascun modello *m*, ciascuna località e ciascuna variabile, il sistema calcola il **MAE** (errore medio assoluto) sugli ultimi **30 giorni** (con un offset di 7 giorni per tenere conto del ritardo di aggiornamento di ERA5).

Le variabili valutate e le rispettive metriche sono:

| Variabile | Metrica giornaliera | Note |
|-----------|-------------------|-------|
| **Temperatura** | (|Tmax_m − Tmax_ERA5| + |Tmin_m − Tmin_ERA5|) / 2 | Media dell'errore su massima e minima |
| **Precipitazione** | |Prec_m − Prec_ERA5| | Precipitazione cumulata giornaliera (mm) |
| **Velocità del vento** | |Wind_m − Wind_ERA5| | Velocità massima giornaliera (km/h) |
| **Direzione del vento** | min(|Dir_m − Dir_ERA5|, 360 − |Dir_m − Dir_ERA5|) | MAE circolare per gestire il wrap-around a 360° |

Il MAE del modello per ciascuna variabile è la media degli errori giornalieri:

**MAE_v(m) = Σ err_v(m, d) / N**

dove N è il numero di giorni con dati validi (minimo 3).

### Dai MAE ai pesi per variabile

La trasformazione dal MAE ai pesi finali avviene **indipendentemente per ciascuna variabile**, in quattro passaggi:

1. **Inversione**: peso_grezzo = 1 / MAE — chi sbaglia meno pesa di più
2. **Compressione**: peso = √(peso_grezzo) — la radice quadrata comprime le differenze estreme, evitando che un singolo modello domini eccessivamente
3. **Normalizzazione**: i pesi sono scalati affinché la media sia pari a 1.0
4. **Cap**: ogni peso è limitato nell'intervallo **[0.5, 1.5]** — nessun modello può pesare più di 3 volte un altro

Il risultato è un set di **cinque vettori di pesi**:

| Vettore | Applicato a |
|---------|------------|
| **temp** | Temperature (massima, minima, oraria) |
| **precip** | Precipitazione, neve, probabilità di precipitazione |
| **wind** | Velocità del vento |
| **wind_dir** | Direzione del vento |
| **wx** | Weather code (icona meteo) — calcolato come media dei pesi temperatura e precipitazione |

I pesi per il **weather code** sono derivati dalla media dei pesi temperatura e precipitazione, poiché le condizioni meteorologiche sinottiche dipendono da entrambe le variabili.

Questa scelta progettuale — pesi separati per variabile — riflette il principio che la skill di un modello non è monodimensionale. Un modello può essere il migliore della classe nella previsione della temperatura ma mediocre nelle precipitazioni, e viceversa. I pesi per-variabile catturano queste differenze, producendo una previsione sintetica più accurata su ogni singola grandezza.

La diversificazione tra modelli, analogamente a quanto avviene nella diversificazione di un portafoglio di investimenti, tende a ridurre l'errore complessivo.

### Cache

I pesi calibrati sono conservati in cache locale per 12 ore, evitando chiamate API ripetute. La ricalibrazione avviene automaticamente alla scadenza della cache o al cambio di località.

---

## Visualizzazione del consenso tra provider

Oltre alla media ponderata, PantaMeteo visualizza il **grado di consenso tra i provider** attraverso un sistema di colorazione delle linee nei grafici orari e dei bordi delle card giornaliere. Per ogni ora (o giorno), il sistema calcola lo **spread** — la differenza tra il valore massimo e il valore minimo previsti dai provider — e lo confronta con soglie specifiche per variabile:

| Variabile | 🟢 Consenso alto | 🟡 Consenso medio | 🔴 Consenso basso |
|-----------|-----------------|-------------------|-------------------|
| Temperatura | spread ≤ 1.5 °C | spread ≤ 3 °C | spread > 3 °C |
| Precipitazione | spread ≤ 2 mm | spread ≤ 8 mm | spread > 8 mm |
| Vento | spread ≤ 5 km/h | spread ≤ 12 km/h | spread > 12 km/h |

Le soglie riflettono la diversa significatività operativa delle variabili: un disaccordo di 2°C tra modelli è rilevante per le decisioni quotidiane, mentre uno spread di 2 mm di pioggia ha un impatto minore. Le soglie del vento sono calibrate sulla scala in cui le differenze diventano percepibili e rilevanti per attività all'aperto.

Questo indicatore fornisce una misura intuitiva dell'**incertezza** della previsione, informazione che i servizi meteo tradizionali raramente comunicano all'utente finale.

---

## Fonti dati aggiuntive

### Weather Underground — Personal Weather Stations (PWS)

Per le località configurate dall'utente, PantaMeteo può visualizzare dati osservati in tempo reale provenienti da stazioni meteorologiche personali (PWS) registrate sulla rete [Weather Underground](https://www.wunderground.com/). L'utente può aggiungere una o più stazioni tramite il relativo Station ID. Questi dati provengono da sensori fisici locali e sono completamente indipendenti da qualsiasi modello numerico.

### METAR

I dati [METAR](https://aviationweather.gov/) (METeorological Aerodrome Report) delle stazioni dell'Aeronautica Militare italiana e di altri aeroporti internazionali forniscono un ulteriore punto di osservazione ufficiale, aggiornato ogni 20–60 minuti.

---

## Limiti noti

- **Risoluzione ERA5** (9 km): sufficiente per la maggior parte delle località, ma può non catturare microclimi urbani o effetti orografici su scala inferiore
- **Latenza ERA5**: il dataset ha un ritardo di 5–7 giorni, quindi la calibrazione non include i giorni più recenti
- **Finestra di 30 giorni**: un periodo più lungo migliorerebbe la robustezza statistica ma ridurrebbe la reattività a cambiamenti stagionali nella performance dei modelli
- **Precipitazione**: è la variabile più difficile da prevedere e da osservare; la calibrazione basata sulla precipitazione è meno affidabile di quella basata sulla temperatura
- **Direzione del vento**: soggetta a elevata variabilità locale; il MAE circolare mitiga il problema del wrap-around ma la calibrazione resta meno stabile rispetto alle altre variabili

---

## Stack tecnico

| Componente | Tecnologia |
|-----------|-----------|
| Previsioni multi-modello | [Open-Meteo Forecast API](https://open-meteo.com/en/docs) |
| Dati storici dei modelli | [Open-Meteo Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api) |
| Ground truth (calibrazione) | [Open-Meteo Archive API](https://open-meteo.com/en/docs/historical-weather-api) → ERA5-Land |
| Osservazioni locali | [Weather Underground PWS API](https://www.wunderground.com/) |
| METAR | [Aviation Weather Center (AWC)](https://aviationweather.gov/) |
| Frontend | HTML/CSS/JS vanilla, SVG charts |
| Proxy server | Node.js (Render) |

---

*PantaMeteo — Previsioni meteo multi-provider con calibrazione skill-based per variabile*
