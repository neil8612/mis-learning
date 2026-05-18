// MIS 學習庫 Service Worker v1.0
const CACHE_NAME = 'mis-learning-v1';
const ASSETS = [
  '/mis-learning/',
  '/mis-learning/index.html',
  '/mis-learning/vocab.json',
  '/mis-learning/manifest.json'
];

// ===================== 安裝 =====================
self.addEventListener('install', event => {
  console.log('[SW] 安裝中...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] 快取部分失敗（不影響功能）:', err);
      });
    })
  );
  self.skipWaiting();
});

// ===================== 啟動 =====================
self.addEventListener('activate', event => {
  console.log('[SW] 啟動中...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ===================== 攔截請求（離線支援）=====================
self.addEventListener('fetch', event => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // 更新快取
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      })
      .catch(() => {
        // 網路失敗時用快取
        return caches.match(event.request);
      })
  );
});

// ===================== 背景同步（每天提醒）=====================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
    const { hour, minute } = event.data;
    console.log(`[SW] 設定每日提醒：${hour}:${minute < 10 ? '0' + minute : minute}`);
    scheduleDaily(hour, minute);
  }

  if (event.data && event.data.type === 'CANCEL_REMINDER') {
    console.log('[SW] 取消提醒');
    clearReminder();
  }

  if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    showReminder('測試通知', '如果你看到這個，推播功能正常運作！🎉');
  }
});

// ===================== 排程提醒 =====================
let reminderTimer = null;

function clearReminder() {
  if (reminderTimer) {
    clearTimeout(reminderTimer);
    reminderTimer = null;
  }
}

function scheduleDaily(hour, minute) {
  clearReminder();

  function getNextTriggerMs() {
    // 台灣時間 UTC+8
    const now = new Date();
    const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const twHour = tw.getUTCHours();
    const twMinute = tw.getUTCMinutes();

    let msUntilTrigger = ((hour - twHour) * 60 + (minute - twMinute)) * 60 * 1000;
    if (msUntilTrigger <= 0) msUntilTrigger += 24 * 60 * 60 * 1000; // 明天同一時間
    return msUntilTrigger;
  }

  function scheduleNext() {
    const ms = getNextTriggerMs();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    console.log(`[SW] 下次提醒在 ${h} 小時 ${m} 分鐘後`);

    reminderTimer = setTimeout(() => {
      // 檢查今天是否已經學習
      checkAndNotify(hour, minute);
      // 安排下一次
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}

async function checkAndNotify(hour, minute) {
  try {
    // 透過 clients 取得今日學習狀態
    const allClients = await self.clients.matchAll({ type: 'window' });

    if (allClients.length > 0) {
      // App 有開啟，發訊息問狀態
      allClients[0].postMessage({ type: 'CHECK_DAILY_DONE' });
      return;
    }

    // App 沒開，直接發推播
    showReminder(
      '⚡ MIS 學習庫 — 今日提醒',
      `現在是 ${hour}:${minute < 10 ? '0' + minute : minute}，今天還沒開始學習！點我開始每日學習 📅`
    );
  } catch (e) {
    console.error('[SW] checkAndNotify 失敗:', e);
    showReminder('⚡ MIS 學習庫', '今天記得學習喔！點我開啟 App 📅');
  }
}

function showReminder(title, body) {
  self.registration.showNotification(title, {
    body,
    icon: '/mis-learning/icon-192.png',
    badge: '/mis-learning/icon-192.png',
    tag: 'daily-reminder',
    renotify: true,
    requireInteraction: false,
    data: { url: '/mis-learning/' },
    actions: [
      { action: 'open', title: '開始學習 📅' },
      { action: 'dismiss', title: '稍後提醒' }
    ]
  });
}

// ===================== 點擊通知 =====================
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // 如果 App 已開啟，直接聚焦
      for (const client of clients) {
        if (client.url.includes('mis-learning') && 'focus' in client) {
          return client.focus();
        }
      }
      // 否則開新視窗
      if (self.clients.openWindow) {
        return self.clients.openWindow('/mis-learning/');
      }
    })
  );
});
