const { PrayerTiming } = require('../models');
const logger = require('../utils/logger');
const { success, error } = require('../utils/response');

const PRAYER_META = {
  Fajr: 'Fajr', Sunrise: 'Sunrise', Dhuhr: 'Dhuhr',
  Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha', Imsak: 'Imsak',
};

const SHOW_KEYS = ['Tahajjud', 'Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Iftar', 'Maghrib', 'Isha'];

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function calculateTahajjud(timings) {
  const ishaMin = toMinutes(timings.Isha.replace(/\s*\(.*\)/, '').trim());
  const fajrMin = toMinutes(timings.Fajr.replace(/\s*\(.*\)/, '').trim());
  const nightDur = (fajrMin + 1440 - ishaMin) % 1440;
  const tahajjudMin = (ishaMin + Math.floor(nightDur * 2 / 3)) % 1440;
  return `${String(Math.floor(tahajjudMin / 60)).padStart(2, '0')}:${String(tahajjudMin % 60).padStart(2, '0')}`;
}

const FALLBACK_TIMINGS = {
  Imsak: '04:38', Fajr: '04:48', Sunrise: '06:10',
  Dhuhr: '12:35', Asr: '16:00', Maghrib: '18:45', Isha: '20:00',
};
const FALLBACK_TAHAJJUD = '03:00';
const FALLBACK_HIJRI = 'Ramadan 1447 AH';

const CITY = 'Bangalore';
const COUNTRY = 'India';
const COORDS = { latitude: 12.9716, longitude: 77.5946 };

function getISTDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function formatTimeIST(date) {
  const totalMin = date.getUTCMinutes() + 330;
  const h = (date.getUTCHours() + Math.floor(totalMin / 60)) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function computeLocalTimings() {
  const adhan = await import('adhan');
  const { PrayerTimes, Coordinates, CalculationMethod, Madhab } = adhan;
  const now = new Date();
  const p = new PrayerTimes(
    new Coordinates(COORDS.latitude, COORDS.longitude),
    now,
    CalculationMethod.Karachi(),
    Madhab.Hanafi
  );
  const timings = {
    Imsak: formatTimeIST(new Date(p.fajr.getTime() - 10 * 60000)),
    Fajr: formatTimeIST(p.fajr),
    Sunrise: formatTimeIST(p.sunrise),
    Dhuhr: formatTimeIST(p.dhuhr),
    Asr: formatTimeIST(p.asr),
    Maghrib: formatTimeIST(p.maghrib),
    Iftar: formatTimeIST(p.maghrib),
    Isha: formatTimeIST(p.isha),
    Midnight: p.midnight ? formatTimeIST(p.midnight) : '23:59',
  };
  const parts = {};
  for (const part of new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
  }).formatToParts(now)) {
    parts[part.type] = part.value;
  }
  return { timings, hijri: `${parts.day} ${parts.month} ${parts.year} AH` };
}

async function fetchAndSavePrayerTimings() {
  try {
    const dateStr = getISTDate();

    const existing = await PrayerTiming.findOne({ where: { date: dateStr } });
    if (existing) return existing;

    let data = null;
    let source = 'local calculation';
    try {
      const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(CITY)}&country=${encodeURIComponent(COUNTRY)}&method=1&school=1`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const json = await res.json();
      if (json?.data?.timings) {
        data = json.data;
        source = 'AlAdhan API';
      }
    } catch (err) {
      logger.warn(`AlAdhan API unavailable (${err.message}); using local calculation`);
    }

    let timings;
    let hijri;
    if (data) {
      timings = data.timings;
      hijri = data.date?.hijri ? `${data.date.hijri.day} ${data.date.hijri.month.en} ${data.date.hijri.year} AH` : null;
    } else {
      const local = await computeLocalTimings();
      timings = local.timings;
      hijri = local.hijri;
    }

    const tahajjudTime = calculateTahajjud(timings);

    const record = await PrayerTiming.create({
      date: dateStr,
      city: CITY,
      country: COUNTRY,
      timings: JSON.stringify(timings),
      tahajjud_time: tahajjudTime,
      date_hijri: hijri,
    });

    logger.info(`Prayer timings saved for ${dateStr} (${source})`);
    return record;
  } catch (err) {
    logger.error('fetchAndSavePrayerTimings error:', err.message);
    throw err;
  }
}

function getFallbackRecord(dateStr) {
  return {
    date: dateStr,
    city: 'Bangalore',
    country: 'India',
    timings: JSON.stringify(FALLBACK_TIMINGS),
    tahajjud_time: FALLBACK_TAHAJJUD,
    date_hijri: FALLBACK_HIJRI,
  };
}

function processTimingsForResponse(record) {
  let timings;
  try {
    timings = typeof record.timings === 'string' ? JSON.parse(record.timings) : record.timings;
  } catch {
    timings = {};
  }

  const clean = (t) => (t || '').replace(/\s*\(.*\)/, '').trim();
  const tahajjudTime = record.tahajjud_time || calculateTahajjud(timings);

  const slots = SHOW_KEYS.map((key) => {
    const srcKey = key === 'Iftar' ? 'Maghrib' : key === 'Tahajjud' ? null : key;
    const rawTime = key === 'Tahajjud' ? tahajjudTime : clean(timings[srcKey] || '00:00');
    return { key, time: rawTime };
  });

  slots.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

  return {
    date: record.date,
    city: record.city,
    country: record.country,
    date_hijri: record.date_hijri,
    slots,
  };
}

const getPrayerTimings = async (req, res) => {
  try {
    const today = getISTDate();
    let record = await PrayerTiming.findOne({ where: { date: today } });

    if (!record) {
      try {
        record = await fetchAndSavePrayerTimings();
      } catch {
        logger.warn('Using fallback prayer timings for ' + today);
        const data = processTimingsForResponse(getFallbackRecord(today));
        return success(res, data);
      }
    }

    const data = processTimingsForResponse(record);
    return success(res, data);
  } catch (err) {
    logger.error('getPrayerTimings error:', err.message);
    const today = getISTDate();
    const data = processTimingsForResponse(getFallbackRecord(today));
    return success(res, data);
  }
};

const refreshPrayerTimings = async (req, res) => {
  try {
    const record = await fetchAndSavePrayerTimings();
    const data = processTimingsForResponse(record);
    return success(res, data, 'Prayer timings refreshed');
  } catch (err) {
    logger.error('refreshPrayerTimings error:', err.message);
    return error(res, 'Failed to refresh prayer timings', 500);
  }
};

module.exports = { getPrayerTimings, refreshPrayerTimings, fetchAndSavePrayerTimings };
