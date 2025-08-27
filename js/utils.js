/**
 * js/utils.js
 * * يحتوي هذا الملف على دوال مساعدة متنوعة تستخدم في جميع أنحاء التطبيق.
 */

/**
 * يولد معرفًا فريدًا عالميًا (UUID v4).
 * @returns {string} سلسلة UUID.
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * يولد معرفًا يوميًا فريدًا بناءً على التاريخ الحالي.
 * @param {string} prefix - البادئة للمعرّف (مثل 'S' للمبيعات).
 * @param {Array} collection - المجموعة للتحقق من المعرّفات الموجودة.
 * @returns {string} معرّف يومي فريد.
 */
export function getDailyId(prefix, collection) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const itemsOnDate = collection.filter(item => (item.createdAt || item.date || '').startsWith(date));
    const nextId = itemsOnDate.length + 1;
    return `${prefix}${date.replace(/-/g, '')}-${nextId}`;
}

/**
 * [--- إضافة ---]
 * دالة جديدة للحصول على تاريخ اليوم الحالي بالتنسيق الصحيح (YYYY-MM-DD).
 * تتجنب هذه الدالة مشاكل المنطقة الزمنية التي قد تحدث مع toISOString().
 * @returns {string} تاريخ اليوم الحالي.
 */
export function getCurrentDateAsYYYYMMDD() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // الأشهر تبدأ من 0
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


/**
 * يحسب الكمية الإجمالية لمنتج معين عبر جميع الألوان والمقاسات.
 * @param {object} product - كائن المنتج.
 * @returns {number} الكمية الإجمالية.
 */
export function getProductTotalQuantity(product) {
    if (!product || !product.colors) return 0;
    return Object.values(product.colors).reduce((total, colorData) => {
        const colorTotal = Object.values(colorData.sizes || {}).reduce((sum, size) => sum + size.quantity, 0);
        return total + colorTotal;
    }, 0);
}

/**
 * يعرض شاشة التحميل.
 */
export function showLoader() {
    document.getElementById('loader-overlay')?.classList.remove('hidden');
}

/**
 * يخفي شاشة التحميل.
 */
export function hideLoader() {
    document.getElementById('loader-overlay')?.classList.add('hidden');
}

/**
 * يعرض إشعارًا مؤقتًا.
 * @param {string} message - الرسالة المراد عرضها.
 * @param {string} type - نوع الإشعار ('success', 'error', 'info').
 */
export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const typeClasses = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };
    notification.className = `fixed top-5 right-5 ${typeClasses[type]} text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-pulse`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

/**
 * [--- إضافة ---]
 * يعرض إشعارًا مع زر تراجع.
 * @param {string} message - الرسالة المراد عرضها.
 * @param {function} onUndo - الدالة التي سيتم استدعاؤها عند الضغط على زر التراجع.
 */
export function showUndoNotification(message, onUndo) {
    // إزالة أي إشعار تراجع قديم أولاً
    const existingUndo = document.getElementById('undo-notification');
    if (existingUndo) {
        existingUndo.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'undo-notification';
    notification.className = 'fixed bottom-5 right-5 bg-gray-800 text-white p-4 rounded-lg shadow-lg flex items-center justify-between z-50';
    notification.style.minWidth = '300px';

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    notification.appendChild(messageSpan);

    const undoButton = document.createElement('button');
    undoButton.textContent = 'Undo';
    undoButton.className = 'ml-4 text-blue-400 hover:text-blue-300 font-bold';
    notification.appendChild(undoButton);

    document.body.appendChild(notification);

    const timeoutId = setTimeout(() => {
        notification.remove();
    }, 10000); // 10 ثوانٍ

    undoButton.addEventListener('click', () => {
        clearTimeout(timeoutId);
        notification.remove();
        onUndo(); // استدعاء دالة التراجع
    });
}
