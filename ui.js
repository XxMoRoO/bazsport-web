/**
 * js/ui.js
 * * يحتوي هذا الملف على جميع الدوال المسؤولة عن عرض وتحديث واجهة المستخدم (DOM manipulation).
 */

import { state, translations } from './state.js';
import { getProductTotalQuantity, getCurrentDateAsYYYYMMDD } from './utils.js';

// --- دوال عرض وتحديث الواجهة الرسومية ---
export function updateAdminUI() {
    document.body.classList.toggle('admin-mode', state.isAdminMode);
    if (!state.isAdminMode && (state.currentPage === 'inventory-page' || state.currentPage === 'history-page' || state.currentPage === 'customers-page' || state.currentPage === 'salaries-page' || state.currentPage === 'best-sellers-page' || state.currentPage === 'defects-page' || state.currentPage === 'suppliers-page' || state.currentPage === 'shifts-page')) {
        state.currentPage = 'home-page';
    }
}

export function updateUIText() {
    const lang = state.lang;
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-lang-key]').forEach(el => {
        const key = el.dataset.langKey;
        if (translations[lang]?.[key]) {
            if (el.placeholder !== undefined) {
                el.placeholder = translations[lang][key];
            } else if (el.title !== undefined) {
                el.title = translations[lang][key];
            }
            else {
                el.textContent = translations[lang][key];
            }
        }
    });
    document.getElementById('lang-switcher-text').textContent = lang === 'en' ? 'EN' : 'AR';
}

export function render() {
    updateAdminUI();

    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const currentPageElement = document.getElementById(state.currentPage);
    if (currentPageElement) {
        currentPageElement.classList.remove('hidden');
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.id !== 'admin-mode-btn') {
            link.classList.toggle('active', link.dataset.page === state.currentPage);
        }
    });
    document.getElementById('admin-mode-btn').classList.toggle('active', state.isAdminMode);

    if (state.currentPage === 'home-page' || state.currentPage === 'inventory-page') {
        renderCategoryTabs();
    }
    if (state.currentPage === 'home-page') renderProductGallery();
    if (state.currentPage === 'inventory-page') renderInventoryTable();
    if (state.currentPage === 'selling-page') renderSellingPage();
    if (state.currentPage === 'booking-page') renderBookingPage();
    if (state.currentPage === 'history-page') renderSalesHistory();
    if (state.currentPage === 'customers-page') renderCustomersPage();
    if (state.currentPage === 'salaries-page') renderSalariesPage();
    if (state.currentPage === 'best-sellers-page') renderBestSellersPage();
    if (state.currentPage === 'defects-page') renderDefectsPage();
    if (state.currentPage === 'suppliers-page') renderSuppliersPage();
    if (state.currentPage === 'settings-page') renderSettingsPage();
    if (state.currentPage === 'shifts-page') renderShiftsPage();
    // هذا الكود يعيد تعيين فلتر التاريخ إلى اليوم الحالي عند فتح صفحة اليوميات
    if (state.currentPage === 'shifts-page') {
        state.shiftDateFilter = getCurrentDateAsYYYYMMDD();
    }

    if (state.currentPage === 'home-page' || state.currentPage === 'inventory-page') {
        renderCategoryTabs();
    }



    updateUIText();
    updateCartIconCount();
}

function renderCategoryTabs() {
    const homeTabs = document.getElementById('home-category-tabs');
    const invTabs = document.getElementById('inventory-category-tabs');
    if (!homeTabs || !invTabs) return;
    homeTabs.innerHTML = '';
    invTabs.innerHTML = '';
    state.categories.forEach(category => {
        const tab = document.createElement('div');
        tab.className = `category-tab ${state.activeCategory === category ? 'active' : ''}`;
        tab.textContent = category;
        tab.dataset.category = category;
        homeTabs.appendChild(tab.cloneNode(true));
        invTabs.appendChild(tab);
    });

}

export function renderProductGallery() {
    const gallery = document.getElementById('product-gallery');
    const searchInput = document.getElementById('product-search');
    if (!gallery || !searchInput) return;

    const searchTerm = searchInput.value.toLowerCase();
    gallery.innerHTML = '';
    let filtered = state.products;
    if (state.activeCategory !== 'All') {
        filtered = filtered.filter(p => p.category === state.activeCategory);
    }
    if (searchTerm) {
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            (p.code && p.code.toLowerCase().includes(searchTerm))
        );
    }
    if (filtered.length === 0) {
        gallery.innerHTML = `<p class="text-center col-span-full">No products found.</p>`;
        return;
    }
    filtered.forEach(p => {
        const totalQuantity = getProductTotalQuantity(p);
        const lowStockClass = totalQuantity > 0 && totalQuantity <= state.lowStockThreshold ? 'text-red-500 font-bold' : '';
        const card = document.createElement('div');
        card.className = 'product-card rounded-lg p-4 flex flex-col [perspective:1000px]';
        const buttonText = totalQuantity === 0 ? translations[state.lang].outOfStock : translations[state.lang].addToCart;

        const availableColors = p.colors ? Object.entries(p.colors) : [];
        const colorSwatches = availableColors.map(([colorName, colorData], index) => {
            const colorStock = Object.values(colorData.sizes || {}).reduce((sum, size) => sum + size.quantity, 0);
            return `
                <button 
                    class="color-swatch relative ${index === 0 ? 'active' : ''}" 
                    data-color="${colorName}" 
                    title="${colorName} - Stock: ${colorStock}" 
                    style="background-color: ${colorName.toLowerCase().replace(/\s/g, '')};">
                    <span class="absolute -top-1.5 -right-1.5 text-xs bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg pointer-events-none" style="font-size: 10px;">${colorStock}</span>
                </button>`;
        }).join('');

        const firstColorName = availableColors.length > 0 ? availableColors[0][0] : null;
        const firstColorData = firstColorName ? p.colors[firstColorName] : { sizes: {} };

        const availableSizes = firstColorData.sizes ? Object.entries(firstColorData.sizes).filter(([_, sizeData]) => sizeData.quantity > 0) : [];
        const sizeOptions = availableSizes.map(([size, sizeData]) => `<option value="${size}">${size} (Stock: ${sizeData.quantity})</option>`).join('');

        const firstSizeName = availableSizes.length > 0 ? availableSizes[0][0] : null;
        const selectedVariantStock = firstSizeName ? (p.colors[firstColorName]?.sizes[firstSizeName]?.quantity || 0) : 0;


        const firstImage = (p.images && p.images.length > 0) ? p.images[0] : '';
        const secondImage = (p.images && p.images.length > 1) ? p.images[1] : firstImage;

        card.innerHTML = `
            <div class="product-card-image-wrapper">
                 <div class="product-card-inner">
                    <div class="product-card-front">
                        <img src="${firstImage}" alt="${p.name}" class="product-card-image" onerror="this.onerror=null;this.src='https://placehold.co/600x400/2d3748/e2e8f0?text=No+Image';this.style.display='block'">
                    </div>
                    <div class="product-card-back">
                         <img src="${secondImage}" alt="${p.name} (back)" class="product-card-image" onerror="this.onerror=null;this.src='https://placehold.co/600x400/2d3748/e2e8f0?text=No+Image';this.style.display='block'">
                    </div>
                </div>
            </div>
            <h3 class="font-bold text-lg">${p.name}</h3>
            <p style="color: var(--accent-color);">${p.sellingPrice.toFixed(2)} EGP</p>
            <p class="text-sm text-gray-400">Total Stock: <span class="${lowStockClass}">${totalQuantity}</span></p>
            <p class="text-xs text-gray-300 font-semibold" data-lang-key="stockOfSelected">Stock of Selected: <span class="selected-variant-stock">${selectedVariantStock}</span></p>
            <div class="mt-auto pt-4" data-product-id="${p.id}">
                <div class="color-swatch-container mb-2 flex items-center gap-2">
                    ${colorSwatches || 'N/A'}
                </div>
                <label class="text-xs">${translations[state.lang].size}</label>
                <select class="gallery-size-selector w-full p-2 mb-2 rounded-lg" ${availableSizes.length === 0 ? 'disabled' : ''}>
                     ${sizeOptions || '<option>N/A</option>'}
                </select>
                 <input type="number" value="1" min="1" class="quantity-input w-full p-2 mb-2 rounded-lg">
                <button class="add-gallery-to-cart-btn btn-primary w-full py-2 px-4 rounded-lg" ${totalQuantity === 0 ? 'disabled' : ''}>${buttonText}</button>
            </div>
        `;
        gallery.appendChild(card);
    });
}

export function renderInventoryTable() {
    const table = document.getElementById('inventory-table');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    const searchTerm = document.getElementById('inventory-search').value.toLowerCase();

    thead.innerHTML = `
        <th class="p-2" data-lang-key="colProductName">Name</th>
        <th class="p-2" data-lang-key="colProductCode">Code</th>
        <th class="p-2" data-lang-key="colCategory">Category</th>
        <th class="p-2" data-lang-key="colImage">Image</th>
        <th class="p-2" data-lang-key="colQuantity">Quantity</th>
        <th class="p-2" data-lang-key="colPurchasePrice">Purchase Price</th>
        <th class="p-2" data-lang-key="colSellingPrice">Selling Price</th>
        <th class="p-2" data-lang-key="colActions">Actions</th>
    `;

    tbody.innerHTML = '';
    let filtered = state.products;
    if (state.activeCategory !== 'All') {
        filtered = filtered.filter(p => p.category === state.activeCategory);
    }
    if (searchTerm) {
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            (p.code && p.code.toLowerCase().includes(searchTerm))
        );
    }
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4">No products found.</td></tr>`;
        return;
    }
    filtered.forEach(p => {
        const totalQuantity = getProductTotalQuantity(p);
        const lowStockClass = totalQuantity > 0 && totalQuantity <= state.lowStockThreshold ? 'text-red-500 font-bold' : '';
        const firstImage = (p.images && p.images.length > 0) ? p.images[0] : '';

        const row = document.createElement('tr');
        row.className = "product-row border-b border-gray-700 hover:bg-gray-700 cursor-pointer";
        row.dataset.productId = p.id;
        row.innerHTML = `
            <td class="p-2">${p.name}</td>
            <td class="p-2">${p.code || 'N/A'}</td>
            <td class="p-2">${p.category || 'N/A'}</td>
            <td class="p-2"><img src="${firstImage}" alt="${p.name}" class="h-12 w-18 object-cover rounded" onerror="this.onerror=null;this.src='https://placehold.co/100x67/2d3748/e2e8f0?text=No+Img';this.style.display='block'"></td>
            <td class="p-2 font-bold ${lowStockClass}">${totalQuantity}</td>
            <td class="p-2">${p.purchasePrice.toFixed(2)} EGP</td>
            <td class="p-2">${p.sellingPrice.toFixed(2)} EGP</td>
            <td class="p-2">
                <div class="flex flex-col space-y-1 items-center">
                    <button class="edit-product-btn btn-secondary text-xs py-1 px-2 rounded w-full" data-id="${p.id}" data-lang-key="modalEditTitle">Edit</button>
                    <button class="delete-product-btn btn-danger text-xs py-1 px-2 rounded w-full" data-id="${p.id}" data-lang-key="deleteSelected">Delete</button>
                    <button class="show-barcodes-btn btn-primary text-xs py-1 px-2 rounded w-full" data-id="${p.id}" data-lang-key="btnBarcode">Barcodes</button>
                </div>
            </td>`;
        tbody.appendChild(row);

        const detailRow = document.createElement('tr');
        detailRow.className = `product-detail-row hidden bg-gray-800`;
        detailRow.dataset.detailFor = p.id;
        detailRow.innerHTML = `<td colspan="8" class="p-0"></td>`;
        tbody.appendChild(detailRow);
    });
}


export function renderInventoryDetail(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return '';

    const detailContent = `
        <div class="p-4">
            <h4 class="text-md font-bold mb-2" data-lang-key="detailedStock">Detailed Stock</h4>
            <table class="w-full text-sm">
                <thead class="bg-gray-900">
                    <tr>
                        <th class="p-2 text-left" data-lang-key="color">Color</th>
                        <th class="p-2 text-left" data-lang-key="size">Size</th>
                        <th class="p-2 text-left" data-lang-key="colQuantity">Stock</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(product.colors).map(([color, colorData]) =>
        Object.entries(colorData.sizes).map(([size, sizeData]) => `
                            <tr class="border-b border-gray-700">
                                <td class="p-2">${color}</td>
                                <td class="p-2">${size}</td>
                                <td class="p-2 ${sizeData.quantity > 0 && sizeData.quantity <= state.lowStockThreshold ? 'text-red-500 font-bold' : ''}">${sizeData.quantity}</td>
                            </tr>
                        `).join('')
    ).join('')}
                </tbody>
            </table>
        </div>
    `;
    return detailContent;
}

export function renderSellingPage() {
    renderReceiptTabs();
    renderActiveReceiptContent();
}

export function renderReceiptTabs() {
    const tabsContainer = document.getElementById('receipt-tabs-container');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';
    state.receipts.forEach((receipt, index) => {
        const tab = document.createElement('div');
        tab.className = `receipt-tab flex items-center ${receipt.id === state.activeReceiptId ? 'active' : ''}`;
        tab.dataset.receiptId = receipt.id;

        const tabLabel = receipt.customerName && receipt.customerName.trim() ? receipt.customerName.trim() : `Receipt ${index + 1}`;
        const shortLabel = receipt.customerName && receipt.customerName.trim() ? receipt.customerName.trim().charAt(0).toUpperCase() : index + 1;

        tab.innerHTML = `
            <div class="tab-content">
                 <span class="tab-short-text">${shortLabel}</span>
                 <span class="tab-full-text">${tabLabel}</span>
                 <button class="close-receipt-btn" data-receipt-id="${receipt.id}">&times;</button>
            </div>
        `;
        tabsContainer.appendChild(tab);
    });

    const addBtn = document.createElement('button');
    addBtn.id = 'add-receipt-btn';
    addBtn.className = 'py-2 px-3 flex items-center justify-center rounded-t-lg ml-1';
    addBtn.innerHTML = `
        <svg class="w-5 h-5 pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
    `;
    tabsContainer.appendChild(addBtn);
}

