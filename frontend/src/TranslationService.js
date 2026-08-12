import i18n from './i18n';

// Obje düzleştirme (nested -> flat)
function flattenObject(ob) {
  var toReturn = {};
  for (var i in ob) {
    if (!ob.hasOwnProperty(i)) continue;
    if ((typeof ob[i]) == 'object' && ob[i] !== null) {
      var flatObject = flattenObject(ob[i]);
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;
        toReturn[i + '.' + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
}

// Düzleştirilmiş objeyi geri iç içe (nested) hale getirme
function unflattenObject(ob) {
  var result = {};
  for (var i in ob) {
    var keys = i.split('.');
    keys.reduce(function(r, e, j) {
      return r[e] || (r[e] = isNaN(Number(keys[j + 1])) ? (keys.length - 1 == j ? ob[i] : {}) : []);
    }, result);
  }
  return result;
}

/**
 * Türkçeden (veya ana dilden) hedef dile dinamik çeviri yapar.
 * Google Translate'in ücretsiz GTX API'sini kullanır.
 * 
 * @param {string} targetLang - Hedef dil kodu (örn. 'ja', 'hi', 'zh-CN')
 */
export async function loadDynamicTranslations(targetLang) {
  // Eğer tr ve en ise çeviriye gerek yok.
  if (targetLang === 'tr' || targetLang === 'en') return true;
  
  // TR sözlüğünü al
  const baseDict = i18n.global.getLocaleMessage('tr');
  const flatDict = flattenObject(baseDict);
  const keys = Object.keys(flatDict);
  const values = keys.map(k => flatDict[k]);

  // Önce Cache (Önbellek) kontrolü - eğer yeni eklenen key'ler varsa önbellek yenilenir
  const cacheKey = `dms_lang_${targetLang}_v3`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const cachedFlat = flattenObject(parsed);
      if (Object.keys(cachedFlat).length >= keys.length) {
        i18n.global.setLocaleMessage(targetLang, parsed);
        return true;
      }
    } catch (e) {
      console.error('Cache parsing error', e);
    }
  }
  
  if (values.length === 0) return false;

  // Çeviri API'si limiti nedeniyle metinleri "\n|||\n" ayıracı ile birleştirip toplu gönderiyoruz.
  // URL uzunluk limitine takılmamak için POST isteği kullanıyoruz.
  const delimiter = '\n|||\n';
  const textToTranslate = values.join(delimiter);

  try {
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=${targetLang}&dt=t`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'q=' + encodeURIComponent(textToTranslate)
    });

    const data = await response.json();
    
    // Yanıt formatı: data[0] içinde parçalar halinde array
    let translatedText = '';
    if (data && data[0]) {
      data[0].forEach(part => {
        if (part[0]) translatedText += part[0];
      });
    }

    const translatedValues = translatedText.split('|||').map(s => s.trim());
    
    // Eşleştirme (Bazen API ayıracı bozabilir, o yüzden en az keys.length kadar mı kontrolü)
    if (translatedValues.length >= values.length) {
      const newFlatDict = {};
      keys.forEach((key, index) => {
        newFlatDict[key] = translatedValues[index];
      });

      const nestedDict = unflattenObject(newFlatDict);
      
      // Cache'e kaydet ve i18n'e ekle
      localStorage.setItem(cacheKey, JSON.stringify(nestedDict));
      i18n.global.setLocaleMessage(targetLang, nestedDict);
      return true;
    } else {
      console.warn(`Translation mismatch: Expected ${values.length}, got ${translatedValues.length}.`);
      return false;
    }
  } catch (error) {
    console.error('Dynamic translation failed:', error);
    return false;
  }
}