function renderActiveReceiptContent() {
    const activeReceipt = state.receipts.find(r => r.id === state.activeReceiptId);
    const contentContainer = document.getElementById('active-receipt-content');
    if (!activeReceipt || !contentContainer) {
        if (contentContainer) contentContainer.innerHTML = '';
        return;
    }

    const productOptions = state.products
        .filter(p => getProductTotalQuantity(p) > 0)
        .map(p => `<option value="${p.id}">${p.name} (Stock: ${getProductTotalQuantity(p)})</option>`)
        .join('');

    const sellerOptions = state.users
        .map(user => `<option value="${user.username}">${user.username}</option>`)
        .join('');

    contentContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6" id="receipt-content-${activeReceipt.id}">
            <div class="md:col-span-2">
                <h2 class="text-2xl font-bold mb-4" data-lang-key="addToCartTitle">Add Products to Cart</h2>
                
                <div class="mb-4">
                    <label class="block mb-2" data-lang-key="barcodeScanner">Scan Barcode</label>
                    <div class="flex space-x-2">
                        <input type="text" class="barcode-scanner-input flex-grow p-2 rounded-lg focus:ring-2 focus:ring-highlight-color" data-lang-key="barcodePlaceholder" placeholder="Scan or type and press Enter...">
                    </div>
                </div>

                <div class="mb-4">
                    <select class="product-selection w-full p-2 rounded-lg">
                        <option value="">Select a product</option>
                        ${productOptions}
                    </select>
                </div>
                <div class="product-details-for-sale hidden">
                    <div class="mb-4"><label class="block mb-2" data-lang-key="quantity">Quantity</label><input type="number" class="sale-quantity w-full p-2 rounded-lg" value="1" min="1"></div>
                    <div class="mb-4"><label class="block mb-2" data-lang-key="color">Color</label><select class="sale-color w-full p-2 rounded-lg"></select></div>
                    <div class="mb-4"><label class="block mb-2" data-lang-key="size">Size</label><select class="sale-size w-full p-2 rounded-lg"></select></div>
                    <div class="mb-4"><label class="block mb-2" data-lang-key="sellingPrice">Selling Price (EGP)</label><input type="number" class="sale-price w-full p-2 rounded-lg"></div>
                    <button class="add-to-cart-btn btn-primary w-full py-2 px-4 rounded-lg" data-target-cart="receipt" data-lang-key="addToCart">Add to Cart</button>
                </div>
            </div>
            <div class="bg-secondary-bg p-6 rounded-lg">
                <h2 class="text-2xl font-bold mb-4" data-lang-key="cart">Cart</h2>
                <div class="cart-items space-y-2 max-h-60 overflow-y-auto mb-4"></div>
                 <div class="border-t border-gray-600 mt-4 pt-4 space-y-2">
                    <div class="flex items-center space-x-2">
                        <label class="w-1/3" data-lang-key="customerPhone">Customer Phone</label>
                        <input type="tel" class="customer-phone-input w-2/3 p-2 rounded-lg" value="${activeReceipt.customerPhone || ''}">
                    </div>
                     <div class="flex items-center space-x-2">
                        <label class="w-1/3" data-lang-key="customerName">Customer Name</label>
                        <input type="text" class="customer-name-input w-2/3 p-2 rounded-lg" value="${activeReceipt.customerName || ''}">
                    </div>
                    <div class="flex items-center space-x-2">
                        <label class="w-1/3" data-lang-key="customerAddress">Customer Address</label>
                        <input type="text" class="customer-address-input w-2/3 p-2 rounded-lg" value="${activeReceipt.customerAddress || ''}">
                    </div>
                    <div class="flex items-center space-x-2">
                        <label class="w-1/3" data-lang-key="colCustomerCity">City</label>
                        <input type="text" class="customer-city-input w-2/3 p-2 rounded-lg" value="${activeReceipt.customerCity || ''}">
                    </div>
                    <div class="flex items-center space-x-2">
                        <label class="w-1/3" data-lang-key="cashier">Cashier</label>
                        <select class="receipt-seller-select w-2/3 p-2 rounded-lg">
                            <option value="">-- Select Cashier --</option>
                            ${sellerOptions}
                        </select>
                    </div>
                </div>
                <div class="border-t border-gray-600 mt-4 pt-4 space-y-4">
                    <div class="flex justify-between items-center text-lg"><span data-lang-key="subtotal">Subtotal:</span><span class="cart-subtotal">0 EGP</span></div>
                    <div class="flex items-center space-x-2"><label class="w-1/2" data-lang-key="discountPercent">Discount (%):</label><input type="number" class="discount-percentage w-1/2 p-2 rounded-lg" min="0" max="100"></div>
                    <div class="flex items-center space-x-2"><label class="w-1/2" data-lang-key="discountAmount">Discount (EGP):</label><input type="number" class="discount-amount w-1/2 p-2 rounded-lg" min="0"></div>
                    
                    <div class="flex items-center justify-between">
                         <div class="flex items-center space-x-2">
                             <input type="checkbox" id="free-delivery-checkbox" class="h-5 w-5 rounded">
                             <label for="free-delivery-checkbox" data-lang-key="freeDelivery">Free Delivery</label>
                         </div>
                         <div id="delivery-fee-container" class="flex items-center space-x-2">
                             <label data-lang-key="deliveryFee">Delivery Fee:</label>
                             <input type="number" class="delivery-fee-input w-24 p-2 rounded-lg" min="0">
                         </div>
                    </div>

                    ${activeReceipt.isFromBooking && activeReceipt.originalDeposit > 0 ? `
                        <div class="flex justify-between items-center text-lg">
                            <span data-lang-key="depositPaid">Deposit Paid:</span>
                            <span class="text-green-400">${activeReceipt.originalDeposit.toFixed(2)} EGP</span>
                        </div>
                        <div class="flex justify-between font-bold text-xl" style="color: var(--accent-color);">
                            <span data-lang-key="amountRemaining">Amount Remaining:</span>
                            <span class="cart-total">0 EGP</span>
                        </div>
                    ` : `
                        <div class="flex justify-between font-bold text-xl" style="color: var(--accent-color);">
                            <span data-lang-key="total">Total:</span>
                            <span class="cart-total">0 EGP</span>
                        </div>
                    `}

                    <div>
                        <label class="block mb-2 text-sm" data-lang-key="paymentMethod">Payment Method</label>
                        <div class="flex items-center space-x-2">
                            <button type="button" class="payment-method-btn selected flex-1 flex items-center justify-center space-x-2 p-2 rounded-lg" data-method="cash">
                                <span data-lang-key="cash">Cash</span>
                            </button>
                            <button type="button" class="payment-method-btn flex-1 flex items-center justify-center space-x-2 p-2 rounded-lg" data-method="instaPay">
                                <span data-lang-key="instaPay">InstaPay</span>
                            </button>
                             <button type="button" class="payment-method-btn flex-1 flex items-center justify-center space-x-2 p-2 rounded-lg" data-method="vCash">
                                <span data-lang-key="vCash">VCash</span>
                            </button>
                        </div>
                    </div>
                    <div class="mt-4"><label class="block mb-2" data-lang-key="paidAmount">Paid Amount (EGP)</label><input type="number" class="paid-amount w-full p-2 rounded-lg" data-lang-key="paidAmountPlaceholder" placeholder="Enter amount paid"></div>
                    <div class="flex space-x-2">
                        <button class="complete-sale-btn btn-primary w-full mt-4 py-3 px-4 rounded-lg" data-lang-key="completeSale">Complete Sale</button>
                        <button class="save-as-booking-btn btn-secondary w-full mt-4 py-3 px-4 rounded-lg" data-lang-key="saveAsBooking">Save as Booking</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const sellerSelect = contentContainer.querySelector('.receipt-seller-select');
    if (sellerSelect) {
        sellerSelect.value = activeReceipt.seller || '';
    }

    updateUIText();
    renderCart(activeReceipt.id);
}

export function renderCart(receiptId) {
    const receipt = state.receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    const container = document.querySelector(`#receipt-content-${receiptId}`);
    if (!container) return;

    const cartItemsContainer = container.querySelector('.cart-items');
    const subtotalEl = container.querySelector('.cart-subtotal');
    const totalEl = container.querySelector('.cart-total');
    const discountPercentEl = container.querySelector('.discount-percentage');
    const discountAmountEl = container.querySelector('.discount-amount');
    const deliveryFeeEl = container.querySelector('.delivery-fee-input');
    const freeDeliveryCheckbox = container.querySelector('#free-delivery-checkbox');

    cartItemsContainer.innerHTML = '';
    let subtotal = receipt.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    receipt.cart.forEach((item, index) => {
        const product = state.products.find(p => p.id === item.productId);
        const cartItemDiv = document.createElement('div');
        cartItemDiv.className = 'flex flex-col bg-gray-800 p-2 rounded space-y-2'; // Use flex-col and add space

        const isEditing = state.editingCartItem && state.editingCartItem.receiptId === receiptId && state.editingCartItem.index === index;

        if (isEditing) {
            // --- EDITING VIEW ---
            const availableColors = Object.keys(product.colors || {});
            const colorOptions = availableColors.map(c => `<option value="${c}" ${c === item.color ? 'selected' : ''}>${c}</option>`).join('');

            // Populate sizes based on the currently selected color in the dropdown
            const selectedColorInEdit = item.color; // This will be updated by an event listener
            const availableSizes = Object.keys(product.colors[selectedColorInEdit]?.sizes || {});
            const sizeOptions = availableSizes.map(s => `<option value="${s}" ${s === item.size ? 'selected' : ''}>${s}</option>`).join('');

            cartItemDiv.innerHTML = `
                <div class="flex justify-between items-center w-full">
                    <p class="font-bold">${product ? product.name : 'Unknown Item'}</p>
                    <div class="flex items-center space-x-2">
                         <button class="save-cart-item-btn btn-primary text-xs py-1 px-2 rounded" data-index="${index}" data-receipt-id="${receiptId}" data-lang-key="btnSave">Save</button>
                         <button class="cancel-edit-cart-item-btn btn-secondary text-xs py-1 px-2 rounded" data-index="${index}" data-receipt-id="${receiptId}" data-lang-key="btnCancel">Cancel</button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 w-full border-t border-gray-700 pt-2">
                    <div>
                        <label class="text-xs" data-lang-key="color">Color</label>
                        <select class="cart-item-color-select w-full p-1 rounded text-sm bg-gray-700 border-gray-600" data-product-id="${product.id}">${colorOptions}</select>
                    </div>
                    <div>
                        <label class="text-xs" data-lang-key="size">Size</label>
                        <select class="cart-item-size-select w-full p-1 rounded text-sm bg-gray-700 border-gray-600">${sizeOptions}</select>
                    </div>
                    <div>
                        <label class="text-xs" data-lang-key="colQuantity">Quantity</label>
                        <div class="flex items-center">
                            <button class="cart-quantity-change-btn btn-secondary px-2 rounded-l" data-amount="-1">-</button>
                            <input type="number" class="cart-item-quantity-input w-12 text-center p-1 bg-gray-700 border-gray-600" value="${item.quantity}" min="1">
                            <button class="cart-quantity-change-btn btn-secondary px-2 rounded-r" data-amount="1">+</button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs" data-lang-key="sellingPrice">Price</label>
                        <input type="number" class="cart-item-price-input w-full p-1 rounded text-sm bg-gray-700 border-gray-600" value="${item.price.toFixed(2)}" step="0.01">
                    </div>
                </div>
            `;
        } else {
            // --- NORMAL VIEW ---
            cartItemDiv.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <p class="font-bold">${product ? product.name : 'Unknown Item'} (${item.color} / ${item.size})</p>
                        <p class="text-sm text-gray-400">${item.quantity} x ${item.price.toFixed(2)} EGP</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="edit-cart-item-btn btn-secondary text-xs py-1 px-2 rounded" data-index="${index}" data-receipt-id="${receiptId}" data-lang-key="btnEdit">Edit</button>
                        <button class="remove-from-cart-btn btn-danger rounded-full w-6 h-6 flex items-center justify-center text-xs" data-index="${index}" data-target-cart="receipt" data-receipt-id="${receiptId}">&times;</button>
                    </div>
                </div>
            `;
        }
        cartItemsContainer.appendChild(cartItemDiv);
    });


    subtotalEl.textContent = `${subtotal.toFixed(2)} EGP`;

    const discountPercent = parseFloat(discountPercentEl.value) || 0;
    const discountAmount = parseFloat(discountAmountEl.value) || 0;

    let total = subtotal;
    if (discountPercent > 0) {
        total -= total * (discountPercent / 100);
    } else if (discountAmount > 0) {
        total -= discountAmount;
    }

    const deliveryFee = freeDeliveryCheckbox.checked ? 0 : parseFloat(deliveryFeeEl.value) || 0;
    total += deliveryFee;

    if (receipt.isFromBooking && receipt.originalDeposit > 0) {
        total -= receipt.originalDeposit;
    }

    totalEl.textContent = `${Math.max(0, total).toFixed(2)} EGP`;
    updateCartIconCount();
}

// --- Booking Functions ---
export function renderBookingPage() {
    const container = document.getElementById('booking-page');
    if (!container) return;

    const listContainer = document.getElementById('open-bookings-list');
    const searchTerm = state.bookingSearchTerm.toLowerCase();

    let filteredBookings = state.bookings.filter(b => !b.isCompleted);

    if (searchTerm) {
        filteredBookings = filteredBookings.filter(b =>
            (b.id && b.id.toLowerCase().includes(searchTerm)) ||
            (b.customerName && b.customerName.toLowerCase().includes(searchTerm)) ||
            (b.customerPhone && b.customerPhone.includes(searchTerm))
        );
    }

    listContainer.innerHTML = '';
    if (filteredBookings.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-400 p-4">No open bookings found.</p>`;
        return;
    }

    filteredBookings.forEach(booking => {
        const subtotal = booking.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const amountDue = subtotal - booking.deposit;
        const card = document.createElement('div');
        card.className = 'bg-secondary-bg p-4 rounded-lg shadow-md';
        const bookingDateTime = new Date(booking.createdAt).toLocaleString();

        let depositMethodDisplay = '';
        if (booking.deposit > 0 && booking.depositPaymentMethod) {
            depositMethodDisplay = ` (${translations[state.lang][booking.depositPaymentMethod] || booking.depositPaymentMethod})`;
        }


        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-bold text-lg">${booking.customerName || 'No Name'} <span class="text-sm font-normal text-gray-500">(${booking.customerPhone || 'No Phone'})</span></p>
                    <p class="text-xs text-gray-400">ID: ${booking.id} | By: ${booking.seller || 'N/A'}</p>
                    <p class="text-xs text-gray-400">Date: ${bookingDateTime}</p>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="edit-booking-btn btn-secondary py-1 px-3 rounded text-xs flex items-center justify-center" data-booking-id="${booking.id}" title="${translations[state.lang].editBooking}">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="delete-booking-btn btn-danger py-1 px-3 rounded text-xs" data-booking-id="${booking.id}" data-lang-key="btnDelete">Delete</button>
                    <button class="complete-sale-from-booking-btn btn-primary py-1 px-3 rounded text-xs" data-booking-id="${booking.id}" data-lang-key="completeSale">Complete Sale</button>
                    <button class="print-booking-btn btn-secondary py-1 px-3 rounded text-xs" data-booking-id="${booking.id}" data-lang-key="btnPrint">Print</button>
                </div>
            </div>
            <div class="mt-2 border-t border-gray-700 pt-2">
                 <ul class="text-sm space-y-1">
                    ${booking.cart.map(item => `<li>${item.quantity}x ${item.productName} (${item.color}/${item.size})</li>`).join('')}
                 </ul>
                 <div class="text-right mt-2 font-semibold">
                     <p>Subtotal: ${subtotal.toFixed(2)} EGP</p>
                     <p>Deposit: ${booking.deposit.toFixed(2)} EGP${depositMethodDisplay}</p>
                     <p class="text-lg text-[var(--accent-color)]">Amount Due: ${amountDue.toFixed(2)} EGP</p>
                 </div>
            </div>
        `;
        listContainer.appendChild(card);
    });
    updateUIText();
}

export function renderSalesHistory() {
    generateReport();
}

export function renderCustomersPage() {
    const tbody = document.getElementById('customers-table').querySelector('tbody');
    const searchTerm = document.getElementById('customer-search').value.toLowerCase();

    let filteredCustomers = state.customers;

    if (searchTerm) {
        filteredCustomers = filteredCustomers.filter(c =>
            c.name.toLowerCase().includes(searchTerm) ||
            c.phone.includes(searchTerm)
        );
    }

    tbody.innerHTML = '';
    if (filteredCustomers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4">No customers found.</td></tr>`;
        return;
    }

    filteredCustomers.forEach(customer => {
        const row = document.createElement('tr');
        row.className = "border-b border-gray-700 hover:bg-gray-700";
        row.innerHTML = `
            <td class="p-4">${customer.name}</td>
            <td class="p-4">${customer.phone}</td>
            <td class="p-4">${customer.address || 'N/A'}</td>
            <td class="p-4">${customer.city || 'N/A'}</td>
            <td class="p-4">${customer.totalItemsBought}</td>
            <td class="p-4">${customer.lastPaymentDate ? new Date(customer.lastPaymentDate).toLocaleDateString() : 'N/A'}</td>
            <td class="p-4">
                <div class="flex space-x-2">
                    <button class="edit-customer-btn btn-secondary text-xs py-1 px-2 rounded" data-id="${customer.id}">Edit</button>
                    <button class="delete-customer-btn btn-danger text-xs py-1 px-2 rounded" data-id="${customer.id}">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    updateUIText();
}

export function renderSalariesPage() {
    const salariesPage = document.getElementById('salaries-page');
    const tbody = document.getElementById('salaries-table').querySelector('tbody');
    const searchTerm = state.salariesSearchTerm.toLowerCase();
    tbody.innerHTML = '';

    if (!state.selectedSalariesMonth) {
        state.selectedSalariesMonth = new Date().toISOString().slice(0, 7);
        document.getElementById('salaries-month-picker').value = state.selectedSalariesMonth;
    }

    const salesThisMonth = state.sales.filter(sale => sale.createdAt.startsWith(state.selectedSalariesMonth));

    let filteredUsers = state.users
        .filter(u => u.username !== 'BAZ')
        .sort((a, b) => {
            const idA = parseInt((a.employeeId || 'EMP9999').replace(/[^0-9]/g, ''), 10);
            const idB = parseInt((b.employeeId || 'EMP9999').replace(/[^0-9]/g, ''), 10);
            return idA - idB;
        });

    if (searchTerm) {
        filteredUsers = filteredUsers.filter(u => u.username.toLowerCase().includes(searchTerm) || (u.employeeId && u.employeeId.toLowerCase().includes(searchTerm)));
    }

    let totalSalariesPaidThisMonth = 0;

    filteredUsers.forEach(user => {
        const userData = state.salaries[user.username] || { fixed: 0, commission: 0, bonus: 0 };
        if (userData.bonus === undefined) userData.bonus = 0;

        const piecesSold = salesThisMonth
            .filter(sale => sale.cashier === user.username)
            .reduce((total, sale) => total + sale.items.reduce((itemTotal, item) => itemTotal + (item.quantity - (item.returnedQty || 0)), 0), 0);

        const totalCommission = piecesSold * userData.commission;
        const totalSalary = userData.fixed + totalCommission + userData.bonus;

        const paidStatusKey = `${user.username}-${state.selectedSalariesMonth}`;
        const isPaid = state.salariesPaidStatus[paidStatusKey] || false;

        if (isPaid) {
            totalSalariesPaidThisMonth += totalSalary;
        }

        const row = document.createElement('tr');
        row.className = `border-b border-gray-700 ${isPaid ? 'paid-salary-row' : ''}`;
        row.innerHTML = `
            <td class="p-4">${user.employeeId || 'N/A'}</td>
            <td class="p-4 font-bold">${user.username}</td>
            <td class="p-4">${user.phone || 'N/A'}</td>
            <td class="p-4"><input type="number" class="salary-input w-24 p-2 rounded-lg" data-user="${user.username}" data-type="fixed" value="${userData.fixed}"></td>
            <td class="p-4"><input type="number" class="salary-input w-24 p-2 rounded-lg" data-user="${user.username}" data-type="commission" value="${userData.commission}"></td>
            <td class="p-4"><input type="number" class="salary-input w-24 p-2 rounded-lg" data-user="${user.username}" data-type="bonus" value="${userData.bonus}"></td>
            <td class="p-4">${piecesSold}</td>
            <td class="p-4">${totalCommission.toFixed(2)} EGP</td>
            <td class="p-4 font-bold text-lg">${totalSalary.toFixed(2)} EGP</td>
            <td class="p-4">
                <button class="toggle-paid-btn py-2 px-4 rounded-lg text-white text-xs ${isPaid ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}" data-user="${user.username}" data-month="${state.selectedSalariesMonth}">
                    ${isPaid ? translations[state.lang].paid : translations[state.lang].unpaid}
                </button>
            </td>
            <td class="p-4">
                <div class="flex space-x-1">
                    <button class="edit-employee-btn btn-secondary text-xs py-1 px-2 rounded" data-username="${user.username}" data-lang-key="btnEdit">Edit</button>
                    <button class="delete-employee-btn btn-danger text-xs py-1 px-2 rounded" data-username="${user.username}" data-lang-key="btnDelete">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    let summaryContainer = salariesPage.querySelector('#salaries-summary');
    if (!summaryContainer) {
        summaryContainer = document.createElement('div');
        summaryContainer.id = 'salaries-summary';
        summaryContainer.className = 'bg-secondary-bg p-4 rounded-lg shadow mb-6 text-right';
        salariesPage.insertBefore(summaryContainer, salariesPage.querySelector('.overflow-x-auto'));
    }
    summaryContainer.innerHTML = `
        <h2 class="text-xl font-bold" data-lang-key="totalSalaries">Total Salaries Paid (${state.selectedSalariesMonth})</h2>
        <p class="text-2xl font-semibold text-[var(--expense-color)]">${totalSalariesPaidThisMonth.toFixed(2)} EGP</p>
    `;

    const rentInput = document.getElementById('rent-amount-input');
    const rentPaidBtn = document.getElementById('toggle-rent-paid-btn');
    const rentMonthKey = state.selectedSalariesMonth;

    rentInput.value = state.expenses.rent.amount || 0;
    const isRentPaid = state.expenses.rent.paidStatus[rentMonthKey] || false;

    rentPaidBtn.textContent = isRentPaid ? translations[state.lang].paid : translations[state.lang].unpaid;
    rentPaidBtn.classList.toggle('bg-green-500', isRentPaid);
    rentPaidBtn.classList.toggle('hover:bg-green-600', isRentPaid);
    rentPaidBtn.classList.toggle('bg-red-500', !isRentPaid);
    rentPaidBtn.classList.toggle('hover:bg-red-600', !isRentPaid);

    updateUIText();
}

export function renderBestSellersPage() {
    const listContainer = document.getElementById('best-sellers-list');
    if (!listContainer) return;

    const timeFilter = document.getElementById('bs-time-filter-type').value;
    const monthFilter = document.getElementById('bs-report-month-picker').value;
    const dayFilter = document.getElementById('bs-report-day-picker').value;

    let filteredSales = state.sales;
    if (timeFilter === 'month' && monthFilter) {
        filteredSales = filteredSales.filter(s => s.createdAt.startsWith(monthFilter));
    } else if (timeFilter === 'day' && dayFilter) {
        filteredSales = filteredSales.filter(s => s.createdAt.startsWith(dayFilter));
    }

    const variantSales = {};

    filteredSales.forEach(sale => {
        sale.items.forEach(item => {
            const netQty = item.quantity - (item.returnedQty || 0);
            if (netQty > 0) {
                const variantKey = `${item.productId}-${item.color}-${item.size}`;
                if (!variantSales[variantKey]) {
                    const productInfo = state.products.find(p => p.id === item.productId);
                    if (!productInfo) return;

                    const stock = productInfo.colors?.[item.color]?.sizes?.[item.size]?.quantity ?? 0;

                    variantSales[variantKey] = {
                        productId: item.productId,
                        name: item.productName,
                        image: productInfo.images?.[0] || '',
                        category: productInfo.category || 'N/A',
                        color: item.color,
                        size: item.size,
                        stock: stock,
                        quantitySold: 0,
                        totalValue: 0,
                    };
                }
                variantSales[variantKey].quantitySold += netQty;
                variantSales[variantKey].totalValue += netQty * item.unitPrice;
            }
        });
    });

    const sortedVariants = Object.values(variantSales).sort((a, b) => b.quantitySold - a.quantitySold);

    listContainer.innerHTML = '';
    if (sortedVariants.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-400 p-4">No sales data for this period.</p>`;
        return;
    }

    const table = document.createElement('table');
    table.className = 'w-full text-sm text-left bg-secondary-bg rounded-lg shadow';
    table.innerHTML = `
        <thead class="text-xs uppercase" style="background-color: var(--header-bg);">
            <tr>
                <th class="p-4">Rank</th>
                <th class="p-4" data-lang-key="colImage">Image</th>
                <th class="p-4" data-lang-key="colProductName">Product</th>
                <th class="p-4" data-lang-key="colCategory">Category</th>
                <th class="p-4" data-lang-key="colColors">Color / Size</th>
                <th class="p-4">Quantity Sold</th>
                <th class="p-4">Stock Left</th>
                <th class="p-4" data-lang-key="totalSales">Total Sales Value</th>
            </tr>
        </thead>
        <tbody>
            ${sortedVariants.map((variant, index) => `
                <tr class="border-b border-gray-700 hover:bg-gray-700">
                    <td class="p-4 font-bold text-lg">${index + 1}</td>
                    <td class="p-4">
                        <img src="${variant.image}" alt="${variant.name}" class="h-16 w-16 object-cover rounded" onerror="this.onerror=null;this.src='https://placehold.co/100x100/2d3748/e2e8f0?text=No+Img';this.style.display='block'">
                    </td>
                    <td class="p-4 font-semibold">${variant.name}</td>
                    <td class="p-4">${variant.category}</td>
                    <td class="p-4">${variant.color} / ${variant.size}</td>
                    <td class="p-4 text-lg font-bold">${variant.quantitySold}</td>
                    <td class="p-4 text-lg ${variant.stock <= state.lowStockThreshold ? 'text-red-500 font-bold' : ''}">${variant.stock}</td>
                    <td class="p-4 font-semibold text-[var(--accent-color)]">${variant.totalValue.toFixed(2)} EGP</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    listContainer.appendChild(table);
    updateUIText();
}

export function renderDefectsPage() {
    const tbody = document.getElementById('defects-table').querySelector('tbody');
    const thead = document.getElementById('defects-table').querySelector('thead tr');
    const monthFilter = document.getElementById('defects-month-picker').value;
    const dayFilter = document.getElementById('defects-day-picker').value;
    const searchTerm = document.getElementById('defects-search').value.toLowerCase();

    let filteredDefects = state.defects;

    if (monthFilter) {
        filteredDefects = filteredDefects.filter(d => d.date.startsWith(monthFilter));
    } else if (dayFilter) {
        filteredDefects = filteredDefects.filter(d => d.date.startsWith(dayFilter));
    }

    if (searchTerm) {
        filteredDefects = filteredDefects.filter(d =>
            d.productName.toLowerCase().includes(searchTerm)
        );
    }

    thead.innerHTML = `
        <th class="p-4" data-lang-key="colProductName">Product</th>
        <th class="p-4" data-lang-key="colColors">Color / Size</th>
        <th class="p-4" data-lang-key="colQuantity">Quantity</th>
        <th class="p-4" data-lang-key="colDefectDate">Defect Date</th>
        <th class="p-4" data-lang-key="colDefectReason">Reason</th>
        <th class="p-4" data-lang-key="colPurchasePrice">Cost</th>
        <th class="p-4" data-lang-key="colReturnStatusToSupplier">Return Status</th>
        <th class="p-4" data-lang-key="colActions">Actions</th>
    `;

    tbody.innerHTML = '';
    if (filteredDefects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4">No defective items found.</td></tr>`;
        return;
    }

    filteredDefects.forEach(defect => {
        const row = document.createElement('tr');
        row.className = "border-b border-gray-700 hover:bg-gray-700";

        const returnedQty = defect.returnedQty || 0;
        let statusText;
        let statusClass;

        if (returnedQty >= defect.quantity) {
            statusText = translations[state.lang].statusFullyReturned || 'Fully Returned';
            statusClass = 'bg-green-100 text-green-800';
        } else if (returnedQty > 0) {
            statusText = `${translations[state.lang].statusPartiallyReturned || 'Partially'} (${returnedQty}/${defect.quantity})`;
            statusClass = 'bg-yellow-100 text-yellow-800';
        } else {
            statusText = translations[state.lang].statusNotReturned || 'Not Returned';
            statusClass = 'bg-red-100 text-red-800';
        }

        row.innerHTML = `
            <td class="p-4">${defect.productName}</td>
            <td class="p-4">${defect.color} / ${defect.size}</td>
            <td class="p-4 font-bold">${defect.quantity}</td>
            <td class="p-4">${new Date(defect.date).toLocaleDateString()}</td>
            <td class="p-4">${defect.reason}</td>
            <td class="p-4">${(defect.purchasePrice * defect.quantity).toFixed(2)} EGP</td>
            <td class="p-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${statusText}</span></td>
            <td class="p-4">
                <button class="undo-defect-btn btn-secondary text-xs py-1 px-2 rounded" data-id="${defect.id}" data-lang-key="btnUndoDefect">Undo</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    updateUIText();
}

export function updateCartIconCount() {
    const totalItems = state.receipts.reduce((sum, r) => sum + r.cart.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const cartCountEl = document.getElementById('cart-item-count');
    cartCountEl.textContent = totalItems;
    cartCountEl.classList.toggle('hidden', totalItems === 0);
}

export function generateReport() {
    const listContainer = document.getElementById('sales-history-list');
    const timeFilter = document.getElementById('time-filter-type').value;
    const monthFilter = document.getElementById('report-month-picker').value;
    const dayFilter = document.getElementById('report-day-picker').value;
    const userFilter = document.getElementById('user-filter').value;
    const searchTerm = document.getElementById('history-search').value.toLowerCase();

    let filteredSales = state.sales;
    let filteredDefects = state.defects;
    let filteredPayments = state.suppliers.flatMap(s => s.payments || []);
    let filteredShipments = state.shipments;
    // [--- تعديل ---] فلترة المصاريف اليومية
    let filteredDailyExpenses = state.expenses.daily;
    let selectedPeriod = null;
    let periodType = 'all';

    if (timeFilter === 'month' && monthFilter) {
        selectedPeriod = monthFilter;
        periodType = 'month';
    } else if (timeFilter === 'day' && dayFilter) {
        selectedPeriod = dayFilter;
        periodType = 'day';
    }

    if (selectedPeriod) {
        filteredSales = filteredSales.filter(s => s.createdAt.startsWith(selectedPeriod));
        filteredDefects = filteredDefects.filter(d => d.date.startsWith(selectedPeriod));
        filteredPayments = filteredPayments.filter(p => p.date.startsWith(selectedPeriod));
        filteredShipments = filteredShipments.filter(sh => sh.date.startsWith(selectedPeriod));
        // [--- تعديل ---] فلترة المصاريف اليومية
        filteredDailyExpenses = filteredDailyExpenses.filter(e => e.date.startsWith(selectedPeriod));
    }

    if (userFilter !== 'all') {
        filteredSales = filteredSales.filter(s => s.cashier === userFilter);
    }

    if (searchTerm) {
        filteredSales = filteredSales.filter(s =>
            s.id.toLowerCase().includes(searchTerm) ||
            (s.customerName && s.customerName.toLowerCase().includes(searchTerm)) ||
            (s.customerPhone && s.customerPhone.includes(searchTerm)) ||
            (s.cashier && s.cashier.toLowerCase().includes(searchTerm))
        );
    }

    let totalRevenue = 0, grossProfit = 0, totalItemsSold = 0, totalCashSales = 0, totalInstaPaySales = 0, totalVCashSales = 0, totalFreeDeliveries = 0, totalSalesShippingExpense = 0, totalReturns = 0;

    filteredSales.forEach(s => {
        totalRevenue += s.totalAmount;
        grossProfit += s.profit;
        if (s.paymentMethod === 'cash') totalCashSales += s.totalAmount;
        if (s.paymentMethod === 'instaPay') totalInstaPaySales += s.totalAmount;
        if (s.paymentMethod === 'vCash') totalVCashSales += s.totalAmount;
        if (s.isFreeDelivery) totalFreeDeliveries++;
        totalSalesShippingExpense += (s.shippingCost || 0) + (s.returnDeliveryFee || 0);
        s.items.forEach(item => {
            const netQtySold = item.quantity - (item.returnedQty || 0);
            totalItemsSold += netQtySold;
            totalReturns += (item.returnedQty || 0);
        });
    });

    const totalSupplierShippingExpense = filteredShipments.reduce((sum, sh) => sum + (sh.shippingCost || 0), 0);
    const totalShippingExpense = totalSalesShippingExpense + totalSupplierShippingExpense;

    const totalSupplierPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

    const totalDefectsCost = filteredDefects.reduce((sum, defect) => {
        const unreturnedQty = defect.quantity - (defect.returnedQty || 0);
        return sum + (defect.purchasePrice * unreturnedQty);
    }, 0);

    let totalSalariesExpense = 0;
    const monthForSalaries = periodType === 'day' ? selectedPeriod.slice(0, 7) : selectedPeriod;

    if (monthForSalaries) {
        state.users.forEach(user => {
            const paidStatusKey = `${user.username}-${monthForSalaries}`;
            if (state.salariesPaidStatus[paidStatusKey]) {
                const userData = state.salaries[user.username] || { fixed: 0, commission: 0, bonus: 0 };
                const salesThisMonthForUser = state.sales.filter(sale => sale.createdAt.startsWith(monthForSalaries) && sale.cashier === user.username);
                const piecesSold = salesThisMonthForUser
                    .reduce((total, sale) => total + sale.items.reduce((itemTotal, item) => itemTotal + (item.quantity - (item.returnedQty || 0)), 0), 0);
                const totalCommission = piecesSold * userData.commission;
                totalSalariesExpense += userData.fixed + totalCommission + (userData.bonus || 0);
            }
        });
        if (state.expenses.rent.paidStatus[monthForSalaries]) {
            totalSalariesExpense += state.expenses.rent.amount || 0;
        }
    }

    // [--- تعديل ---] حساب المصاريف اليومية وإضافتها للإجمالي
    const totalDailyExpenses = filteredDailyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const operatingExpenses = totalSalariesExpense + totalShippingExpense + totalDefectsCost + totalDailyExpenses;
    const netProfit = grossProfit - operatingExpenses;

    const reportSummaryContainer = document.getElementById('report-summary');
    reportSummaryContainer.innerHTML = `
        <!-- Income -->
        <div class="bg-gray-800 p-4 rounded-lg"><h3 class="font-bold" data-lang-key="totalRevenue">Total Revenue</h3><p>${totalRevenue.toFixed(2)} EGP</p></div>
        <div class="bg-gray-800 p-4 rounded-lg"><h3 class="font-bold" data-lang-key="totalCashSales">Cash Sales</h3><p>${totalCashSales.toFixed(2)} EGP</p></div>
        <div class="bg-gray-800 p-4 rounded-lg"><h3 class="font-bold" data-lang-key="totalInstaPaySales">InstaPay Sales</h3><p>${totalInstaPaySales.toFixed(2)} EGP</p></div>
        <div class="bg-gray-800 p-4 rounded-lg"><h3 class="font-bold" data-lang-key="totalVCashSales">VCash Sales</h3><p>${totalVCashSales.toFixed(2)} EGP</p></div>
        <div class="bg-green-900/50 p-4 rounded-lg"><h3 class="font-bold text-green-300" data-lang-key="grossProfit">Gross Profit</h3><p class="text-green-300">${grossProfit.toFixed(2)} EGP</p></div>

        <!-- Expenses -->
        <div class="bg-red-900/50 p-4 rounded-lg"><h3 class="font-bold text-red-300" data-lang-key="totalSalaries">Salaries Expense</h3><p class="text-red-300">${totalSalariesExpense.toFixed(2)} EGP</p></div>
        <div class="bg-red-900/50 p-4 rounded-lg"><h3 class="font-bold text-red-300" data-lang-key="shippingExpense">Shipping Expense</h3><p class="text-red-300">${totalShippingExpense.toFixed(2)} EGP</p></div>
        <div class="bg-red-900/50 p-4 rounded-lg"><h3 class="font-bold text-red-300" data-lang-key="totalDefectsCost">Defects Cost</h3><p class="text-red-300">${totalDefectsCost.toFixed(2)} EGP</p></div>
        <!-- [--- إضافة ---] خانة جديدة للمصاريف اليومية -->
        <div class="bg-red-900/50 p-4 rounded-lg"><h3 class="font-bold text-red-300" data-lang-key="dailyExpenses">Daily Expenses</h3><p class="text-red-300">${totalDailyExpenses.toFixed(2)} EGP</p></div>
        <div class="bg-red-800/60 p-4 rounded-lg"><h3 class="font-bold text-red-200" data-lang-key="operatingExpenses">Total Operating Expenses</h3><p class="text-red-200">${operatingExpenses.toFixed(2)} EGP</p></div>
        
        <!-- Cash Flow -->
        <div class="bg-blue-900/50 p-4 rounded-lg"><h3 class="font-bold text-blue-300" data-lang-key="supplierPayments">Supplier Payments</h3><p class="text-blue-300">${totalSupplierPayments.toFixed(2)} EGP</p></div>

        <!-- Net -->
        <div class="bg-green-800/60 p-4 rounded-lg"><h3 class="font-bold text-green-200" data-lang-key="netProfit">Net Profit</h3><p class="text-green-200 text-2xl">${netProfit.toFixed(2)} EGP</p></div>

        <!-- Other Stats -->
        <div class="bg-gray-800 p-4 rounded-lg"><h3 class="font-bold" data-lang-key="totalItemsSold">Items Sold</h3><p>${totalItemsSold}</p></div>
        <div class="bg-gray-800 p-4 rounded-lg"><h3 class="font-bold" data-lang-key="totalReturns">Total Returns</h3><p>${totalReturns}</p></div>
        <div class="bg-gray-800 p-4 rounded-lg"><h3 class="font-bold" data-lang-key="totalFreeDeliveries">Free Deliveries</h3><p>${totalFreeDeliveries}</p></div>
    `;


    listContainer.innerHTML = '';
    if (filteredSales.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-400 p-4">No sales found for this filter.</p>`;
        return;
    }

    document.getElementById('selection-controls').classList.remove('hidden');

    filteredSales.forEach(sale => {
        const saleCard = document.createElement('div');
        const totalReturnedItems = sale.items.reduce((sum, item) => sum + (item.returnedQty || 0), 0);
        const freeDeliveryIndicator = sale.isFreeDelivery ? `<span class="text-xs font-bold text-green-300 bg-green-800/50 px-2 py-1 rounded-full" data-lang-key="freeDeliveryIndicator">${translations[state.lang].freeDeliveryIndicator}</span>` : '';

        // --- هذا هو الجزء الذي تم إصلاحه نهائياً ---
        let paymentMethodIndicator = '';
        // نعطي 'cash' كقيمة افتراضية للفواتير القديمة التي لا تحتوي على هذه المعلومة
        const paymentMethodKey = sale.paymentMethod || 'cash';
        const paymentMethodText = translations[state.lang][paymentMethodKey] || paymentMethodKey;

        if (paymentMethodText) {
            // تم حذف data-lang-key من هنا لمنع دالة الترجمة من الكتابة فوق النص
            paymentMethodIndicator = `<span class="text-xs font-bold text-blue-300 bg-blue-800/50 px-2 py-1 rounded-full">${translations[state.lang].paymentMethodLabel || 'Payment:'} ${paymentMethodText}</span>`;
        }
        // ---------------------------------------------------

        saleCard.className = `bg-secondary-bg p-4 rounded-lg shadow-md flex items-center space-x-4 ${state.selectedSales.has(sale.id) ? 'sale-card-selected' : ''}`;
        saleCard.innerHTML = `
            <input type="checkbox" class="sale-checkbox h-5 w-5 rounded" data-sale-id="${sale.id}" ${state.selectedSales.has(sale.id) ? 'checked' : ''}>
            <div class="flex-grow">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-lg">Receipt ID: ${sale.id}</p>
                        <p class="text-sm text-gray-400">Date: ${new Date(sale.createdAt).toLocaleString()}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-xl" style="color: var(--accent-color);">${sale.totalAmount.toFixed(2)} EGP</p>
                        <p class="text-sm">Cashier: ${sale.cashier}</p>
                    </div>
                </div>
                <div class="mt-2 text-sm">
                    <p>Customer: ${sale.customerName || 'N/A'} (${sale.customerPhone || 'N/A'})</p>
                    <div class="flex items-center space-x-4 mt-1">
                        <p>Items: ${sale.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                        ${totalReturnedItems > 0 ? `<p class="text-red-400 font-bold">Returns: ${totalReturnedItems}</p>` : ''}
                        ${freeDeliveryIndicator}
                        ${paymentMethodIndicator}
                    </div>
                </div>
            </div>
            <div class="flex flex-col space-y-2">
                <button class="edit-cashier-btn btn-secondary text-xs py-1 px-2 rounded" data-sale-id="${sale.id}" data-lang-key="editCashier">Edit Cashier</button>
                <button class="return-sale-btn btn-danger text-xs py-1 px-2 rounded" data-sale-id="${sale.id}" data-lang-key="btnReturn">Return</button>
                <button class="print-receipt-btn btn-primary text-xs py-1 px-2 rounded" data-sale-id="${sale.id}" data-lang-key="btnPrint">Print</button>
            </div>
        `;
        listContainer.appendChild(saleCard);
    });
    updateUIText();
}

// --- MODAL FUNCTIONS ---

export function showAdminPasswordModal() {
    const modal = document.getElementById('admin-password-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const input = modal.querySelector('#admin-password-input');
        if (input) {
            input.value = '';
            input.focus();
        }
        document.getElementById('admin-password-error').classList.add('hidden');
    }
}

export function closeAdminPasswordModal() {
    const modal = document.getElementById('admin-password-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

export function showProductModal(product = null) {
    state.editingProductId = product ? product.id : null;
    const modal = document.getElementById('product-modal');
    const modalContent = modal.querySelector('.modal-content');

    const categoryOptions = state.categories.filter(c => c !== 'All').map(c => `<option value="${c}">${c}</option>`).join('');

    // [--- تعديل ---] استرجاع البيانات المحفوظة إذا كان منتجًا جديدًا
    const formData = product ? product : (state.newProductFormData || {});

    modalContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-4" data-lang-key="${product ? 'modalEditTitle' : 'modalAddTitle'}">${product ? 'Edit Product' : 'Add New Product'}</h2>
        <form id="product-form" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block mb-1" data-lang-key="labelProductName">Product Name</label><input type="text" id="product-name" class="w-full p-2 rounded-lg" value="${formData.name || ''}" required></div>
                <div><label class="block mb-1" data-lang-key="labelCategory">Category</label><input type="text" id="product-category" list="category-list" class="w-full p-2 rounded-lg" value="${formData.category || ''}"><datalist id="category-list">${categoryOptions}</datalist></div>
                <div><label class="block mb-1" data-lang-key="colPurchasePrice">Purchase Price (EGP)</label><input type="number" id="purchase-price" class="w-full p-2 rounded-lg" value="${formData.purchasePrice || 0}" required step="0.01"></div>
                <div><label class="block mb-1" data-lang-key="colSellingPrice">Selling Price (EGP)</label><input type="number" id="selling-price" class="w-full p-2 rounded-lg" value="${formData.sellingPrice || 0}" required step="0.01"></div>
                <div><label class="block mb-1" data-lang-key="labelProductCode">Product Code (SKU)</label><input type="text" id="product-code" class="w-full p-2 rounded-lg" value="${formData.code || ''}"></div>
                <div><label class="block mb-1" data-lang-key="labelBarcode">Main Barcode</label><input type="text" id="main-barcode" class="w-full p-2 rounded-lg" value="${formData.mainBarcode || ''}"></div>
            </div>
            <div><label class="block mb-1" data-lang-key="labelProductImages">Product Images</label><input type="file" id="product-images" class="w-full" multiple accept="image/*"><div id="image-previews-container" class="mt-2 grid grid-cols-3 gap-2">${(formData.images || []).map(img => `<div class="relative"><img src="${img}" class="w-full h-auto object-cover rounded-lg" style="aspect-ratio: 3/2;"><button type="button" class="remove-image-preview-btn absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold">&times;</button></div>`).join('')}</div></div>
            <div class="border-t border-gray-700 pt-4"><h3 class="font-bold mb-2" data-lang-key="labelColors">Colors & Stock</h3><div id="color-container" class="space-y-4">${formData.colors ? Object.entries(formData.colors).map(([color, data]) => createColorEntry(color, data)).join('') : createColorEntry()}</div><button type="button" id="add-color-btn" class="btn-secondary mt-2 py-1 px-3 rounded-lg text-sm" data-lang-key="btnAddColor">+ Add Color</button></div>
            <div class="flex justify-between items-center mt-6">
             ${!product ? `<button type="button" id="clear-product-form-btn" class="btn-danger py-2 px-4 rounded-lg" data-lang-key="btnClearFields">Clear Fields</button>` : '<div></div>'}
                <div class="flex space-x-4">
                 <button type="button" id="cancel-product-modal-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="btnCancel">Cancel</button>
                 <button type="submit" class="btn-primary py-2 px-4 rounded-lg" data-action="${state.productModalSource === 'invoice' ? 'addToInvoice' : 'saveProduct'}">
                  ${state.productModalSource === 'invoice' ? translations[state.lang].addToInvoice : translations[state.lang].btnSave}
                 </button>
              </div>
            </div>
        </form>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function closeProductModal() {
    const form = document.getElementById('product-form');
    if (form && !state.editingProductId) { // Only save if it's a new product form
        state.newProductFormData = {
            name: form.querySelector('#product-name').value,
            category: form.querySelector('#product-category').value,
            purchasePrice: form.querySelector('#purchase-price').value,
            sellingPrice: form.querySelector('#selling-price').value,
            code: form.querySelector('#product-code').value,
            mainBarcode: form.querySelector('#main-barcode').value,
            colors: {}, // Note: color/size data is complex to save this way, but basic fields are kept.
        };
    }
    document.getElementById('product-modal').classList.add('hidden');
    state.editingProductId = null;
}


export function createColorEntry(colorName = '', colorData = { sizes: {} }) {
    const sizesHtml = Object.entries(colorData.sizes).map(([size, data]) => createSizeEntry(size, data)).join('');
    return `
        <div class="color-entry bg-gray-800 p-3 rounded-lg border border-gray-700">
            <div class="flex items-center space-x-2">
                <input type="text" class="color-name-input flex-grow p-2 rounded-lg" placeholder="Color Name" value="${colorName}">
                <button type="button" class="remove-color-btn btn-danger py-1 px-2 rounded-lg">&times;</button>
            </div>
            <div class="sizes-container mt-2 space-y-2 pl-4 border-l-2 border-gray-600">${sizesHtml}</div>
            <button type="button" class="add-size-btn btn-secondary mt-2 py-1 px-2 rounded-lg text-xs" data-lang-key="btnAddSize">+ Add Size</button>
        </div>`;
}

export function createSizeEntry(size = '', sizeData = { quantity: 0, barcode: '' }) {
    return `
        <div class="size-entry flex items-center space-x-2">
            <input type="text" class="size-name-input p-1 rounded-lg w-24" placeholder="Size" value="${size}">
            <input type="number" class="size-quantity-input p-1 rounded-lg w-24" placeholder="Qty" value="${sizeData.quantity}" min="0">
            <span class="text-xs text-gray-400 flex-grow">Barcode: ${sizeData.barcode || 'Auto-generated'}</span>
            <button type="button" class="remove-size-btn btn-danger py-0 px-2 rounded-md">&times;</button>
        </div>`;
}

export function showCategoryModal() {
    const modal = document.getElementById('category-modal');
    const modalContent = modal.querySelector('.modal-content');
    const categoriesHtml = state.categories.filter(c => c !== 'All').map(c => `
        <div class="flex justify-between items-center bg-gray-800 p-2 rounded space-x-2">
            <input type="text" class="category-name-input w-full p-1 rounded-lg" value="${c}" data-original-name="${c}">
            <div class="flex space-x-1">
                <button class="save-category-btn btn-primary text-xs py-1 px-2 rounded" data-original-name="${c}" data-lang-key="btnSave">Save</button>
                <button class="delete-category-btn btn-danger text-xs py-1 px-2 rounded" data-category="${c}" data-lang-key="btnDelete">Delete</button>
            </div>
        </div>
    `).join('');

    modalContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-4" data-lang-key="manageCategoriesTitle">Manage Categories</h2>
        <div class="mb-4">
            <label class="block mb-1" data-lang-key="newCategoryName">New Category Name</label>
            <div class="flex space-x-2">
                <input type="text" id="new-category-name" class="w-full p-2 rounded-lg">
                <button id="add-category-btn" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="addCategoryBtn">Add</button>
            </div>
        </div>
        <div class="border-t border-gray-700 pt-4">
            <h3 class="font-bold mb-2" data-lang-key="existingCategories">Existing Categories</h3>
            <div class="space-y-2 max-h-60 overflow-y-auto">${categoriesHtml}</div>
        </div>
        <div class="flex justify-end mt-6">
            <button id="close-category-modal-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="doneBtn">Done</button>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function closeCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
    render();
}

export function showBarcodeModal(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('barcode-modal');
    let barcodesHtml = '';
    for (const [color, colorData] of Object.entries(product.colors)) {
        for (const [size, sizeData] of Object.entries(colorData.sizes)) {
            if (sizeData.barcode) {
                barcodesHtml += `
                    <div class="p-2 border border-gray-700 rounded flex justify-between items-center">
                        <div>
                            <p>${product.name} - ${color} / ${size}</p>
                            <svg class="barcode-svg" jsbarcode-value="${sizeData.barcode}"></svg>
                        </div>
                        <button class="print-size-barcode-btn btn-secondary py-1 px-2 text-sm rounded" data-product-id="${productId}" data-color="${color}" data-size="${size}">Print</button>
                    </div>`;
            }
        }
    }

    modal.innerHTML = `
        <div class="modal-content w-full max-w-lg p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4">Barcodes for ${product.name}</h2>
            <div class="space-y-2 max-h-96 overflow-y-auto">${barcodesHtml || '<p>No barcodes generated for this product.</p>'}</div>
            <div class="flex justify-end mt-6">
                <button id="close-barcode-modal-btn" class="btn-primary py-2 px-4 rounded-lg">Close</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.querySelectorAll('.barcode-svg').forEach(svg => {
        JsBarcode(svg, svg.getAttribute('jsbarcode-value'), {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: true
        });
    });
}

export function closeBarcodeModal() {
    document.getElementById('barcode-modal').classList.add('hidden');
}

export function showReceiptSelectionModal(itemData) {
    state.itemToAdd = itemData;
    const modal = document.getElementById('receipt-selection-modal');
    const buttonsHtml = state.receipts.map((r, i) =>
        `<button class="btn-primary py-2 px-4 rounded-lg" data-receipt-id="${r.id}">${r.customerName || `Receipt ${i + 1}`}</button>`
    ).join('');

    modal.innerHTML = `
        <div class="modal-content w-full max-w-md p-6 rounded-lg shadow-lg">
            <h2 class="text-xl font-bold mb-4">Select a Receipt</h2>
            <p class="mb-4">Which receipt would you like to add this item to?</p>
            <div id="receipt-selection-buttons" class="flex flex-wrap gap-2">${buttonsHtml}</div>
            <div class="flex justify-end mt-6">
                <button id="cancel-receipt-selection-btn" class="btn-secondary py-2 px-4 rounded-lg">Cancel</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

export function closeReceiptSelectionModal() {
    document.getElementById('receipt-selection-modal').classList.add('hidden');
    state.itemToAdd = null;
}

export function showReturnModal(saleId) {
    state.returningSaleId = saleId;
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) return;

    const modal = document.getElementById('return-modal');
    const itemsContainer = document.getElementById('return-items-container');
    itemsContainer.innerHTML = sale.items.map(item => {
        const maxReturnable = item.quantity - (item.returnedQty || 0);
        if (maxReturnable <= 0) return '';
        return `
            <div class="flex justify-between items-center p-2 border-b border-gray-700">
                <span>${item.productName} (${item.color}/${item.size}) - Max: ${maxReturnable}</span>
                <input type="number" class="return-quantity-input w-20 p-1 rounded border border-gray-600" value="0" min="0" max="${maxReturnable}" data-item-id="${item.id}" data-product-id="${item.productId}" data-color="${item.color}" data-size="${item.size}" data-purchase-price="${item.purchasePrice}">
            </div>`;
    }).join('');
    document.getElementById('return-delivery-fee-input').value = '';
    modal.classList.remove('hidden');
}


export function closeReturnModal() {
    document.getElementById('return-modal').classList.add('hidden');
    state.returningSaleId = null;
    state.returnActionData = null;
}

export function showReturnTypeModal() {
    const modal = document.getElementById('return-type-modal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        console.error("Return type modal not found in the DOM.");
        utils.showNotification("Error: UI component missing.", "error");
    }
}

export function closeReturnTypeModal() {
    const modal = document.getElementById('return-type-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

export function showFreeDeliveryCostModal() {
    const modal = document.getElementById('free-delivery-cost-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('free-delivery-cost-input').focus();
    }
}

export function closeFreeDeliveryCostModal() {
    const modal = document.getElementById('free-delivery-cost-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('free-delivery-cost-input').value = '';
    }
}


export function showBookingConfirmationModal(receiptId) {
    const receipt = state.receipts.find(r => r.id === receiptId);
    if (!receipt) return;
    const modal = document.getElementById('booking-confirmation-modal');
    const summaryDiv = document.getElementById('booking-modal-summary');
    const subtotal = receipt.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    summaryDiv.innerHTML = `<p><strong>Total:</strong> ${subtotal.toFixed(2)} EGP</p>`;
    modal.classList.remove('hidden');
    document.getElementById('booking-deposit-input').focus();
}

export function closeBookingConfirmationModal() {
    document.getElementById('booking-confirmation-modal').classList.add('hidden');
}

export function showEditBookingModal(bookingId) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    state.editingBookingId = bookingId;
    const modal = document.getElementById('booking-edit-modal');
    modal.innerHTML = `
        <div class="modal-content w-full max-w-lg p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4">Edit Booking</h2>
            <form id="edit-booking-form" class="space-y-4">
                <div><label>Customer Name</label><input id="edit-customer-name" type="text" class="w-full p-2 rounded-lg" value="${booking.customerName}"></div>
                <div><label>Customer Phone</label><input id="edit-customer-phone" type="tel" class="w-full p-2 rounded-lg" value="${booking.customerPhone}"></div>
                <div><label>Customer Address</label><input id="edit-customer-address" type="text" class="w-full p-2 rounded-lg" value="${booking.customerAddress || ''}"></div>
                <div><label>City</label><input id="edit-customer-city" type="text" class="w-full p-2 rounded-lg" value="${booking.customerCity || ''}"></div>
                <div><label>Deposit (EGP)</label><input id="edit-deposit" type="number" class="w-full p-2 rounded-lg" value="${booking.deposit}"></div>
                <div>
                    <label>Deposit Payment Method</label>
                    <select id="edit-deposit-payment-method" class="w-full p-2 rounded-lg">
                        <option value="cash" ${booking.depositPaymentMethod === 'cash' ? 'selected' : ''}>Cash</option>
                        <option value="instaPay" ${booking.depositPaymentMethod === 'instaPay' ? 'selected' : ''}>InstaPay</option>
                        <option value="vCash" ${booking.depositPaymentMethod === 'vCash' ? 'selected' : ''}>VCash</option>
                    </select>
                </div>
                <div class="flex items-center"><input type="checkbox" id="edit-free-delivery" class="h-5 w-5 mr-2" ${booking.isFreeDelivery ? 'checked' : ''}><label for="edit-free-delivery">Free Delivery</label></div>
                <div class="flex justify-end space-x-4"><button type="button" id="cancel-edit-booking-btn" class="btn-secondary py-2 px-4 rounded-lg">Cancel</button><button type="submit" class="btn-primary py-2 px-4 rounded-lg">Save</button></div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
}

export function closeEditBookingModal() {
    document.getElementById('booking-edit-modal').classList.add('hidden');
    state.editingBookingId = null;
}

export function showEmployeeModal(employee = null) {
    state.editingEmployeeUsername = employee ? employee.username : null;
    const modal = document.getElementById('employee-modal');
    document.getElementById('employee-modal-title').textContent = employee ? 'Edit Employee' : 'Add New Employee';
    document.getElementById('employee-name-input').value = employee ? employee.username : '';
    document.getElementById('employee-id-input-modal').value = employee ? employee.employeeId : '';
    document.getElementById('employee-phone-input').value = employee ? employee.phone : '';
    modal.classList.remove('hidden');
}

export function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.add('hidden');
    state.editingEmployeeUsername = null;
}

export function showCustomerModal(customer = null) {
    state.editingCustomerId = customer ? customer.id : null;
    const modal = document.getElementById('customer-modal');
    document.getElementById('customer-modal-title').textContent = customer ? 'Edit Customer' : 'Add New Customer';
    document.getElementById('customer-name-input-modal').value = customer ? customer.name : '';
    document.getElementById('customer-phone-input-modal').value = customer ? customer.phone : '';
    document.getElementById('customer-address-input-modal').value = customer ? customer.address : '';
    document.getElementById('customer-city-input-modal').value = customer ? customer.city : '';
    modal.classList.remove('hidden');
}

export function closeCustomerModal() {
    document.getElementById('customer-modal').classList.add('hidden');
    state.editingCustomerId = null;
}

export function showEditCashierModal(saleId) {
    state.editingSaleId = saleId;
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) return;
    const modal = document.getElementById('edit-cashier-modal');
    const select = document.getElementById('edit-cashier-select');
    select.innerHTML = state.users.map(u => `<option value="${u.username}" ${u.username === sale.cashier ? 'selected' : ''}>${u.username}</option>`).join('');
    document.getElementById('edit-cashier-sale-id').textContent = `Editing Receipt ID: ${saleId}`;
    modal.classList.remove('hidden');
}

export function closeEditCashierModal() {
    document.getElementById('edit-cashier-modal').classList.add('hidden');
    state.editingSaleId = null;
}

export function showStockReductionOptionsModal() {
    const modal = document.getElementById('stock-reduction-confirm-modal');
    const message = document.getElementById('stock-reduction-confirm-message');
    const { productName, color, size, oldQuantity, newQuantity } = state.stockAdjustmentData;
    message.textContent = `You are reducing stock for "${productName} (${color}/${size})" from ${oldQuantity} to ${newQuantity}. How should this be handled?`;
    modal.classList.remove('hidden');
}

export function closeStockReductionOptionsModal() {
    document.getElementById('stock-reduction-confirm-modal').classList.add('hidden');
}

export function showDefectiveItemModal() {
    const modal = document.getElementById('defective-item-modal');
    const message = document.getElementById('defective-item-message');

    let itemsInfo;
    if (state.returnActionData) { // Called from return flow
        itemsInfo = state.returnActionData.itemsToProcess.map(item =>
            `${item.quantity} unit(s) of "${item.productName} (${item.color}/${item.size})"`
        ).join(', ');
    } else { // Called from stock adjustment flow
        const { productName, color, size, oldQuantity, newQuantity } = state.stockAdjustmentData;
        const reductionAmount = oldQuantity - newQuantity;
        itemsInfo = `${reductionAmount} unit(s) of "${productName} (${color}/${size})"`;
    }

    message.textContent = `Marking ${itemsInfo} as defective.`;
    document.getElementById('defective-item-form').reset();
    modal.classList.remove('hidden');
}


export function closeDefectiveItemModal() {
    document.getElementById('defective-item-modal').classList.add('hidden');
}

// --- SUPPLIER UI FUNCTIONS (Updated) ---

export function renderSuppliersPage() {
    const page = document.getElementById('suppliers-page');
    if (!page) return;

    const timeFilter = state.supplierTimeFilter;
    const monthFilter = state.supplierMonthFilter;
    const dayFilter = state.supplierDayFilter;

    let filteredShipments = state.shipments;
    let filteredPayments = state.suppliers.flatMap(s => s.payments || []);
    let filteredDefects = state.defects.filter(d => d.supplierId);

    if (timeFilter === 'month' && monthFilter) {
        filteredShipments = filteredShipments.filter(sh => sh.date.startsWith(monthFilter));
        filteredPayments = filteredPayments.filter(p => p.date.startsWith(monthFilter));
        filteredDefects = filteredDefects.filter(d => d.date.startsWith(monthFilter));
    } else if (timeFilter === 'day' && dayFilter) {
        filteredShipments = filteredShipments.filter(sh => sh.date.startsWith(dayFilter));
        filteredPayments = filteredPayments.filter(p => p.date.startsWith(dayFilter));
        filteredDefects = filteredDefects.filter(d => d.date.startsWith(dayFilter));
    }

    const totalCostForAll = filteredShipments.reduce((sum, sh) => sum + sh.totalCost, 0);
    const totalPaidForAll = filteredPayments.filter(p => p.amount > 0).reduce((sum, p) => sum + p.amount, 0);
    const totalDefectsValue = filteredDefects.reduce((sum, d) => sum + (d.purchasePrice * d.quantity), 0);
    const totalReturnsValue = filteredPayments.filter(p => p.amount < 0).reduce((sum, p) => sum + Math.abs(p.amount), 0);

    const balanceForAll = totalCostForAll - totalPaidForAll - totalDefectsValue + totalReturnsValue;

    const netCostForAll = totalCostForAll - totalDefectsValue;

    page.innerHTML = `
        <div class="flex flex-wrap justify-between items-center mb-4 gap-4">
         <h1 class="text-3xl font-bold" data-lang-key="navSuppliers">Suppliers</h1>
             <div class="flex items-center space-x-2">
              <button id="add-new-invoice-btn" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="addNewInvoice">Add New Invoice</button>
              <button id="add-supplier-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="addSupplier">Add Supplier</button>
              <button id="edit-supplier-btn" class="btn-secondary py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed" ${!state.activeSupplierId ? 'disabled' : ''} data-lang-key="editSupplierDetails">Edit Supplier</button>
              <button id="delete-supplier-btn" class="btn-danger py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed" ${!state.activeSupplierId ? 'disabled' : ''} data-lang-key="deleteSupplier">Delete Supplier</button>
           </div>
        </div>

        <div class="flex items-center space-x-4 mb-4 p-4 rounded-lg" style="background-color: var(--secondary-bg);">
            <div>
                <label for="supplier-time-filter-type" class="text-sm font-medium">Filter by:</label>
                <select id="supplier-time-filter-type" class="p-2 rounded-lg">
                    <option value="all">All Time</option>
                    <option value="month">Month</option>
                    <option value="day">Day</option>
                </select>
            </div>
            <div id="supplier-month-filter-container" class="hidden">
                <input type="month" id="supplier-report-month-picker" class="p-2 rounded-lg">
            </div>
            <div id="supplier-day-filter-container" class="hidden">
                <input type="date" id="supplier-report-day-picker" class="p-2 rounded-lg">
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="p-4 rounded-lg shadow" style="background-color: rgba(176, 136, 142, 0.2);"><h3 class="font-bold" style="color: var(--accent-color);">Invoices Summary</h3><p class="text-sm">Gross: ${totalCostForAll.toFixed(2)} EGP</p><p class="text-sm" style="color: #e76f51;">Defects: -${totalDefectsValue.toFixed(2)} EGP</p><p class="text-xl font-semibold mt-1 pt-1" style="border-top: 1px solid var(--highlight-color);">Net: ${netCostForAll.toFixed(2)} EGP</p></div>
            <div class="p-4 rounded-lg shadow" style="background-color: rgba(90, 139, 114, 0.2);"><h3 class="font-bold" style="color: var(--success-color);">Total Paid</h3><p class="text-2xl font-semibold">${totalPaidForAll.toFixed(2)} EGP</p></div>
            <div class="p-4 rounded-lg shadow" style="background-color: rgba(231, 111, 81, 0.2);"><h3 class="font-bold" style="color: #e76f51;">Total Returns Credit</h3><p class="text-2xl font-semibold">${totalReturnsValue.toFixed(2)} EGP</p></div>
            <div class="p-4 rounded-lg shadow" style="background-color: rgba(201, 124, 124, 0.2);"><h3 class="font-bold" style="color: var(--danger-color);">Remaining Balance</h3><p class="text-2xl font-semibold">${balanceForAll.toFixed(2)} EGP</p></div>
        </div>

        <div id="supplier-tabs-container" class="flex items-center space-x-2 border-b border-gray-700 mb-4 overflow-x-auto" style="border-bottom: 1px solid var(--highlight-color);"></div>
        <div id="active-supplier-content"></div>
    `;


    const timeFilterSelect = document.getElementById('supplier-time-filter-type');
    timeFilterSelect.value = state.supplierTimeFilter;
    document.getElementById('supplier-month-filter-container').classList.toggle('hidden', state.supplierTimeFilter !== 'month');
    document.getElementById('supplier-day-filter-container').classList.toggle('hidden', state.supplierTimeFilter !== 'day');
    if (monthFilter) document.getElementById('supplier-report-month-picker').value = monthFilter;
    if (dayFilter) document.getElementById('supplier-report-day-picker').value = dayFilter;

    if (state.suppliers.length > 0 && !state.activeSupplierId) {
        state.activeSupplierId = state.suppliers[0].id;
    }

    renderSupplierTabs();
    renderActiveSupplierContent(filteredShipments, filteredPayments, filteredDefects);
    updateUIText();
}

function renderSupplierTabs() {
    const container = document.getElementById('supplier-tabs-container');
    if (!container) return;
    container.innerHTML = state.suppliers.map(supplier => `
        <div class="supplier-tab whitespace-nowrap py-2 px-4 cursor-pointer ${supplier.id === state.activeSupplierId ? 'active' : ''}" data-id="${supplier.id}">
            ${supplier.name}
        </div>
    `).join('');
}

function renderActiveSupplierContent(filteredShipments, filteredPayments, filteredDefects) {
    const container = document.getElementById('active-supplier-content');
    if (!container) return;

    const supplier = state.suppliers.find(s => s.id === state.activeSupplierId);
    if (!supplier) {
        container.innerHTML = `<p class="text-center p-4" data-lang-key="noSupplierSelected">Please add and select a supplier.</p>`;
        return;
    }

    const supplierShipments = filteredShipments.filter(sh => sh.supplierId === supplier.id);
    const supplierPayments = filteredPayments.filter(p => p.supplierId === supplier.id);
    const supplierDefects = filteredDefects.filter(d => d.supplierId === supplier.id);

    const totalCost = supplierShipments.reduce((sum, sh) => sum + sh.totalCost, 0);
    const totalPaid = supplierPayments.filter(p => p.amount > 0).reduce((sum, p) => sum + p.amount, 0);

    const unreturnedDefectsValue = supplierDefects.reduce((sum, d) => {
        const unreturnedQty = d.quantity - (d.returnedQty || 0);
        return sum + (unreturnedQty * d.purchasePrice);
    }, 0);

    const totalDue = totalCost - totalPaid - unreturnedDefectsValue;
    const unreturnedDefectsCount = supplierDefects.reduce((sum, d) => sum + (d.quantity - (d.returnedQty || 0)), 0);


    const shipmentsByDate = supplierShipments.reduce((acc, shipment) => {
        const date = shipment.date.split('T')[0];
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(shipment);
        return acc;
    }, {});

    const sortedDates = Object.keys(shipmentsByDate).sort((a, b) => new Date(b) - new Date(a));

    container.innerHTML = `
        <div class="p-6 rounded-lg shadow mb-6" style="background-color: var(--secondary-bg);">
            <div class="flex flex-col md:flex-row justify-between items-start">
                <div>
                    <h2 class="text-2xl font-bold">${supplier.name}</h2>
                    <p style="color: var(--primary-text); opacity: 0.7;">${supplier.phone || 'No phone number'}</p>
                </div>
                <div class="text-left md:text-right mt-4 md:mt-0 space-y-1">
                     <p><span class="font-semibold" data-lang-key="grossInvoicesCost">Gross Invoices Cost:</span> ${totalCost.toFixed(2)} EGP</p>
                     <p><span class="font-semibold" data-lang-key="unreturnedDefectsValue">Unreturned Defects:</span> <span style="color: var(--expense-color);">-${unreturnedDefectsValue.toFixed(2)} EGP</span></p>
                     <p class="font-semibold pt-1 mt-1" style="border-top: 1px solid var(--highlight-color);"><span data-lang-key="netInvoicesCost">Net Invoices Cost:</span> ${(totalCost - unreturnedDefectsValue).toFixed(2)} EGP</p>
                     <p><span class="font-semibold" data-lang-key="totalPaid">Total Paid:</span> <span style="color: var(--success-color);">-${totalPaid.toFixed(2)} EGP</span></p>
                     <p class="text-lg font-bold pt-1 mt-1" style="border-top: 1px solid var(--highlight-color);"><span class="font-semibold" data-lang-key="totalDue">Total Due:</span> <span style="color: var(--danger-color);">${totalDue.toFixed(2)} EGP</span></p>
                    <button id="make-payment-btn" class="btn-primary mt-2 py-2 px-4 rounded-lg" data-lang-key="makePayment">Make Payment</button>
                </div>
            </div>
            
            <div class="mt-4 pt-4" style="border-top: 1px solid var(--highlight-color);">
                <div class="flex flex-col md:flex-row justify-between items-start">
                    <div>
                        <h3 class="text-lg font-bold" data-lang-key="supplierDefects">Defective Items</h3>
                        <p class="text-sm" style="color: var(--primary-text); opacity: 0.7;"><span data-lang-key="unreturnedQty">Unreturned Qty</span>: ${unreturnedDefectsCount}</p>
                        <p class="text-sm" style="color: var(--primary-text); opacity: 0.7;"><span data-lang-key="totalDefectsValue">Total Defects Value</span>: ${unreturnedDefectsValue.toFixed(2)} EGP</p>
                    </div>
                    <div class="flex items-center space-x-2 mt-2 md:mt-0">
                        <button id="add-defective-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="addDefective">Add Defective</button>
                        <button id="manage-returns-btn" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="manageReturns">Manage Returns</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
                <h3 class="text-xl font-bold mb-2" data-lang-key="dailyInvoices">Daily Invoices</h3>
                <div id="shipments-list" class="space-y-4">
                     ${sortedDates.length > 0 ? sortedDates.map(date => {
        const defectsOnThisDate = supplierDefects.filter(d => d.shipmentDate === date);
        const totalDefectiveItems = defectsOnThisDate.reduce((sum, d) => sum + d.quantity, 0);
        let defectsIndicatorHtml = '';
        if (totalDefectiveItems > 0) {
            defectsIndicatorHtml = `<span class="ml-2 text-xs font-bold px-2 py-1 rounded-full" style="background-color: rgba(231, 111, 81, 0.2); color: #e76f51;">${translations[state.lang].defectsIndicator || 'Defects:'} ${totalDefectiveItems}</span>`;
        }
        const shipmentsOnThisDate = shipmentsByDate[date];
        return `
                            <div class="p-2 rounded-lg daily-invoices-container" style="background-color: var(--primary-bg);" data-date="${date}">
                                <div class="flex justify-between items-center p-2">
                                    <h4 class="font-bold text-lg flex items-center">${new Date(date).toLocaleDateString()} ${defectsIndicatorHtml}</h4>
                                    <div class="flex items-center space-x-2">
                                        <button class="print-daily-shipment-btn btn-secondary text-xs p-2 rounded" data-date="${date}" title="${translations[state.lang].printDailyInvoice || 'Print Daily Invoice'}">
                                            <svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
                                        </button>
                                        <button class="edit-daily-shipment-btn btn-secondary text-xs p-2 rounded" data-date="${date}" title="${translations[state.lang].editInvoice || 'Edit Daily Invoice'}">
                                            <svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                                        </button>
                                        <button class="merge-selected-shipments-btn btn-primary text-xs p-2 rounded opacity-50 cursor-not-allowed" data-date="${date}" title="${translations[state.lang].mergeInvoices || 'Merge Selected'}" disabled>
                                             <svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M17 20.41L18.41 19L15 15.59L13.59 17L17 20.41M7.5 8H11V13.59L5.59 19L7 20.41L13 14.41V8H16.5L12 3.5L7.5 8Z" /></svg>
                                        </button>
                                        <button class="delete-daily-shipment-btn btn-danger text-xs p-2 rounded" data-date="${date}" title="${translations[state.lang].deleteDailyInvoice || 'Delete Daily Invoice'}">
                                            <svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                                        </button>
                                    </div>
                                </div>
                                <div class="space-y-2 mt-2">
                                ${shipmentsOnThisDate.map(shipment => {
            const totalItems = shipment.items.reduce((sum, i) => sum + i.quantity, 0);
            return `
                                        <div class="p-4 rounded-lg shadow-md daily-invoice-group flex items-center space-x-4" style="background-color: var(--secondary-bg);" data-shipment-id="${shipment.id}">
                                            <input type="checkbox" class="daily-shipment-checkbox h-5 w-5 rounded" data-shipment-id="${shipment.id}">
                                            <div class="flex-grow">
                                                <div class="flex justify-between items-center cursor-pointer daily-invoice-header">
                                                    <div>
                                                        <p class="font-bold text-md">${shipment.id}</p>
                                                        <p class="text-sm" style="color: var(--primary-text); opacity: 0.7;"><span data-lang-key="totalItems">Total Items</span>: ${totalItems}</p>
                                                        ${shipment.shippingCost > 0 ? `<p class="text-sm" style="color: var(--primary-text); opacity: 0.7;"><span data-lang-key="shippingExpense">Shipping</span>: ${shipment.shippingCost.toFixed(2)} EGP</p>` : ''}
                                                    </div>
                                                    <div class="text-right">
                                                        <p class="font-semibold text-lg">${shipment.totalCost.toFixed(2)} EGP</p>
                                                    </div>
                                                    <div class="flex items-center space-x-2">
                                                         <svg class="w-6 h-6 chevron-icon transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                                    </div>
                                                </div>
                                                <div class="daily-invoice-details hidden mt-4 pt-4" style="border-top: 1px solid var(--highlight-color);">
                                                    <table class="w-full text-sm">
                                                        <thead>
                                                            <tr style="border-bottom: 1px solid var(--highlight-color);">
                                                                <th class="p-2 text-left w-8"><input type="checkbox" class="select-all-items-checkbox"></th>
                                                                <th class="p-2 text-left" data-lang-key="colProductName">Product</th>
                                                                <th class="p-2 text-left" data-lang-key="colQuantity">Qty</th>
                                                                <th class="p-2 text-left" data-lang-key="colActions">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                        ${shipment.items.map((item, index) => `
                                                            <tr style="border-bottom: 1px solid var(--highlight-color);">
                                                                <td class="p-2"><input type="checkbox" class="shipment-item-checkbox" data-item-index="${index}"></td>
                                                                <td class="p-2">${item.productName} (${item.color}/${item.size})</td>
                                                                <td class="p-2">${item.quantity}</td>
                                                                <td class="p-2 flex space-x-1">
                                                                    <button class="edit-shipment-item-btn btn-secondary text-xs p-1 rounded" data-item-index="${index}" title="${translations[state.lang].editShipmentItem}"><svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                                                                    <button class="delete-shipment-item-btn btn-danger text-xs p-1 rounded" data-item-index="${index}" title="${translations[state.lang].btnDelete}"><svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                                                                </td>
                                                            </tr>
                                                        `).join('')}
                                                        </tbody>
                                                    </table>
                                                    <div class="text-right mt-2">
                                                        <button class="split-invoice-btn btn-primary text-xs py-1 px-3 rounded" data-lang-key="splitInvoice">Split Selected</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    `;
        }).join('')}
                                </div>
                            </div>
                        `;
    }).join('') : `<p class="text-center p-4" style="color: var(--primary-text); opacity: 0.7;" data-lang-key="noShipmentsFound">No shipments found for this period.</p>`}
                </div>
            </div>
            <div>
                <h3 class="text-xl font-bold mb-2" data-lang-key="paymentsList">Payments List</h3>
                <div id="payments-list" class="space-y-2 p-4 rounded-lg shadow-md" style="background-color: var(--secondary-bg);">
                    ${supplierPayments.length > 0 ? `
                        <table class="w-full text-sm">
                            <thead><tr style="border-bottom: 1px solid var(--highlight-color);"><th class="text-left" data-lang-key="colPaymentDate">Date</th><th class="text-left" data-lang-key="colPaymentAmount">Amount</th><th class="text-left" data-lang-key="colActions">Actions</th></tr></thead>
                            <tbody>
                                ${supplierPayments.map(p => `
                                    <tr style="border-bottom: 1px solid var(--highlight-color);">
                                        <td class="py-2">${new Date(p.date).toLocaleDateString()}</td>
                                        <td class="py-2" style="${p.type === 'return' ? 'color: var(--danger-color);' : ''}">${p.amount.toFixed(2)} EGP ${p.type === 'return' ? '(Return)' : ''}</td>
                                        <td class="py-2">
                                            <button class="edit-payment-btn btn-secondary text-xs p-1 rounded" data-id="${p.id}" title="Edit Payment"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                                            <button class="delete-payment-btn btn-danger text-xs p-1 rounded" data-id="${p.id}" title="Delete Payment"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : `<p class="text-center p-4" style="color: var(--primary-text); opacity: 0.7;" data-lang-key="noPaymentsFound">No payments found for this period.</p>`}
                </div>
            </div>
        </div>
    `;
    updateUIText();
}

export function showSupplierModal(supplier = null) {
    state.editingSupplierId = supplier ? supplier.id : null;
    const modal = document.getElementById('supplier-modal');
    modal.innerHTML = `
        <div class="modal-content w-full max-w-md p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4">${supplier ? translations[state.lang].editSupplier : translations[state.lang].addSupplier}</h2>
            <form id="supplier-form" class="space-y-4">
                <div><label class="block mb-1" data-lang-key="supplierName">Supplier Name</label><input type="text" id="supplier-name-input" class="w-full p-2 rounded-lg" value="${supplier?.name || ''}" required></div>
                <div><label class="block mb-1" data-lang-key="supplierPhone">Supplier Phone</label><input type="tel" id="supplier-phone-input" class="w-full p-2 rounded-lg" value="${supplier?.phone || ''}"></div>
                <div class="flex justify-end space-x-4 pt-4">
                    <button type="button" id="cancel-supplier-modal-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="btnCancel">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="btnSave">Save</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function closeSupplierModal() {
    document.getElementById('supplier-modal').classList.add('hidden');
    state.editingSupplierId = null;
}

export function showSupplierPaymentModal(supplierId) {
    const modal = document.getElementById('supplier-payment-modal');
    modal.innerHTML = `
        <div class="modal-content w-full max-w-sm p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4" data-lang-key="makePayment">Make Payment</h2>
            <form id="supplier-payment-form" data-id="${supplierId}">
                <label for="payment-amount-input" class="block mb-2" data-lang-key="paymentAmount">Payment Amount (EGP)</label>
                <input type="number" id="payment-amount-input" class="w-full p-2 rounded-lg mb-4" required min="0.01" step="0.01">
                <div class="flex justify-end space-x-4">
                    <button type="button" id="cancel-payment-modal-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="btnCancel">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="confirmPayment">Confirm</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function closeSupplierPaymentModal() {
    document.getElementById('supplier-payment-modal').classList.add('hidden');
}

export function showSelectSupplierModal() {
    const modal = document.getElementById('select-supplier-modal');
    const supplierOptions = state.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    modal.innerHTML = `
        <div class="modal-content w-full max-w-md p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4" data-lang-key="assignToSupplier">Assign to Supplier</h2>
            <p class="mb-4" data-lang-key="selectSupplier">Select a supplier for this stock increase.</p>
            <form id="select-supplier-form">
                <label for="supplier-select-input" class="block mb-1">Supplier</label>
                <select id="supplier-select-input" class="w-full p-2 rounded-lg mb-4" required>
                    <option value="">-- Select --</option>
                    ${supplierOptions}
                </select>
                <label for="shipment-shipping-cost" class="block mb-1" data-lang-key="shippingExpense">Shipping Cost (EGP)</label>
                <input type="number" id="shipment-shipping-cost" class="w-full p-2 rounded-lg mb-4" value="0" min="0" step="0.01">
                <div class="flex justify-end space-x-4">
                    <button type="button" id="cancel-select-supplier-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="btnCancel">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="btnOK">OK</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function closeSelectSupplierModal() {
    document.getElementById('select-supplier-modal').classList.add('hidden');
}

export function showEditShipmentModal(date) {
    state.editingShipmentDate = date;
    const shipmentsOnDate = state.shipments.filter(s => s.supplierId === state.activeSupplierId && s.date.startsWith(date));
    const totalShippingCost = shipmentsOnDate.reduce((sum, s) => sum + (s.shippingCost || 0), 0);

    const modal = document.getElementById('supplier-modal');
    modal.innerHTML = `
        <div class="modal-content w-full max-w-sm p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4" data-lang-key="editInvoice">Edit Invoice</h2>
            <form id="edit-shipment-form">
                <div class="mb-4">
                    <label for="edit-shipment-date-input" class="block mb-2" data-lang-key="invoiceDate">Invoice Date</label>
                    <input type="date" id="edit-shipment-date-input" class="w-full p-2 rounded-lg" value="${date}" required>
                </div>
                <div class="mb-4">
                    <label for="edit-shipment-shipping-cost" class="block mb-2" data-lang-key="shippingExpense">Total Shipping Cost</label>
                    <input type="number" id="edit-shipment-shipping-cost" class="w-full p-2 rounded-lg" value="${totalShippingCost}" min="0" step="0.01">
                </div>
                <div class="flex justify-end space-x-4">
                    <button type="button" class="btn-secondary py-2 px-4 rounded-lg" onclick="this.closest('.modal').classList.add('hidden')">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg">Save</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function showEditPaymentModal(paymentId) {
    state.editingPaymentId = paymentId;
    const payment = state.suppliers.flatMap(s => s.payments || []).find(p => p.id === paymentId);
    if (!payment) return;

    const modal = document.getElementById('supplier-modal');
    modal.innerHTML = `
        <div class="modal-content w-full max-w-sm p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4" data-lang-key="editPayment">Edit Payment</h2>
            <form id="edit-payment-form">
                <div>
                    <label for="edit-payment-amount-input" class="block mb-1" data-lang-key="paymentAmount">Amount</label>
                    <input type="number" id="edit-payment-amount-input" class="w-full p-2 rounded-lg mb-2" value="${payment.amount}" required>
                </div>
                <div>
                    <label for="edit-payment-date-input" class="block mb-1" data-lang-key="paymentDate">Date</label>
                    <input type="date" id="edit-payment-date-input" class="w-full p-2 rounded-lg mb-4" value="${payment.date.split('T')[0]}" required>
                </div>
                <div class="flex justify-end space-x-4">
                    <button type="button" class="btn-secondary py-2 px-4 rounded-lg" onclick="this.closest('.modal').classList.add('hidden')">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg">Save</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function showAddDefectiveModal(supplierId) {
    const supplier = state.suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    const modal = document.getElementById('supplier-defect-modal');
    const productOptions = state.products
        .map(p => `<option value="${p.id}">${p.name} - ${p.code || 'N/A'}</option>`)
        .join('');

    modal.innerHTML = `
        <div class="modal-content w-full max-w-lg p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4" data-lang-key="addDefectiveItemTitle">Add Defective Item for ${supplier.name}</h2>
            <form id="add-defective-form" class="space-y-4">
                <input type="hidden" id="defective-supplier-id" value="${supplierId}">
                <div>
                    <label for="defective-product-select" class="block mb-1">Product</label>
                    <select id="defective-product-select" class="w-full p-2 rounded-lg" required>
                        <option value="">-- Select Product --</option>
                        ${productOptions}
                    </select>
                </div>
                <div id="defective-details-container" class="space-y-4 hidden">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="defective-color-select" class="block mb-1">Color</label>
                            <select id="defective-color-select" class="w-full p-2 rounded-lg"></select>
                        </div>
                        <div>
                            <label for="defective-size-select" class="block mb-1">Size</label>
                            <select id="defective-size-select" class="w-full p-2 rounded-lg"></select>
                        </div>
                    </div>
                    <div>
                        <label for="defective-shipment-select" class="block mb-1" data-lang-key="labelShipmentDate">Invoice Date</label>
                        <select id="defective-shipment-select" class="w-full p-2 rounded-lg" required>
                        </select>
                    </div>
                </div>
                <div>
                    <label for="defective-quantity-input" class="block mb-1">Defective Quantity</label>
                    <input type="number" id="defective-quantity-input" class="w-full p-2 rounded-lg" min="1" required>
                </div>
                 <div>
                    <label for="defective-reason-input" class="block mb-1">Reason</label>
                    <input type="text" id="defective-reason-input" class="w-full p-2 rounded-lg" required>
                </div>
                <div class="flex justify-end space-x-4 pt-4">
                    <button type="button" id="cancel-add-defective-btn" class="btn-secondary py-2 px-4 rounded-lg">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg">Save Defective</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function showReturnDefectsModal(supplierId) {
    if (!supplierId) {
        console.error("showReturnDefectsModal called without a supplierId.");
        return;
    }
    const supplier = state.suppliers.find(s => s.id === supplierId);
    if (!supplier) {
        console.error(`Supplier with ID ${supplierId} not found.`);
        return;
    }

    const modal = document.getElementById('supplier-return-modal');
    if (!modal) {
        console.error("The modal element with ID 'supplier-return-modal' was not found in the DOM.");
        return;
    }

    const unreturnedDefects = state.defects.filter(d => {
        const hasQuantity = typeof d.quantity === 'number';
        if (!hasQuantity) {
            console.warn("Defect item found with invalid quantity:", d);
        }
        return d.supplierId === supplierId && hasQuantity && ((d.quantity - (d.returnedQty || 0)) > 0);
    });

    let tableRowsHtml = unreturnedDefects.map(defect => {
        const quantity = Number(defect.quantity) || 0;
        const returnedQty = Number(defect.returnedQty) || 0;
        const unreturnedQty = quantity - returnedQty;

        return `
            <tr style="border-bottom: 1px solid var(--highlight-color);">
                <td class="p-2">${defect.productName || 'Unnamed Product'} (${defect.color || 'N/A'}/${defect.size || 'N/A'})</td>
                <td class="p-2">${unreturnedQty}</td>
                <td class="p-2">
                    <input type="number" class="return-defect-qty-input w-20 p-1 rounded" style="border: 1px solid var(--highlight-color);" value="0" min="0" max="${unreturnedQty}" data-defect-id="${defect.id}">
                </td>
            </tr>
        `;
    }).join('');

    if (unreturnedDefects.length === 0) {
        tableRowsHtml = `<tr><td colspan="3" class="text-center p-4" data-lang-key="noDefectsToReturn">No defective items to return.</td></tr>`;
    }

    modal.innerHTML = `
        <div class="modal-content w-full max-w-2xl p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4" data-lang-key="returnDefectiveItemsTitle">Return Defective Items to ${supplier.name}</h2>
            <form id="return-defects-form">
                <div class="max-h-96 overflow-y-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--highlight-color);">
                                <th class="p-2 text-left" data-lang-key="item">Item</th>
                                <th class="p-2 text-left" data-lang-key="unreturnedQty">Unreturned Qty</th>
                                <th class="p-2 text-left" data-lang-key="quantityToReturn">Qty to Return</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>
                <div class="flex justify-end space-x-4 pt-4 mt-4" style="border-top: 1px solid var(--highlight-color);">
                    <button type="button" id="cancel-return-defects-btn" class="btn-secondary py-2 px-4 rounded-lg">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg" ${unreturnedDefects.length === 0 ? 'disabled' : ''}>Return Selected</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function closeAddDefectiveModal() {
    document.getElementById('supplier-defect-modal').classList.add('hidden');
}

export function closeReturnDefectsModal() {
    document.getElementById('supplier-return-modal').classList.add('hidden');
}

export function showEditShipmentItemModal(shipmentId, itemIndex) {
    state.editingShipmentInfo = { shipmentId, itemIndex };
    const shipment = state.shipments.find(s => s.id === shipmentId);
    if (!shipment) return;
    const item = shipment.items[itemIndex];
    if (!item) return;

    const modal = document.getElementById('shipment-item-modal');
    modal.innerHTML = `
        <div class="modal-content w-full max-w-sm p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4" data-lang-key="editShipmentItem">Edit Item</h2>
            <p class="mb-4">${item.productName} (${item.color}/${item.size})</p>
            <form id="edit-shipment-item-form">
                <label for="edit-item-quantity-input" class="block mb-2" data-lang-key="newQuantity">New Quantity</label>
                <input type="number" id="edit-item-quantity-input" class="w-full p-2 rounded-lg mb-4" required min="1" value="${item.quantity}">
                <div class="flex justify-end space-x-4">
                    <button type="button" id="cancel-edit-item-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="btnCancel">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="btnSave">Save</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function closeEditShipmentItemModal() {
    document.getElementById('shipment-item-modal').classList.add('hidden');
    state.editingShipmentInfo = null;

}
// [--- إضافة ---] دوال خاصة بنافذة إنشاء فاتورة المورد
/**
 * تعرض النافذة الرئيسية لإنشاء فاتورة جديدة.
 */
export function showInvoiceBuilderModal() {
    state.newInvoiceBuilder.isOpen = true;
    state.newInvoiceBuilder.supplierId = state.activeSupplierId; // تحديد المورد النشط تلقائياً
    state.newInvoiceBuilder.date = new Date().toISOString().slice(0, 10); // تاريخ اليوم
    const modal = document.getElementById('invoice-builder-modal');
    modal.classList.remove('hidden');
    renderInvoiceBuilder();
}

/**
 * تغلق النافذة الرئيسية لإنشاء فاتورة وتفرغ بياناتها.
 */
export function closeInvoiceBuilderModal() {
    state.newInvoiceBuilder = {
        isOpen: false,
        supplierId: null,
        date: '',
        shippingCost: 0,
        items: [],
        editingItemIndex: null,
    };
    document.getElementById('invoice-builder-modal').classList.add('hidden');
}

/**
 * تعرض المحتوى الديناميكي لنافذة إنشاء الفاتورة.
 */
export function renderInvoiceBuilder() {
    const { supplierId, date, shippingCost, items } = state.newInvoiceBuilder;
    const modal = document.getElementById('invoice-builder-modal');
    const modalContent = modal.querySelector('.modal-content');
    const supplier = state.suppliers.find(s => s.id === supplierId);

    if (!supplier) {
        modalContent.innerHTML = `<p>Please select a supplier first.</p>`;
        return;
    }

    const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0) + shippingCost;

    modalContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-4" data-lang-key="invoiceBuilderTitle">New Supplier Invoice</h2>
        
        <!-- معلومات الفاتورة الأساسية -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-900 rounded-lg">
            <div>
                <label class="block text-sm font-medium text-gray-400" data-lang-key="supplierName">Supplier</label>
                <p class="text-lg font-semibold">${supplier.name}</p>
            </div>
            <div>
                <label for="invoice-date-input" class="block text-sm font-medium text-gray-400" data-lang-key="invoiceDate">Invoice Date</label>
                <input type="date" id="invoice-date-input" class="w-full p-2 rounded-lg mt-1" value="${date}">
            </div>
            <div>
                <label for="invoice-shipping-cost-input" class="block text-sm font-medium text-gray-400" data-lang-key="shippingExpense">Shipping Cost</label>
                <input type="number" id="invoice-shipping-cost-input" class="w-full p-2 rounded-lg mt-1" value="${shippingCost}" min="0">
            </div>
        </div>

        <!-- أزرار إضافة المنتجات -->
        <div class="flex items-center space-x-4 mb-4">
            <h3 class="text-xl font-bold" data-lang-key="addProductToInvoice">Add Product</h3>
            <button id="add-existing-product-to-invoice-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="addExistingProduct">Add Existing</button>
            <button id="add-new-product-to-invoice-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="addNewProductToInvoice">Add New</button>
        </div>

        <!-- قائمة أصناف الفاتورة -->
        <h3 class="text-xl font-bold mb-2" data-lang-key="invoiceItems">Invoice Items</h3>
        <div id="invoice-items-container" class="space-y-2 mb-4">
            ${items.map((item, index) => renderInvoiceItem(item, index)).join('') || `<p class="text-gray-500">No items added yet.</p>`}
        </div>

        <!-- الإجمالي وأزرار الحفظ -->
        <div class="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
            <div>
                <span class="text-xl font-bold" data-lang-key="totalInvoiceCost">Total Cost:</span>
                <span id="invoice-total-cost-display" class="text-2xl font-bold text-[var(--accent-color)]">${totalCost.toFixed(2)} EGP</span>
            </div>
            <div class="flex space-x-4">
                <button id="cancel-invoice-builder-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="btnCancel">Cancel</button>
                <button id="save-invoice-btn" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="saveInvoice">Save Invoice</button>
            </div>
        </div>
    `;
    updateUIText();
}

/**
 * تعرض صفًا واحدًا لمنتج داخل قائمة الفاتورة.
 * @param {object} item - بيانات المنتج في الفاتورة.
 * @param {number} index - فهرس المنتج في القائمة.
 */
function renderInvoiceItem(item, index) {
    const isEditing = state.newInvoiceBuilder.editingItemIndex === index;
    const product = state.products.find(p => p.id === item.productId);
    if (!product) return '';

    // عرض تفاصيل الكميات
    const quantitiesSummary = Object.entries(item.quantities)
        .flatMap(([color, sizes]) =>
            Object.entries(sizes)
                .filter(([_, qty]) => qty > 0)
                .map(([size, qty]) => `${qty} x ${color}/${size}`)
        )
        .join(', ');

    return `
        <div class="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <div class="flex justify-between items-center cursor-pointer" data-action="toggle-details" data-index="${index}">
                <div>
                    <p class="font-bold">${product.name} <span class="text-sm text-gray-400">(${product.code || 'N/A'})</span></p>
                    <p class="text-xs text-gray-400">${quantitiesSummary}</p>
                </div>
                <div class="text-right">
                    <p class="font-semibold">${item.totalCost.toFixed(2)} EGP</p>
                    <div class="flex items-center space-x-2 mt-1">
                        <button class="edit-invoice-item-btn btn-secondary text-xs p-1 rounded" data-index="${index}">Edit</button>
                        <button class="delete-invoice-item-btn btn-danger text-xs p-1 rounded" data-index="${index}">Delete</button>
                    </div>
                </div>
            </div>
            ${isEditing ? `
            <div class="invoice-item-details mt-4 pt-4 border-t border-gray-600">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    ${Object.entries(product.colors).map(([color, colorData]) =>
        Object.keys(colorData.sizes).map(size => `
                            <div class="flex items-center space-x-2">
                                <label class="text-sm w-20">${color}/${size}:</label>
                                <input type="number" class="invoice-item-qty-input w-20 p-1 rounded" 
                                       value="${item.quantities[color]?.[size] || 0}" min="0" 
                                       data-index="${index}" data-color="${color}" data-size="${size}">
                            </div>
                        `).join('')
    ).join('')}
                </div>
                <div class="text-right mt-2">
                    <button class="save-invoice-item-changes-btn btn-primary text-xs py-1 px-2 rounded" data-index="${index}">Save Changes</button>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

/**
 * تعرض نافذة لاختيار منتج موجود لإضافته للفاتورة.
 */
export function showAddExistingProductModal() {
    const modal = document.getElementById('product-modal'); // Reuse existing modal
    const modalContent = modal.querySelector('.modal-content');

    const productOptions = state.products
        .map(p => `<option value="${p.id}">${p.name} (${p.code || 'N/A'})</option>`)
        .join('');

    modalContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-4" data-lang-key="selectProductToAdd">Select Product to Add</h2>
        <div class="space-y-4">
            <select id="existing-product-select" class="w-full p-2 rounded-lg">
                <option value="">-- Select --</option>
                ${productOptions}
            </select>
            <div class="flex justify-end space-x-4">
                <button id="cancel-add-existing-product-btn" class="btn-secondary py-2 px-4 rounded-lg">Cancel</button>
                <button id="confirm-add-existing-product-btn" class="btn-primary py-2 px-4 rounded-lg" disabled>Next</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

/**
 * تغلق نافذة اختيار المنتج.
 */
export function closeAddExistingProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

/**
 * تعرض نافذة لإدخال كميات المنتج المختار.
 * @param {string} productId - معرّف المنتج.
 */
export function showProductQuantityModal(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('product-modal'); // Reuse
    const modalContent = modal.querySelector('.modal-content');

    modalContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-4" data-lang-key="productQuantities">${product.name}</h2>
        <div id="product-quantity-form" class="space-y-4" data-product-id="${productId}">
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${Object.entries(product.colors).map(([color, colorData]) =>
        Object.keys(colorData.sizes).map(size => `
                        <div class="flex items-center space-x-2">
                            <label class="text-sm w-24">${color} / ${size}</label>
                            <input type="number" class="product-quantity-input p-2 rounded-lg w-full" min="0" placeholder="0" data-color="${color}" data-size="${size}">
                        </div>
                    `).join('')
    ).join('')}
            </div>
            <div class="flex justify-end space-x-4">
                <button id="cancel-quantity-modal-btn" class="btn-secondary py-2 px-4 rounded-lg">Cancel</button>
                <button id="save-quantities-to-invoice-btn" class="btn-primary py-2 px-4 rounded-lg">Add to Invoice</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

/**
 * تغلق نافذة إدخال الكميات.
 */
export function closeProductQuantityModal() {
    document.getElementById('product-modal').classList.add('hidden');
}
/**
 * [--- إضافة ---]
 * تحديث إجمالي الفاتورة فقط دون إعادة رسم النافذة بأكملها.
 */
export function updateInvoiceBuilderTotals() {
    const { shippingCost, items } = state.newInvoiceBuilder;
    const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0) + shippingCost;
    const totalEl = document.getElementById('invoice-total-cost-display');
    if (totalEl) {
        totalEl.textContent = `${totalCost.toFixed(2)} EGP`;
    }
}
/**
 * [--- إضافة ---]
 * دالة لعرض صفحة الإعدادات الجديدة.
 */
function renderSettingsPage() {
    const page = document.getElementById('settings-page');
    if (!page) return;

    page.innerHTML = `
    <h1 class="text-3xl font-bold mb-6" data-lang-key="settingsTitle">Application Settings</h1>
    <div class="bg-secondary-bg p-6 rounded-lg shadow">
        <h2 class="text-2xl font-bold mb-4" data-lang-key="backupAndRestore">Backup & Restore</h2>
        <div class="flex items-center space-x-4">
            <button id="backup-db-btn" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="backupBtn">Backup Database</button>
            <button id="restore-db-btn" class="btn-danger py-2 px-4 rounded-lg" data-lang-key="restoreBtn">Restore Database</button>
        </div>
    </div>
`;
    updateUIText(); // للتأكد من ترجمة النصوص الجديدة
}

// [--- تعديل ---] دوال جديدة لصفحة اليوميات مع إضافة الفلتر
function renderShiftsPage() {
    const page = document.getElementById('shifts-page');
    if (!page) return;

    // if (!state.shiftDateFilter) {
    //     state.shiftDateFilter = new Date().toISOString().slice(0, 10);
    //     state.shiftDateFilter = currentDate;
    // }

    page.innerHTML = `
        <div class="flex justify-between items-center mb-6" >
            <h1 class="text-3xl font-bold" data-lang-key="navShifts">Shifts</h1>
            <div class="flex items-center space-x-2">
                <button id="add-daily-expense-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="addDailyExpense">Add Daily Expense</button>
                <button id="calculate-shift-btn" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="calculateCurrentShift">Calculate Current Shift</button>
            </div>
        </div>
        <div class="flex justify-between items-center mb-4">
             <h2 class="text-2xl font-bold" data-lang-key="filters">Filters</h2>
             <input type="date" id="shift-history-date-filter" class="p-2 rounded-lg bg-secondary-bg">
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h2 class="text-2xl font-bold mb-4" data-lang-key="shiftHistory">Shift History</h2>
                <div id="shift-history-container"></div>
            </div>
            <div>
                <h2 class="text-2xl font-bold mb-4" data-lang-key="dailyExpenses">Daily Expenses</h2>
                <div id="daily-expenses-container"></div>
            </div>
        </div>
    `;

    document.getElementById('shift-history-date-filter').value = state.shiftDateFilter;

    renderShiftHistoryAndExpenses();
    updateUIText();
}


function renderShiftHistoryAndExpenses() {
    const historyContainer = document.getElementById('shift-history-container');
    const expensesContainer = document.getElementById('daily-expenses-container');
    if (!historyContainer || !expensesContainer) return;

    // قراءة التاريخ المحدد مباشرة من الـ state
    const selectedDate = state.shiftDateFilter;

    // عرض سجل اليوميات
    const filteredShifts = selectedDate ? state.shifts.filter(shift => shift.endedAt.startsWith(selectedDate)) : state.shifts;
    const sortedShifts = filteredShifts.sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt));

    if (sortedShifts.length === 0) {
        historyContainer.innerHTML = `<p class="text-center text-gray-400 p-4">No completed shifts found for this date.</p>`;
    } else {
        historyContainer.innerHTML = sortedShifts.map(shift => {
            const difference = shift.reconciliation.difference;
            let diffClass = 'text-gray-400';
            if (difference > 0) diffClass = 'text-green-400';
            if (difference < 0) diffClass = 'text-red-400';

            return `
                <div class="bg-secondary-bg p-4 rounded-lg shadow-md mb-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-lg" data-lang-key="shiftNumber">Shift #${shift.id}</p>
                            <p class="text-xs text-gray-400" data-lang-key="endedBy">Ended By: ${shift.endedBy}</p>
                            <p class="text-xs text-gray-400">${new Date(shift.startedAt).toLocaleString()} - ${new Date(shift.endedAt).toLocaleString()}</p>
                        </div>
                        <div class="text-right">
                            <p><span data-lang-key="totalSales">Total Sales:</span> <span class="font-semibold text-green-400">${shift.summary.totalSales.toFixed(2)} EGP</span></p>
                            <p><span data-lang-key="difference">Difference:</span> <span class="font-semibold ${diffClass}">${difference.toFixed(2)} EGP</span></p>
                        </div>
                    </div>
                    <div class="flex justify-end space-x-2 mt-2">
                        <button class="view-shift-details-btn btn-secondary text-xs py-1 px-3 rounded" data-shift-id="${shift.id}">View Details</button>
                        <button class="reopen-shift-btn btn-danger text-xs py-1 px-3 rounded" data-shift-id="${shift.id}" data-lang-key="reopenShift">Re-open</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // عرض المصاريف اليومية
    const filteredExpenses = selectedDate ? state.expenses.daily.filter(e => e.date.startsWith(selectedDate)) : state.expenses.daily;

    if (filteredExpenses.length === 0) {
        expensesContainer.innerHTML = `<p class="text-center text-gray-400 p-4">No expenses recorded for this date.</p>`;
    } else {
        expensesContainer.innerHTML = filteredExpenses.map(expense => `
            <div class="bg-secondary-bg p-3 rounded-lg mb-2 flex justify-between items-center">
                <div>
                    <p class="font-semibold">${expense.notes || 'No notes'}</p>
                    <p class="text-sm text-red-400">${expense.amount.toFixed(2)} EGP</p>
                    <p class="text-xs text-gray-500">By: ${expense.cashier} at ${new Date(expense.date).toLocaleTimeString()}</p>
                </div>
                <div class="flex space-x-2">
                    <button class="edit-expense-btn btn-secondary text-xs py-1 px-2 rounded" data-expense-id="${expense.id}">Edit</button>
                    <button class="delete-expense-btn btn-danger text-xs py-1 px-2 rounded" data-expense-id="${expense.id}">Delete</button>
                </div>
            </div>
        `).join('');
    }
    updateUIText();
}

// [--- إضافة ---] دوال النوافذ المنبثقة لليوميات
export function showDailyExpenseModal() {
    const modal = document.getElementById('daily-expense-modal');
    modal.innerHTML = `
        <div class="modal-content w-full max-w-sm p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4" data-lang-key="addDailyExpense">Add Daily Expense</h2>
            <form id="daily-expense-form">
                <div class="mb-4">
                    <label for="expense-amount-input" class="block mb-2" data-lang-key="expenseAmount">Amount (EGP)</label>
                    <input type="number" id="expense-amount-input" class="w-full p-2 rounded-lg" required min="0.01" step="0.01">
                </div>
                <div class="mb-4">
                    <label for="expense-notes-input" class="block mb-2" data-lang-key="expenseNotes">Notes</label>
                    <textarea id="expense-notes-input" class="w-full p-2 rounded-lg" rows="3"></textarea>
                </div>
                <div class="flex justify-end space-x-4">
                    <button type="button" id="cancel-daily-expense-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="btnCancel">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="saveExpense">Save Expense</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function closeDailyExpenseModal() {
    document.getElementById('daily-expense-modal').classList.add('hidden');
}

export function showShiftCalculationModal(shiftData) {
    const modal = document.getElementById('shift-calculation-modal');
    const { summary, sales, returns, expenses, startedAt, endedAt, endedBy, id, isCurrent } = shiftData;

    const salesHtml = sales.length > 0 ? sales.map(s => `<li>${s.id}: ${s.totalAmount.toFixed(2)} EGP (${s.paymentMethod})</li>`).join('') : '<li>No sales in this shift.</li>';
    const returnsHtml = returns.length > 0 ? returns.map(r => `<li>${r.originalSaleId}: ${r.returnValue.toFixed(2)} EGP</li>`).join('') : '<li>No returns in this shift.</li>';
    const expensesHtml = expenses.length > 0 ? expenses.map(e => `<li>${e.notes}: ${e.amount.toFixed(2)} EGP</li>`).join('') : '<li>No expenses in this shift.</li>';

    modal.innerHTML = `
        <div class="modal-content modal-content-scrollable w-full max-w-2xl p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4" data-lang-key="${isCurrent ? 'currentShiftDetails' : 'shiftReport'}">${isCurrent ? 'Current Shift Details' : `Shift Report #${id}`}</h2>
            <div class="text-sm text-gray-400 mb-4">
                <p><strong data-lang-key="shiftStart">Shift Start:</strong> ${new Date(startedAt).toLocaleString()}</p>
                ${!isCurrent ? `<p><strong>Ended:</strong> ${new Date(endedAt).toLocaleString()} by <strong>${endedBy}</strong></p>` : ''}
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div class="bg-gray-800 p-3 rounded">
                    <h3 class="font-bold mb-2" data-lang-key="totalSales">Sales</h3>
                    <ul class="text-xs list-disc list-inside">${salesHtml}</ul>
                </div>
                <div class="bg-gray-800 p-3 rounded">
                    <h3 class="font-bold mb-2" data-lang-key="totalReturns">Returns</h3>
                    <ul class="text-xs list-disc list-inside">${returnsHtml}</ul>
                </div>
                <div class="bg-gray-800 p-3 rounded">
                    <h3 class="font-bold mb-2" data-lang-key="dailyExpenses">Expenses</h3>
                    <ul class="text-xs list-disc list-inside">${expensesHtml}</ul>
                </div>
            </div>

            <div class="border-t border-gray-700 pt-4">
                <p class="flex justify-between"><span>Total Sales:</span> <span>${summary.totalSales.toFixed(2)} EGP</span></p>
                <p class="flex justify-between"><span> - Cash:</span> <span>${summary.totalCashSales.toFixed(2)} EGP</span></p>
                <p class="flex justify-between"><span> - InstaPay:</span> <span>${summary.totalInstaPaySales.toFixed(2)} EGP</span></p>
                <p class="flex justify-between"><span> - VCash:</span> <span>${summary.totalVCashSales.toFixed(2)} EGP</span></p>
                <p class="flex justify-between text-red-400"><span>Total Returns:</span> <span>-${summary.totalReturnsValue.toFixed(2)} EGP</span></p>
                <p class="flex justify-between text-red-400"><span>Daily Expenses:</span> <span>-${summary.totalDailyExpenses.toFixed(2)} EGP</span></p>
                <p class="flex justify-between font-bold text-lg mt-2 border-t border-gray-600 pt-2" data-lang-key="expectedCash"><span>Expected in Drawer:</span> <span class="text-green-400">${summary.expectedInDrawer.toFixed(2)} EGP</span></p>
            </div>

            <div class="flex justify-end space-x-4 mt-6">
                <button type="button" id="cancel-shift-calculation-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="btnCancel">Close</button>
                ${isCurrent ? `<button type="button" id="end-shift-btn" class="btn-primary py-2 px-4 rounded-lg" data-expected="${summary.expectedInDrawer}" data-lang-key="endAndReconcile">End & Reconcile</button>` : ''}
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function closeShiftCalculationModal() {
    document.getElementById('shift-calculation-modal').classList.add('hidden');
}

export function showReconciliationModal(expectedAmount) {
    const modal = document.getElementById('reconciliation-modal');
    modal.innerHTML = `
        <div class="modal-content w-full max-w-sm p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4" data-lang-key="cashReconciliation">Cash Reconciliation</h2>
            <p class="mb-4">Expected amount in drawer: <strong class="text-green-400">${expectedAmount.toFixed(2)} EGP</strong></p>
            <form id="reconciliation-form">
                <div class="mb-4">
                    <label for="reconciliation-amount-input" class="block mb-2" data-lang-key="actualCash">Actual Amount in Drawer</label>
                    <input type="number" id="reconciliation-amount-input" class="w-full p-2 rounded-lg" required min="0" step="0.01">
                </div>
                <div class="flex justify-end space-x-4">
                    <button type="button" id="cancel-reconciliation-btn" class="btn-secondary py-2 px-4 rounded-lg" data-lang-key="btnCancel">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg" data-lang-key="confirmEndShift">Confirm & End Shift</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    document.getElementById('reconciliation-amount-input').focus();
    updateUIText();
}

export function closeReconciliationModal() {
    document.getElementById('reconciliation-modal').classList.add('hidden');


}
export function showEditDailyExpenseModal(expense) {
    state.editingExpenseId = expense.id;
    const modal = document.getElementById('edit-daily-expense-modal');
    modal.innerHTML = `
        <div class="modal-content w-full max-w-sm p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4">Edit Daily Expense</h2>
            <form id="edit-daily-expense-form">
                <div class="mb-4">
                    <label for="edit-expense-amount-input" class="block mb-2">Amount (EGP)</label>
                    <input type="number" id="edit-expense-amount-input" class="w-full p-2 rounded-lg" required value="${expense.amount}" min="0.01" step="0.01">
                </div>
                <div class="mb-4">
                    <label for="edit-expense-notes-input" class="block mb-2">Notes</label>
                    <textarea id="edit-expense-notes-input" class="w-full p-2 rounded-lg" rows="3">${expense.notes}</textarea>
                </div>
                <div class="flex justify-end space-x-4">
                    <button type="button" id="cancel-edit-expense-btn" class="btn-secondary py-2 px-4 rounded-lg">Cancel</button>
                    <button type="submit" class="btn-primary py-2 px-4 rounded-lg">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    modal.classList.remove('hidden');
    updateUIText();
}

export function closeEditDailyExpenseModal() {
    document.getElementById('edit-daily-expense-modal').classList.add('hidden');
    state.editingExpenseId = null;
}
