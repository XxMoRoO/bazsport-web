/**
 * js/events.js (النسخة الكاملة للويب)
 * * يحتوي هذا الملف على دالة `setupEventListeners` وجميع دوال معالجة الأحداث (event handlers).
 * تم تعديله بالكامل لإزالة الاعتماد على `window.api` واستخدام دوال `api.js` الجديدة مباشرة.
 */

import { state, translations } from './state.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';

// --- Helper Functions ---
function updateVariantStockDisplay(card) {
    if (!card) return;
    try {
        const productId = card.querySelector('[data-product-id]').dataset.productId;
        const product = state.products.find(p => p.id === productId);
        const selectedColor = card.querySelector('.color-swatch.active')?.dataset.color;
        const selectedSize = card.querySelector('.gallery-size-selector').value;
        const stockSpan = card.querySelector('.selected-variant-stock');

        if (product && selectedColor && selectedSize && stockSpan) {
            const stock = product.colors[selectedColor]?.sizes[selectedSize]?.quantity ?? 0;
            stockSpan.textContent = stock;
        } else if (stockSpan) {
            stockSpan.textContent = 'N/A';
        }
    } catch (error) {
        console.error("Error updating variant stock display:", error);
        const stockSpan = card.querySelector('.selected-variant-stock');
        if (stockSpan) {
            stockSpan.textContent = 'Error';
        }
    }
}

async function handleUpdateCategory(button) {
    const originalName = button.dataset.originalName;
    const input = document.querySelector(`.category-name-input[data-original-name="${originalName}"]`);
    const newName = input.value.trim();

    if (!newName) {
        utils.showNotification("Category name cannot be empty.", "error");
        return;
    }
    if (newName.toLowerCase() === 'all') {
        utils.showNotification("Cannot rename a category to 'All'.", "error");
        return;
    }
    const isDuplicate = state.categories
        .filter(c => c.toLowerCase() !== originalName.toLowerCase())
        .some(c => c.toLowerCase() === newName.toLowerCase());

    if (isDuplicate) {
        utils.showNotification(translations[state.lang].categoryNameExists, "error");
        return;
    }

    utils.showLoader();
    try {
        // Update category in all products
        state.products.forEach(p => {
            if (p.category === originalName) {
                p.category = newName;
            }
        });
        // Update category in the state list
        const catIndex = state.categories.indexOf(originalName);
        if (catIndex > -1) {
            state.categories[catIndex] = newName;
        }

        await api.saveData(); // Save changes to Firestore
        ui.showCategoryModal();
        utils.showNotification(`Category "${originalName}" updated to "${newName}".`, 'success');
    } catch (error) {
        console.error("Error updating category:", error);
        utils.showNotification("Failed to update category.", "error");
    } finally {
        utils.hideLoader();
    }
}


// --- Shift Logic Functions ---
function calculateCurrentShift() {
    const lastShiftTime = state.lastShiftReportTime ? new Date(state.lastShiftReportTime) : new Date(0);

    const salesInShift = state.sales.filter(s => new Date(s.createdAt) > lastShiftTime);
    const expensesInShift = state.expenses.daily.filter(e => new Date(e.date) > lastShiftTime);

    let totalSales = 0, totalCashSales = 0, totalInstaPaySales = 0, totalVCashSales = 0, totalReturnsValue = 0;
    const returnsInShift = [];

    salesInShift.forEach(sale => {
        totalSales += sale.totalAmount;
        if (sale.paymentMethod === 'cash') totalCashSales += sale.totalAmount;
        if (sale.paymentMethod === 'instaPay') totalInstaPaySales += sale.totalAmount;
        if (sale.paymentMethod === 'vCash') totalVCashSales += sale.totalAmount;

        sale.items.forEach(item => {
            if (item.returnedQty > 0) {
                const itemSubtotal = item.unitPrice * item.returnedQty;
                const discountRatio = sale.subtotal > 0 ? sale.discountAmount / sale.subtotal : 0;
                const returnedValue = itemSubtotal - (itemSubtotal * discountRatio);
                totalReturnsValue += returnedValue;
                returnsInShift.push({
                    originalSaleId: sale.id,
                    returnedAt: sale.updatedAt || sale.createdAt,
                    cashier: sale.cashier,
                    returnValue: returnedValue,
                    productName: `${item.productName} (${item.color}/${item.size})`
                });
            }
        });
    });

    const totalDailyExpenses = expensesInShift.reduce((sum, e) => sum + e.amount, 0);
    const expectedInDrawer = totalCashSales - totalReturnsValue - totalDailyExpenses;

    return {
        isCurrent: true,
        id: `SHIFT-${new Date().toISOString()}`,
        startedAt: lastShiftTime.toISOString(),
        endedAt: null, endedBy: null, sales: salesInShift, returns: returnsInShift, expenses: expensesInShift,
        summary: { totalSales, totalCashSales, totalInstaPaySales, totalVCashSales, totalReturnsValue, totalDailyExpenses, expectedInDrawer },
        reconciliation: null,
    };
}

async function handleDailyExpenseSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('expense-amount-input').value);
    const notes = document.getElementById('expense-notes-input').value.trim();

    if (isNaN(amount) || amount <= 0) {
        utils.showNotification("Please enter a valid expense amount.", "error");
        return;
    }

    const expenseData = {
        id: utils.generateUUID(), amount, notes,
        date: new Date().toISOString(),
        cashier: state.currentUser.username
    };

    utils.showLoader();
    try {
        await api.saveDailyExpense(expenseData);
        // UI will update via onSnapshot listener
        ui.closeDailyExpenseModal();
        utils.showNotification("Daily expense added successfully.", "success");
    } finally {
        utils.hideLoader();
    }
}

async function handleEditExpenseSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('edit-expense-amount-input').value);
    const notes = document.getElementById('edit-expense-notes-input').value.trim();

    if (isNaN(amount) || amount <= 0) {
        utils.showNotification("Please enter a valid expense amount.", "error");
        return;
    }

    utils.showLoader();
    try {
        const result = await api.updateDailyExpense({ id: state.editingExpenseId, amount, notes });
        if (result.success) {
            ui.closeEditDailyExpenseModal();
            utils.showNotification("Expense updated successfully.", "success");
        } else {
            utils.showNotification(`Error: ${result.message}`, "error");
        }
    } finally {
        utils.hideLoader();
    }
}

async function handleDeleteExpense(expenseId) {
    if (confirm('Are you sure you want to delete this expense?')) {
        utils.showLoader();
        try {
            const result = await api.deleteDailyExpense(expenseId);
            if (result.success) {
                utils.showNotification("Expense deleted.", "success");
            } else {
                utils.showNotification(`Error: ${result.message}`, "error");
            }
        } finally {
            utils.hideLoader();
        }
    }
}

async function handleEndShift(reconciliationData) {
    const { actualAmount } = reconciliationData;
    const shiftData = state.currentShiftData;

    shiftData.endedAt = new Date().toISOString();
    shiftData.endedBy = state.currentUser.username;
    const difference = actualAmount - shiftData.summary.expectedInDrawer;

    shiftData.reconciliation = {
        actual: actualAmount,
        expected: shiftData.summary.expectedInDrawer,
        difference: difference,
        type: difference >= 0 ? 'surplus' : 'deficit'
    };

    utils.showLoader();
    try {
        if (difference < 0) {
            const deficitExpense = {
                id: utils.generateUUID(), amount: Math.abs(difference),
                notes: `Deficit from shift ${shiftData.id}`,
                date: shiftData.endedAt, cashier: shiftData.endedBy, isDeficit: true
            };
            await api.saveDailyExpense(deficitExpense);
        }
        await api.saveShift(shiftData);
        await api.exportShiftToPDF(shiftData);

        ui.closeReconciliationModal();
        ui.closeShiftCalculationModal();
        utils.showNotification(translations[state.lang].shiftEndedSuccess, 'success');

    } catch (error) {
        console.error("Failed to end shift:", error);
        utils.showNotification("Error ending shift. Please check logs.", "error");
    } finally {
        utils.hideLoader();
    }
}

async function handleReopenShift(shiftId) {
    if (!confirm(translations[state.lang].confirmReopenShift)) return;

    utils.showLoader();
    try {
        const shiftToReopenIndex = state.shifts.findIndex(s => s.id === shiftId);
        if (shiftToReopenIndex === -1) {
            utils.showNotification("Shift not found.", "error");
            return;
        }

        const deletedShifts = state.shifts.splice(shiftToReopenIndex);
        const deficitIdsToDelete = new Set(deletedShifts.flatMap(s => s.expenses).filter(e => e.isDeficit).map(e => e.id));

        if (deficitIdsToDelete.size > 0) {
            for (const id of deficitIdsToDelete) {
                await api.deleteDailyExpense(id);
            }
        }

        const newLastShiftTime = state.shifts.length > 0 ? state.shifts[state.shifts.length - 1].endedAt : null;
        state.lastShiftReportTime = newLastShiftTime;

        await api.saveData();
        utils.showNotification('Shift re-opened.', 'success');

    } catch (error) {
        console.error("Error reopening shift:", error);
        utils.showNotification("An error occurred while reopening the shift.", "error");
    } finally {
        utils.hideLoader();
    }
}

// --- CART & SALE LOGIC ---

export function createNewReceipt(doRender = true) {
    if (state.receipts.length >= 30) {
        utils.showNotification("Maximum of 30 receipts reached.", "info");
        return;
    }
    const newReceipt = {
        id: utils.generateUUID(), cart: [], seller: '', isFromBooking: false,
        originalDeposit: 0, depositPaymentMethod: '',
        customerName: '', customerPhone: '', customerAddress: '', customerCity: '',
    };
    state.receipts.push(newReceipt);
    state.activeReceiptId = newReceipt.id;
    api.cartSession.save();
    if (doRender) {
        ui.render();
    }
}

function switchReceipt(receiptId) {
    state.activeReceiptId = receiptId;
    ui.render();
}

function closeReceipt(receiptIdToClose) {
    if (state.receipts.length <= 1) return;
    const index = state.receipts.findIndex(r => r.id === receiptIdToClose);
    if (index > -1) {
        const receiptToClose = state.receipts[index];
        receiptToClose.cart.forEach(item => {
            const product = state.products.find(p => p.id === item.productId);
            if (product && product.colors[item.color] && product.colors[item.color].sizes[item.size]) {
                product.colors[item.color].sizes[item.size].quantity += item.quantity;
            }
        });

        state.receipts.splice(index, 1);
        if (state.activeReceiptId === receiptIdToClose) {
            state.activeReceiptId = state.receipts[0]?.id || null;
        }
        api.cartSession.save();
        ui.render();
    }
}

function handleBarcodeScan(barcode) {
    const cleanScannedBarcode = String(barcode).trim().toLowerCase();
    if (!cleanScannedBarcode) return;

    for (const product of state.products) {
        if (product.colors) {
            for (const [colorName, colorData] of Object.entries(product.colors)) {
                if (colorData.sizes) {
                    for (const [sizeName, sizeData] of Object.entries(colorData.sizes)) {
                        const cleanDbBarcode = String(sizeData.barcode || '').trim().toLowerCase();
                        if (cleanDbBarcode && cleanDbBarcode === cleanScannedBarcode) {
                            if (sizeData.quantity > 0) {
                                addToCartHandler({ productId: product.id, color: colorName, size: sizeName, quantity: 1 });
                                utils.showNotification(`Added: ${product.name} (${colorName}/${sizeName})`, 'success');
                            } else {
                                utils.showNotification(`'${product.name} (${colorName}/${sizeName})' is out of stock.`, 'error');
                            }
                            return;
                        }
                    }
                }
            }
        }
    }
    utils.showNotification("Barcode not found.", 'error');
}

function addToCartHandler(itemData, buttonElement = null) {
    if (state.currentPage === 'selling-page') {
        addToCart(itemData, state.activeReceiptId, buttonElement);
    } else {
        if (state.receipts.length === 1) {
            addToCart(itemData, state.receipts[0].id, buttonElement);
            utils.showNotification('Item added to the open receipt.', 'success');
        } else {
            ui.showReceiptSelectionModal(itemData);
        }
    }
}

function addToCart(itemData, receiptId, buttonElement = null) {
    const { productId, color, size, quantity } = itemData;
    const receipt = state.receipts.find(r => r.id === receiptId);
    if (!receipt) return;
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const activeReceiptContent = document.getElementById(`receipt-content-${receiptId}`);
    const selectedColor = color || activeReceiptContent?.querySelector('.sale-color')?.value;
    const selectedSize = size || activeReceiptContent?.querySelector('.sale-size')?.value;
    const qty = quantity || parseInt(activeReceiptContent?.querySelector('.sale-quantity')?.value, 10);
    const price = parseFloat(activeReceiptContent?.querySelector('.sale-price')?.value) || product.sellingPrice;

    if (!selectedColor || !selectedSize) {
        utils.showNotification("Please select a color and size.", "error");
        return;
    }
    const availableQty = product.colors[selectedColor]?.sizes[selectedSize]?.quantity || 0;
    if (qty > availableQty) {
        utils.showNotification(`Not enough stock for ${product.name} (${selectedColor}/${selectedSize}). Only ${availableQty} available.`, 'error');
        return;
    }
    if (availableQty <= state.lowStockThreshold) {
        utils.showNotification(`${translations[state.lang].lowStockWarning} ${product.name} (${selectedColor}/${selectedSize}). ${availableQty} ${translations[state.lang].itemsLeft}.`, 'info');
    }

    if (qty > 0) {
        const existingCartItemIndex = receipt.cart.findIndex(item => item.productId === productId && item.color === selectedColor && item.size === selectedSize);
        if (existingCartItemIndex > -1) {
            receipt.cart[existingCartItemIndex].quantity += qty;
        } else {
            receipt.cart.push({
                productId: product.id, productName: product.name, quantity: qty, price,
                color: selectedColor, size: selectedSize, purchasePrice: product.purchasePrice
            });
        }
        product.colors[selectedColor].sizes[selectedSize].quantity -= qty;
        api.cartSession.save();
        ui.render();
        if (buttonElement) {
            const originalText = buttonElement.textContent;
            buttonElement.classList.add('added');
            buttonElement.textContent = translations[state.lang].addedToCart;
            setTimeout(() => {
                buttonElement.classList.remove('added');
                buttonElement.textContent = originalText;
            }, 1500);
        }
    }
}

async function completeSale() {
    const activeReceipt = state.receipts.find(r => r.id === state.activeReceiptId);
    if (!activeReceipt || activeReceipt.cart.length === 0) {
        utils.showNotification("Cart is empty.", "info");
        return;
    };
    const container = document.getElementById(`receipt-content-${state.activeReceiptId}`);
    if (!container) return;

    if (!activeReceipt.seller) {
        utils.showNotification("Please select a cashier before completing the sale.", "error");
        return;
    }
    const isFreeDelivery = container.querySelector('#free-delivery-checkbox').checked;
    const deliveryCost = parseFloat(container.querySelector('.delivery-fee-input').value) || 0;

    if (isFreeDelivery && deliveryCost === 0) {
        ui.showFreeDeliveryCostModal();
        return;
    }

    utils.showLoader();
    try {
        const { customerPhone, customerName, customerAddress, customerCity } = activeReceipt;
        const deliveryFee = isFreeDelivery ? 0 : deliveryCost;
        const shippingCost = isFreeDelivery ? deliveryCost : 0;
        const subtotal = activeReceipt.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const discountPercent = parseFloat(container.querySelector('.discount-percentage').value) || 0;
        const discountAmount = parseFloat(container.querySelector('.discount-amount').value) || 0;
        let calculatedDiscount = 0;
        if (discountPercent > 0) calculatedDiscount = subtotal * (discountPercent / 100);
        else if (discountAmount > 0) calculatedDiscount = discountAmount;
        calculatedDiscount = Math.min(calculatedDiscount, subtotal);
        const totalAmountForRevenue = subtotal - calculatedDiscount;
        const totalForCustomer = totalAmountForRevenue + deliveryFee;
        const paidAmountInput = container.querySelector('.paid-amount');
        let paidAmountAtTransaction = (paidAmountInput.value.trim() === '')
            ? totalForCustomer - (activeReceipt.originalDeposit || 0)
            : parseFloat(paidAmountInput.value);

        if (isNaN(paidAmountAtTransaction) || paidAmountAtTransaction < 0) {
            utils.showNotification("Invalid paid amount.", "error");
            utils.hideLoader();
            return;
        }
        const paymentMethod = container.querySelector('.payment-method-btn.selected').dataset.method;

        const newSale = {
            id: utils.getDailyId('S', state.sales),
            cashier: activeReceipt.seller,
            createdAt: new Date().toISOString(),
            totalAmount: totalAmountForRevenue,
            paidAmount: paidAmountAtTransaction,
            depositPaidOnBooking: activeReceipt.originalDeposit || 0,
            profit: activeReceipt.cart.reduce((sum, item) => sum + (item.price - item.purchasePrice) * item.quantity, 0) - calculatedDiscount - shippingCost,
            subtotal, discountAmount: calculatedDiscount, paymentMethod,
            customerPhone, customerName, customerAddress, customerCity,
            isFreeDelivery, deliveryFee, shippingCost, returnDeliveryFee: 0,
            items: activeReceipt.cart.map(item => ({
                id: utils.generateUUID(), productId: item.productId, productName: item.productName,
                quantity: item.quantity, unitPrice: item.price, purchasePrice: item.purchasePrice,
                color: item.color, size: item.size, returnedQty: 0
            }))
        };
        state.sales.unshift(newSale);
        updateCustomerData(customerPhone, customerName, customerAddress, customerCity, newSale.items);
        utils.showNotification(`Sale #${newSale.id} completed!`, 'success');
        const receiptIdToClose = state.activeReceiptId;
        const index = state.receipts.findIndex(r => r.id === receiptIdToClose);
        state.receipts.splice(index, 1);
        if (state.receipts.length === 0) {
            state.activeReceiptId = null;
            createNewReceipt();
        } else {
            state.activeReceiptId = state.receipts[Math.max(0, index - 1)]?.id || state.receipts[0]?.id;
            ui.render();
        }
        api.cartSession.save();
        await api.saveData();
        await api.printReceipt(newSale.id);
    } catch (error) {
        console.error("Error completing sale:", error);
        utils.showNotification("An error occurred while completing the sale.", "error");
    } finally {
        utils.hideLoader();
    }
}

function updateCustomerData(phone, name, address, city, items) {
    if (!phone || !name) return;

    let customer = state.customers.find(c => c.phone === phone);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    if (customer) {
        customer.name = name;
        customer.address = address;
        customer.city = city;
        customer.totalItemsBought += totalItems;
        customer.lastPaymentDate = new Date().toISOString();
    } else {
        customer = {
            id: utils.generateUUID(), name, phone, address, city,
            totalItemsBought: totalItems, lastPaymentDate: new Date().toISOString()
        };
        state.customers.push(customer);
    }
}

async function handleProductFormSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('product-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const action = submitBtn.dataset.action;

    const productCodeInput = document.getElementById('product-code');
    const productCode = productCodeInput.value.trim();
    if (productCode) {
        const isDuplicate = state.products.some(
            p => p.code && p.code.toLowerCase() === productCode.toLowerCase() && p.id !== state.editingProductId
        );
        if (isDuplicate) {
            utils.showNotification(`Product code "${productCode}" already exists. Please use a unique code.`, 'error');
            productCodeInput.focus();
            productCodeInput.classList.add('border-2', 'border-red-500');
            return;
        }
    }
    productCodeInput.classList.remove('border-2', 'border-red-500');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    utils.showLoader();

    if (action === 'addToInvoice') {
        await handleAddNewProductToInvoice();
    } else {
        await processAndSaveProduct();
    }

    document.getElementById('product-modal').style.zIndex = '50';
}

async function processAndSaveProduct() {
    const existingProduct = state.editingProductId ? state.products.find(p => p.id === state.editingProductId) : null;
    const formColorEntries = document.querySelectorAll('#color-container .color-entry');
    const stockChanges = { increases: [], decreases: [] };
    let totalInitialStock = 0;

    for (const colorEntry of formColorEntries) {
        const colorName = colorEntry.querySelector('.color-name-input').value.trim();
        if (!colorName) continue;

        const sizeEntries = colorEntry.querySelectorAll('.size-entry');
        for (const sizeEntry of sizeEntries) {
            const size = sizeEntry.querySelector('.size-name-input').value.trim().toUpperCase();
            const newQuantity = parseInt(sizeEntry.querySelector('.size-quantity-input').value, 10);
            if (!size || isNaN(newQuantity)) continue;

            if (existingProduct) {
                const oldQuantity = existingProduct.colors?.[colorName]?.sizes?.[size]?.quantity || 0;
                const quantityChange = newQuantity - oldQuantity;
                if (quantityChange > 0) {
                    stockChanges.increases.push({
                        productId: existingProduct.id,
                        productName: existingProduct.name,
                        color: colorName,
                        size: size,
                        quantity: quantityChange,
                        purchasePrice: parseFloat(document.getElementById('purchase-price').value) || 0
                    });
                } else if (quantityChange < 0) {
                    stockChanges.decreases.push({
                        productId: existingProduct.id,
                        productName: existingProduct.name,
                        color: colorName,
                        size: size,
                        oldQuantity: oldQuantity,
                        newQuantity: newQuantity,
                        purchasePrice: existingProduct.purchasePrice,
                        stockHistory: existingProduct.colors[colorName].sizes[size].stockHistory || []
                    });
                }
            } else {
                if (newQuantity > 0) {
                    totalInitialStock += newQuantity;
                }
            }
        }
    }

    if (existingProduct) {
        if (stockChanges.decreases.length > 0) {
            state.stockAdjustmentData = stockChanges.decreases[0];
            ui.showStockReductionOptionsModal();
            utils.hideLoader();
            return;
        }
        if (stockChanges.increases.length > 0) {
            state.stockAdjustmentData = { increases: stockChanges.increases };
            ui.showSelectSupplierModal();
            utils.hideLoader();
            return;
        }
    } else {
        if (totalInitialStock > 0) {
            state.stockAdjustmentData = { isNewProduct: true };
            ui.showSelectSupplierModal();
            utils.hideLoader();
            return;
        }
    }

    await finalizeProductSave();
}


async function finalizeProductSave(shipmentData = null, doSave = true) {
    const isForInvoice = state.productModalSource === 'invoice';
    try {
        const mainBarcode = document.getElementById('main-barcode').value.trim();
        const existingImages = Array.from(document.querySelectorAll('#image-previews-container img:not(.new-preview)')).map(img => img.src);
        const newImageFiles = document.getElementById('product-images').files;

        const newImagePromises = Array.from(newImageFiles).map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        const newImages = await Promise.all(newImagePromises);
        const allImages = [...existingImages, ...newImages];

        const newCategory = document.getElementById('product-category').value.trim();
        if (newCategory && !state.categories.includes(newCategory)) {
            state.categories.push(newCategory);
            state.categories.sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
        }

        const purchasePrice = parseFloat(document.getElementById('purchase-price').value);
        const productData = {
            name: document.getElementById('product-name').value,
            category: newCategory,
            code: document.getElementById('product-code').value.trim(),
            mainBarcode: mainBarcode,
            purchasePrice: purchasePrice,
            sellingPrice: parseFloat(document.getElementById('selling-price').value),
            images: allImages,
            colors: {}
        };

        const existingProduct = state.editingProductId ? state.products.find(p => p.id === state.editingProductId) : null;

        document.querySelectorAll('#color-container .color-entry').forEach((colorEntry, colorIndex) => {
            const colorName = colorEntry.querySelector('.color-name-input').value.trim();
            if (colorName) {
                const colorData = { sizes: {} };
                const colorCode = String(colorIndex + 1).padStart(2, '0');

                colorEntry.querySelectorAll('.size-entry').forEach(sizeEntry => {
                    const size = sizeEntry.querySelector('.size-name-input').value.trim().toUpperCase();
                    const newQuantity = isForInvoice ? 0 : parseInt(sizeEntry.querySelector('.size-quantity-input').value, 10);
                    if (size && !isNaN(newQuantity)) {
                        const generatedBarcode = `${mainBarcode}${colorCode}${size}`;
                        const existingSizeData = existingProduct?.colors?.[colorName]?.sizes?.[size];
                        let stockHistory = existingSizeData?.stockHistory || [];

                        colorData.sizes[size] = {
                            quantity: newQuantity,
                            barcode: generatedBarcode,
                            stockHistory: stockHistory
                        };
                    }
                });
                productData.colors[colorName] = colorData;
            }
        });

        let savedProduct;
        if (state.editingProductId) {
            const index = state.products.findIndex(p => p.id === state.editingProductId);
            state.products[index] = { ...state.products[index], ...productData, updatedAt: new Date().toISOString() };
            savedProduct = state.products[index];
        } else {
            productData.id = utils.generateUUID();
            productData.createdAt = new Date().toISOString();
            state.products.unshift(productData);
            savedProduct = productData;
        }

        if (shipmentData) {
            const productInState = state.products.find(p => p.id === savedProduct.id);
            shipmentData.items.forEach(item => {
                if (productInState && productInState.colors[item.color] && productInState.colors[item.color].sizes[item.size]) {
                    const sizeData = productInState.colors[item.color].sizes[item.size];
                    if (!sizeData.stockHistory) {
                        sizeData.stockHistory = [];
                    }
                    sizeData.stockHistory.push({
                        date: shipmentData.date,
                        quantity: item.quantity,
                        purchasePrice: item.purchasePrice
                    });
                }
            });
        }

        if (doSave) {
            if (!state.editingProductId) {
                state.newProductFormData = null;
            }
            await api.saveData();
            ui.closeProductModal();
            ui.render();
            utils.showNotification(`Product "${productData.name}" saved successfully!`, 'success');
        }
        return savedProduct;

    } catch (error) {
        console.error("Error processing product data:", error);
        utils.showNotification("Error saving product.", "error");
        return null;
    } finally {
        const form = document.getElementById('product-form');
        if (form) {
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = translations[state.lang].btnSave;
        }
        if (doSave) {
            utils.hideLoader();
        }
    }
}


function handleSaleColorChange(container) {
    if (!container) return;

    const productId = container.querySelector('.product-selection').value;
    const color = container.querySelector('.sale-color').value;
    const sizeSelect = container.querySelector('.sale-size');
    const product = state.products.find(p => p.id === productId);

    if (product && product.colors[color]) {
        sizeSelect.innerHTML = Object.entries(product.colors[color].sizes || {})
            .filter(([_, sizeData]) => sizeData.quantity > 0)
            .map(([size, sizeData]) => `<option value="${size}">${size} (Stock: ${sizeData.quantity})</option>`)
            .join('');
        sizeSelect.disabled = sizeSelect.options.length === 0;
    } else {
        sizeSelect.innerHTML = '';
        sizeSelect.disabled = true;
    }
}

function handleProductSelectionChange(productId, container) {
    if (!container) return;

    const productDetailsDiv = container.querySelector('.product-details-for-sale');
    const colorSelect = container.querySelector('.sale-color');

    if (productId) {
        const product = state.products.find(p => p.id === productId);
        if (container.querySelector('.sale-price')) {
            container.querySelector('.sale-price').value = product.sellingPrice;
        }

        const availableColors = Object.entries(product.colors || {})
            .filter(([_, colorData]) => {
                return Object.values(colorData.sizes || {}).some(size => size.quantity > 0);
            }).map(([colorName, _]) => colorName);


        colorSelect.innerHTML = availableColors
            .map(color => `<option value="${color}">${color}</option>`)
            .join('');

        if (availableColors.length > 0) {
            handleSaleColorChange(container);
            productDetailsDiv.classList.remove('hidden');
        } else {
            productDetailsDiv.classList.add('hidden');
        }

    } else {
        productDetailsDiv.classList.add('hidden');
    }
}

function toggleSelectAllSales(isChecked) {
    const saleCheckboxes = document.querySelectorAll('#sales-history-list .sale-checkbox');
    saleCheckboxes.forEach(cb => {
        cb.checked = isChecked;
        handleSaleCheckboxChange(cb.dataset.saleId, isChecked);
    });
}

function handleSaleCheckboxChange(saleId, isChecked) {
    if (isChecked) state.selectedSales.add(saleId);
    else state.selectedSales.delete(saleId);
    document.getElementById('delete-selected-btn').classList.toggle('hidden', state.selectedSales.size === 0);
    const allCheckboxes = document.querySelectorAll('#sales-history-list .sale-checkbox');
    document.getElementById('select-all-checkbox').checked = allCheckboxes.length > 0 && state.selectedSales.size === allCheckboxes.length;
}

async function deleteSelectedSales() {
    if (state.selectedSales.size === 0) return;
    if (confirm(`Are you sure you want to delete ${state.selectedSales.size} receipts? This will restore product stock.`)) {
        utils.showLoader();
        try {
            state.selectedSales.forEach(saleId => {
                const saleToDelete = state.sales.find(s => s.id === saleId);
                if (saleToDelete) {
                    let netItemsSold = 0;
                    (saleToDelete.items || []).forEach(item => {
                        const effectiveQty = item.quantity - (item.returnedQty || 0);
                        netItemsSold += effectiveQty;
                        if (effectiveQty > 0) {
                            const product = state.products.find(p => p.id === item.productId);
                            if (product && product.colors[item.color] && product.colors[item.color].sizes[item.size]) {
                                product.colors[item.color].sizes[item.size].quantity += effectiveQty;
                            }
                        }
                    });

                    if (saleToDelete.customerPhone && netItemsSold > 0) {
                        const customer = state.customers.find(c => c.phone === saleToDelete.customerPhone);
                        if (customer) {
                            customer.totalItemsBought = Math.max(0, customer.totalItemsBought - netItemsSold);
                        }
                    }
                }
            });

            state.sales = state.sales.filter(s => !state.selectedSales.has(s.id));
            const numDeleted = state.selectedSales.size;
            state.selectedSales.clear();
            await api.saveData();
            ui.render();
            utils.showNotification(`${numDeleted} sale(s) deleted and stock/customer data restored.`, 'success');
        } finally {
            utils.hideLoader();
        }
    }
}

function updateCustomerOnReturn(phone, returnedQuantity) {
    if (!phone || !returnedQuantity) return;
    const customer = state.customers.find(c => c.phone === phone);
    if (customer) {
        customer.totalItemsBought = Math.max(0, customer.totalItemsBought - returnedQuantity);
    }
}

async function processNormalReturn() {
    utils.showLoader();
    try {
        const sale = state.sales.find(s => s.id === state.returningSaleId);
        if (!sale) return;

        let itemsReturnedCount = 0;
        let totalReturnedQty = 0;
        const returnDeliveryFee = parseFloat(document.getElementById('return-delivery-fee-input').value) || 0;

        document.querySelectorAll('.return-quantity-input').forEach(input => {
            const returnQuantity = parseInt(input.value);
            if (returnQuantity > 0) {
                itemsReturnedCount++;
                totalReturnedQty += returnQuantity;
                const { itemId, productId, color, size } = input.dataset;
                const saleItem = sale.items.find(i => i.id === itemId);
                const product = state.products.find(p => p.id === productId);

                saleItem.returnedQty = (saleItem.returnedQty || 0) + returnQuantity;

                const itemSubtotal = saleItem.unitPrice * returnQuantity;
                const discountRatio = sale.subtotal > 0 ? sale.discountAmount / sale.subtotal : 0;
                const returnedValue = itemSubtotal - (itemSubtotal * discountRatio);
                const returnedProfit = (saleItem.unitPrice - saleItem.purchasePrice) * returnQuantity - (itemSubtotal * discountRatio);

                sale.totalAmount -= returnedValue;
                sale.profit -= returnedProfit;

                if (product && product.colors[color] && product.colors[color].sizes[size]) {
                    product.colors[color].sizes[size].quantity += returnQuantity;
                }
            }
        });

        if (itemsReturnedCount > 0 || returnDeliveryFee > 0) {
            sale.returnDeliveryFee = (sale.returnDeliveryFee || 0) + returnDeliveryFee;
            sale.profit -= returnDeliveryFee; // The business bears the shipping cost for returns
            if (sale.customerPhone) {
                updateCustomerOnReturn(sale.customerPhone, totalReturnedQty);
            }
            await api.saveData();
            utils.showNotification(translations[state.lang].btnReturned || "Return processed successfully. Stock updated.", 'success');
        }
    } finally {
        ui.closeReturnModal();
        ui.render();
        utils.hideLoader();
    }
}

function handleNormalReturnOption() {
    ui.closeReturnTypeModal();
    processNormalReturn();
}

function handleDefectiveReturnOption() {
    ui.closeReturnTypeModal();
    const itemsToProcess = [];
    document.querySelectorAll('.return-quantity-input').forEach(input => {
        const quantity = parseInt(input.value, 10);
        if (quantity > 0) {
            const saleItem = state.sales.find(s => s.id === state.returningSaleId).items.find(i => i.id === input.dataset.itemId);
            itemsToProcess.push({
                ...input.dataset,
                quantity,
                productName: saleItem.productName
            });
        }
    });

    if (itemsToProcess.length > 0) {
        state.returnActionData = {
            type: 'defective',
            itemsToProcess,
            returnDeliveryFee: parseFloat(document.getElementById('return-delivery-fee-input').value) || 0
        };
        ui.showDefectiveItemModal();
    } else {
        utils.showNotification("No items selected for return.", "info");
        ui.closeReturnModal();
    }
}


async function saveReceiptAsBooking(receiptId, deposit) {
    utils.showLoader();
    try {
        const receipt = state.receipts.find(r => r.id === receiptId);
        if (!receipt || receipt.cart.length === 0) {
            utils.showNotification("Cart is empty.", "info");
            return;
        }

        const container = document.getElementById(`receipt-content-${receiptId}`);
        const customerPhone = container.querySelector('.customer-phone-input').value.trim();
        const customerName = container.querySelector('.customer-name-input').value.trim();
        const customerAddress = container.querySelector('.customer-address-input').value.trim();
        const customerCity = container.querySelector('.customer-city-input').value.trim();
        const isFreeDelivery = container.querySelector('#free-delivery-checkbox').checked;
        const depositPaymentMethod = container.querySelector('.payment-method-btn.selected')?.dataset.method || 'cash';


        if (!customerName || !customerPhone) {
            utils.showNotification("Customer name and phone are required for bookings.", "error");
            return;
        }

        const newBooking = {
            id: utils.getDailyId('B', state.bookings),
            cart: JSON.parse(JSON.stringify(receipt.cart)),
            customerName,
            customerPhone,
            customerAddress,
            customerCity,
            deposit: deposit,
            depositPaymentMethod: depositPaymentMethod,
            seller: receipt.seller,
            isCompleted: false,
            isFreeDelivery: isFreeDelivery,
            createdAt: new Date().toISOString()
        };

        state.bookings.push(newBooking);

        const index = state.receipts.findIndex(r => r.id === receiptId);
        if (index > -1) {
            state.receipts.splice(index, 1);
            if (state.activeReceiptId === receiptId) {
                if (state.receipts.length === 0) createNewReceipt(false);
                state.activeReceiptId = state.receipts[0]?.id || null;
            }
        }

        await api.saveData();
        api.cartSession.save();
        ui.closeBookingConfirmationModal();
        ui.render();
        utils.showNotification(translations[state.lang].bookingSaved, 'success');
    } finally {
        utils.hideLoader();
    }
}

async function deleteBooking(bookingId, restoreStock = true, doSave = true) {
    utils.showLoader();
    try {
        const bookingIndex = state.bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            utils.showNotification("Booking not found.", "error");
            return;
        }

        const bookingToDelete = state.bookings[bookingIndex];

        if (restoreStock) {
            bookingToDelete.cart.forEach(item => {
                const product = state.products.find(p => p.id === item.productId);
                if (product && product.colors[item.color] && product.colors[item.color].sizes[item.size]) {
                    product.colors[item.color].sizes[item.size].quantity += item.quantity;
                }
            });
        }

        state.bookings.splice(bookingIndex, 1);
        if (doSave) {
            await api.saveData();
            ui.render();
            utils.showNotification("Booking deleted.", "success");
        }
    } finally {
        if (doSave) utils.hideLoader();
    }
}

async function handleEditBookingSubmit(e) {
    e.preventDefault();
    const booking = state.bookings.find(b => b.id === state.editingBookingId);
    if (!booking) return;

    booking.customerName = document.getElementById('edit-customer-name').value.trim();
    booking.customerPhone = document.getElementById('edit-customer-phone').value.trim();
    booking.customerAddress = document.getElementById('edit-customer-address').value.trim();
    booking.customerCity = document.getElementById('edit-customer-city').value.trim();
    booking.deposit = parseFloat(document.getElementById('edit-deposit').value) || 0;
    booking.depositPaymentMethod = document.getElementById('edit-deposit-payment-method').value;
    booking.isFreeDelivery = document.getElementById('edit-free-delivery').checked;

    await api.saveData();
    ui.closeEditBookingModal();
    ui.render();
    utils.showNotification("Booking updated successfully!", 'success');
}

async function completeSaleFromBooking(bookingId) {
    utils.showLoader();
    try {
        const booking = state.bookings.find(b => b.id === bookingId);
        if (!booking) return;

        createNewReceipt(false);
        const newReceipt = state.receipts.find(r => r.id === state.activeReceiptId);

        newReceipt.cart = JSON.parse(JSON.stringify(booking.cart));
        newReceipt.isFromBooking = true;
        newReceipt.originalDeposit = booking.deposit;
        newReceipt.depositPaymentMethod = booking.depositPaymentMethod;

        newReceipt.customerName = booking.customerName;
        newReceipt.customerPhone = booking.customerPhone;
        newReceipt.customerAddress = booking.customerAddress;
        newReceipt.customerCity = booking.customerCity;

        await deleteBooking(booking.id, false, false);

        state.currentPage = 'selling-page';
        await api.saveData();
        ui.render();

        utils.showNotification('Booking loaded to a new receipt for completion.', 'success');
    } finally {
        utils.hideLoader();
    }
}

async function handleAddCategory() {
    const input = document.getElementById('new-category-name');
    const newCategory = input.value.trim();
    if (newCategory && !state.categories.includes(newCategory)) {
        state.categories.push(newCategory);
        state.categories.sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
        await api.saveData();
        ui.showCategoryModal();
    }
    input.value = '';
}

async function handleDeleteCategory(categoryToDelete) {
    if (confirm(translations[state.lang].categoryDeleteConfirm)) {
        state.categories = state.categories.filter(c => c !== categoryToDelete);
        state.products.forEach(p => {
            if (p.category === categoryToDelete) {
                p.category = 'All';
            }
        });
        await api.saveData();
        ui.showCategoryModal();
    }
}

async function handleEmployeeFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('employee-name-input').value.trim();
    const id = document.getElementById('employee-id-input-modal').value.trim();
    const phone = document.getElementById('employee-phone-input').value.trim();

    if (!name || !id) {
        utils.showNotification("Employee name and ID are required.", 'error');
        return;
    }

    utils.showLoader();
    let result;
    if (state.editingEmployeeUsername) {
        result = await api.modifyEmployee({
            originalUsername: state.editingEmployeeUsername,
            newUsername: name,
            newEmployeeId: id,
            newPhone: phone
        });
    } else {
        result = await api.addEmployee({ username: name, employeeId: id, phone: phone });
    }

    if (result.success) {
        const data = await api.loadData();
        state.users = data.users;
        state.salaries = data.salaries;
        ui.closeEmployeeModal();
        ui.renderSalariesPage();
        utils.showNotification(`Employee ${state.editingEmployeeUsername ? 'updated' : 'added'} successfully.`, 'success');
    } else {
        utils.showNotification(`Error: ${result.message}`, 'error');
    }
    utils.hideLoader();
}

async function handleDeleteEmployee(username) {
    if (confirm(translations[state.lang].deleteEmployeeConfirm)) {
        utils.showLoader();
        const result = await api.deleteEmployee({ usernameToDelete: username });
        if (result.success) {
            const data = await api.loadData();
            state.users = data.users;
            state.salaries = data.salaries;
            ui.renderSalariesPage();
            utils.showNotification('Employee deleted successfully.', 'success');
        } else {
            utils.showNotification(`Error: ${result.message}`, 'error');
        }
        utils.hideLoader();
    }
}

async function handleCustomerFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('customer-name-input-modal').value.trim();
    const phone = document.getElementById('customer-phone-input-modal').value.trim();
    const address = document.getElementById('customer-address-input-modal').value.trim();
    const city = document.getElementById('customer-city-input-modal').value.trim();

    if (!name || !phone) {
        utils.showNotification("Customer name and phone are required.", "error");
        return;
    }

    let customer;
    if (state.editingCustomerId) {
        customer = state.customers.find(c => c.id === state.editingCustomerId);
        customer.name = name;
        customer.phone = phone;
        customer.address = address;
        customer.city = city;
    } else {
        customer = state.customers.find(c => c.phone === phone);
        if (customer) {
            utils.showNotification("A customer with this phone number already exists.", "error");
            return;
        }
        const newCustomer = {
            id: utils.generateUUID(), name, phone, address, city,
            totalItemsBought: 0, lastPaymentDate: null
        };
        state.customers.push(newCustomer);
    }

    await api.saveData();
    ui.closeCustomerModal();
    ui.renderCustomersPage();
    utils.showNotification(`Customer ${state.editingCustomerId ? 'updated' : 'added'} successfully.`, 'success');
}

async function handleDeleteCustomer(customerId) {
    if (confirm(translations[state.lang].deleteCustomerConfirm)) {
        state.customers = state.customers.filter(c => c.id !== customerId);
        await api.saveData();
        ui.renderCustomersPage();
        utils.showNotification("Customer deleted.", "success");
    }
}

async function handleEditCashierSubmit(e) {
    e.preventDefault();
    const newCashier = document.getElementById('edit-cashier-select').value;
    if (!state.editingSaleId || !newCashier) return;

    utils.showLoader();
    try {
        const result = await api.updateSaleCashier({
            saleId: state.editingSaleId,
            newCashier: newCashier
        });

        if (result.success) {
            const sale = state.sales.find(s => s.id === state.editingSaleId);
            if (sale) {
                sale.cashier = newCashier;
            }
            ui.closeEditCashierModal();
            ui.generateReport();
            utils.showNotification("Cashier updated successfully.", "success");
        } else {
            utils.showNotification(`Error: ${result.message || 'Could not update cashier.'}`, 'error');
        }
    } finally {
        utils.hideLoader();
    }
}

async function handleDefectiveFormSubmit(e) {
    e.preventDefault();
    const reason = document.getElementById('defective-reason-input').value.trim();
    const returnedToSupplier = document.getElementById('defective-returned-checkbox').checked;

    if (!reason) {
        utils.showNotification("Reason for defect is required.", "error");
        return;
    }

    utils.showLoader();
    try {
        if (state.returnActionData) { // From a return
            const { itemsToProcess, returnDeliveryFee } = state.returnActionData;
            const sale = state.sales.find(s => s.id === state.returningSaleId);

            let totalReturnedQty = 0;
            itemsToProcess.forEach(itemData => {
                const defect = {
                    id: utils.generateUUID(),
                    productId: itemData.productId,
                    productName: itemData.productName,
                    color: itemData.color,
                    size: itemData.size,
                    quantity: itemData.quantity,
                    purchasePrice: parseFloat(itemData.purchasePrice),
                    reason,
                    returnedToSupplier,
                    date: new Date().toISOString()
                };
                state.defects.unshift(defect);

                const saleItem = sale.items.find(i => i.id === itemData.itemId);
                saleItem.returnedQty = (saleItem.returnedQty || 0) + itemData.quantity;
                totalReturnedQty += itemData.quantity;

                const itemSubtotal = saleItem.unitPrice * itemData.quantity;
                const discountRatio = sale.subtotal > 0 ? sale.discountAmount / sale.subtotal : 0;
                const returnedValue = itemSubtotal - (itemSubtotal * discountRatio);
                const returnedProfit = (saleItem.unitPrice - saleItem.purchasePrice) * itemData.quantity - (itemSubtotal * discountRatio);

                sale.totalAmount -= returnedValue;
                sale.profit -= returnedProfit;
            });

            sale.returnDeliveryFee = (sale.returnDeliveryFee || 0) + returnDeliveryFee;
            sale.profit -= returnDeliveryFee;
            if (sale.customerPhone) {
                updateCustomerOnReturn(sale.customerPhone, totalReturnedQty);
            }

            await api.saveData();
            ui.closeDefectiveItemModal();
            ui.closeReturnModal();
            ui.render();
            utils.showNotification('Items marked as defective and sale updated!', 'success');

        } else if (state.stockAdjustmentData) { // From product edit
            const { productId, productName, color, size, oldQuantity, newQuantity, purchasePrice } = state.stockAdjustmentData;
            const reductionAmount = oldQuantity - newQuantity;
            const defectData = {
                id: utils.generateUUID(), productId, productName, color, size,
                quantity: reductionAmount, purchasePrice, reason, returnedToSupplier,
                date: new Date().toISOString()
            };
            state.defects.unshift(defectData);
            await finalizeProductSave();
            ui.closeDefectiveItemModal();
            utils.showNotification('Item marked as defective and product saved!', 'success');
        }
    } catch (error) {
        console.error("Error handling defective item:", error);
        utils.showNotification("An error occurred.", "error");
    } finally {
        utils.hideLoader();
    }
}


async function handleDeductCostOption() {
    const { stockHistory, oldQuantity, newQuantity, productId, color, size } = state.stockAdjustmentData;
    const reductionAmount = oldQuantity - newQuantity;

    const lastBatch = stockHistory.length > 0 ? [...stockHistory].sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;
    const lastBatchQuantity = lastBatch ? lastBatch.quantity : 0;

    let proceed = true;
    if (reductionAmount > lastBatchQuantity) {
        proceed = confirm(translations[state.lang].oldStockWarningMsg);
    }

    if (proceed) {
        utils.showLoader();
        const result = await api.reduceStockAndCost({
            productId: productId,
            color: color,
            size: size,
            reductionAmount: reductionAmount
        });

        if (result.success) {
            const updatedData = await api.loadData();
            state.products = updatedData.products;
            state.defects = updatedData.defects;
            await finalizeProductSave();
        } else {
            utils.showNotification(`Error reducing stock: ${result.message}`, 'error');
            utils.hideLoader();
        }
    }
    ui.closeStockReductionOptionsModal();
}

function handleMarkDefectiveOption() {
    ui.showDefectiveItemModal();
    ui.closeStockReductionOptionsModal();
}

function cancelStockAdjustmentFlow() {
    const stockModal = document.getElementById('stock-reduction-confirm-modal');
    if (stockModal) stockModal.classList.add('hidden');

    const productForm = document.getElementById('product-form');
    if (productForm) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = translations[state.lang].btnSave;
        }
    }
    state.stockAdjustmentData = null;
}

// --- NEW: Supplier Event Handlers ---

async function handleSupplierFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('supplier-name-input').value.trim();
    const phone = document.getElementById('supplier-phone-input').value.trim();

    if (!name) {
        utils.showNotification("Supplier name is required.", "error");
        return;
    }

    if (state.editingSupplierId) {
        const supplier = state.suppliers.find(s => s.id === state.editingSupplierId);
        supplier.name = name;
        supplier.phone = phone;
    } else {
        const newSupplier = {
            id: utils.generateUUID(),
            name,
            phone,
            payments: []
        };
        state.suppliers.push(newSupplier);
        state.activeSupplierId = newSupplier.id;
    }

    await api.saveData();
    ui.closeSupplierModal();
    ui.renderSuppliersPage();
    utils.showNotification(`Supplier ${state.editingSupplierId ? 'updated' : 'added'} successfully.`, 'success');
}

async function handleDeleteSupplier(supplierId) {
    if (confirm(translations[state.lang].confirmDeleteSupplier)) {
        // Find all shipments from this supplier to adjust stock
        const shipmentsToDelete = state.shipments.filter(s => s.supplierId === supplierId);
        for (const shipment of shipmentsToDelete) {
            for (const item of shipment.items) {
                const product = state.products.find(p => p.id === item.productId);
                if (product && product.colors?.[item.color]?.sizes?.[item.size]) {
                    product.colors[item.color].sizes[item.size].quantity = Math.max(0, product.colors[item.color].sizes[item.size].quantity - item.quantity);
                }
            }
        }

        // Filter out shipments and the supplier
        state.shipments = state.shipments.filter(s => s.supplierId !== supplierId);
        state.suppliers = state.suppliers.filter(s => s.id !== supplierId);

        if (state.activeSupplierId === supplierId) {
            state.activeSupplierId = state.suppliers.length > 0 ? state.suppliers[0].id : null;
        }
        await api.saveData();
        ui.renderSuppliersPage();
        utils.showNotification("Supplier and all related data deleted.", "success");
    }
}

async function handleSupplierPaymentSubmit(e) {
    e.preventDefault();
    const supplierId = e.target.dataset.id;
    const amount = parseFloat(document.getElementById('payment-amount-input').value);

    if (isNaN(amount) || amount <= 0) {
        utils.showNotification("Please enter a valid payment amount.", "error");
        return;
    }

    const supplier = state.suppliers.find(s => s.id === supplierId);
    if (supplier) {
        if (!supplier.payments) {
            supplier.payments = [];
        }
        supplier.payments.push({
            id: utils.generateUUID(),
            supplierId: supplierId,
            date: new Date().toISOString(),
            amount: amount
        });
        await api.saveData();
        ui.closeSupplierPaymentModal();
        ui.renderSuppliersPage();
        utils.showNotification("Payment recorded successfully.", "success");
    }
}


async function handleSelectSupplierSubmit(e) {
    e.preventDefault();
    const supplierId = document.getElementById('supplier-select-input').value;
    const shippingCost = parseFloat(document.getElementById('shipment-shipping-cost').value) || 0;

    if (!supplierId) {
        utils.showNotification("Please select a supplier.", "error");
        return;
    }

    utils.showLoader();
    try {
        let shipmentItems = [];
        let productForShipment;

        if (state.stockAdjustmentData?.isNewProduct) {
            productForShipment = await finalizeProductSave(null, false);
            if (!productForShipment) throw new Error("Product could not be created in memory.");

            Object.entries(productForShipment.colors).forEach(([color, colorData]) => {
                Object.entries(colorData.sizes).forEach(([size, sizeData]) => {
                    if (sizeData.quantity > 0) {
                        shipmentItems.push({
                            productId: productForShipment.id,
                            productName: productForShipment.name,
                            color,
                            size,
                            quantity: sizeData.quantity,
                            purchasePrice: productForShipment.purchasePrice
                        });
                    }
                });
            });

        } else {
            shipmentItems = state.stockAdjustmentData.increases;
            productForShipment = await finalizeProductSave(null, false);
        }

        if (shipmentItems.length > 0) {
            const newShipment = {
                id: utils.getDailyId('SH', state.shipments),
                supplierId: supplierId,
                date: new Date().toISOString(),
                items: shipmentItems,
                totalCost: shipmentItems.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0),
                shippingCost: shippingCost
            };
            state.shipments.unshift(newShipment);

            const productInState = state.products.find(p => p.id === productForShipment.id);
            newShipment.items.forEach(item => {
                const sizeData = productInState.colors[item.color].sizes[item.size];
                if (!sizeData.stockHistory) sizeData.stockHistory = [];
                sizeData.stockHistory.push({
                    date: newShipment.date,
                    quantity: item.quantity,
                    purchasePrice: item.purchasePrice
                });
            });
        }

        if (state.stockAdjustmentData?.isNewProduct) {
            state.newProductFormData = null;
        }

        await api.saveData();
        utils.showNotification(`Product "${productForShipment.name}" saved successfully!`, 'success');
        ui.closeSelectSupplierModal();
        ui.closeProductModal();
        ui.render();

    } catch (error) {
        console.error("Error creating/updating product with shipment:", error);
        utils.showNotification("Failed to save product with shipment.", "error");
    } finally {
        state.stockAdjustmentData = null;
        utils.hideLoader();
    }
}

async function handleEditShipmentSubmit(e) {
    e.preventDefault();
    const newDate = document.getElementById('edit-shipment-date-input').value;
    const newShippingCost = parseFloat(document.getElementById('edit-shipment-shipping-cost').value) || 0;

    if (!newDate || !state.editingShipmentDate) return;

    const oldDate = state.editingShipmentDate;
    const shipmentsOnOldDate = state.shipments.filter(shipment =>
        shipment.supplierId === state.activeSupplierId && shipment.date.startsWith(oldDate)
    );

    if (shipmentsOnOldDate.length > 0) {
        shipmentsOnOldDate.forEach((shipment, index) => {
            const timePart = shipment.date.includes('T') ? shipment.date.substring(10) : 'T12:00:00.000Z';
            shipment.date = `${newDate}${timePart}`;
            shipment.shippingCost = (index === 0) ? newShippingCost : 0;
        });
    }

    await api.saveData();
    document.getElementById('supplier-modal').classList.add('hidden');
    state.editingShipmentDate = null;
    ui.renderSuppliersPage();
    utils.showNotification("Invoice updated.", "success");
}


async function handleDeletePayment(paymentId) {
    if (confirm(translations[state.lang].confirmDeletePayment)) {
        const supplier = state.suppliers.find(s => s.id === state.activeSupplierId);
        if (supplier && supplier.payments) {
            supplier.payments = supplier.payments.filter(p => p.id !== paymentId);
            await api.saveData();
            ui.renderSuppliersPage();
            utils.showNotification("Payment deleted.", "success");
        }
    }
}

async function handleEditPaymentSubmit(e) {
    e.preventDefault();
    const paymentId = state.editingPaymentId;
    const newAmount = parseFloat(document.getElementById('edit-payment-amount-input').value);
    const newDate = document.getElementById('edit-payment-date-input').value;

    if (!paymentId || isNaN(newAmount) || newAmount <= 0 || !newDate) {
        utils.showNotification("Invalid data. Please check amount and date.", "error");
        return;
    }

    const supplier = state.suppliers.find(s => s.payments?.some(p => p.id === paymentId));
    if (supplier) {
        const payment = supplier.payments.find(p => p.id === paymentId);
        payment.amount = newAmount;
        const timePart = payment.date.includes('T') ? payment.date.substring(10) : 'T12:00:00.000Z';
        payment.date = `${newDate}${timePart}`;

        await api.saveData();
        document.getElementById('supplier-modal').classList.add('hidden');
        state.editingPaymentId = null;
        ui.renderSuppliersPage();
        utils.showNotification("Payment updated.", "success");
    }
}

async function handleUndoDefect(defectId) {
    if (!confirm(translations[state.lang].confirmUndoDefect)) {
        return;
    }

    utils.showLoader();
    try {
        const defectIndex = state.defects.findIndex(d => d.id === defectId);
        if (defectIndex === -1) {
            utils.showNotification("Defect entry not found.", "error");
            return;
        }

        const defect = state.defects[defectIndex];

        const product = state.products.find(p => p.id === defect.productId);
        if (product && product.colors?.[defect.color]?.sizes?.[defect.size]) {
            product.colors[defect.color].sizes[defect.size].quantity += defect.quantity;
        } else {
            console.warn(`Product variant for defect ${defect.id} not found. Stock not restored.`);
            utils.showNotification(`Could not find the product variant to restore stock.`, 'error');
        }

        state.defects.splice(defectIndex, 1);

        await api.saveData();
        ui.render();
        utils.showNotification("Defect undone and stock restored.", "success");

    } catch (error) {
        console.error("Error undoing defect:", error);
        utils.showNotification("An error occurred.", "error");
    } finally {
        utils.hideLoader();
    }
}

async function handleAddDefectiveSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const supplierId = form.querySelector('#defective-supplier-id').value;
    const productId = form.querySelector('#defective-product-select').value;
    const color = form.querySelector('#defective-color-select').value;
    const size = form.querySelector('#defective-size-select').value;
    const quantity = parseInt(form.querySelector('#defective-quantity-input').value, 10);
    const reason = form.querySelector('#defective-reason-input').value.trim();
    const shipmentDate = form.querySelector('#defective-shipment-select').value;

    if (!supplierId || !productId || !color || !size || !quantity || !reason || !shipmentDate) {
        utils.showNotification("Please fill all fields, including the invoice date.", "error");
        return;
    }

    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const variant = product.colors?.[color]?.sizes?.[size];
    if (!variant) {
        utils.showNotification("Selected product variant not found.", "error");
        return;
    }
    if (quantity > variant.quantity) {
        utils.showNotification(`Cannot mark ${quantity} as defective. Only ${variant.quantity} in stock.`, "error");
        return;
    }

    const shipmentsOnDate = state.shipments.filter(s => s.supplierId === supplierId && s.date.startsWith(shipmentDate));
    const invoiceQuantity = shipmentsOnDate
        .flatMap(s => s.items)
        .filter(item => item.productId === productId && item.color === color && item.size === size)
        .reduce((sum, item) => sum + item.quantity, 0);

    const alreadyDefectiveQty = state.defects
        .filter(d => d.shipmentDate === shipmentDate && d.productId === productId && d.color === color && d.size === size)
        .reduce((sum, d) => sum + d.quantity, 0);

    const maxAllowed = invoiceQuantity - alreadyDefectiveQty;

    if (quantity > maxAllowed) {
        utils.showNotification(`Cannot mark ${quantity} as defective for this invoice. Only ${maxAllowed} more can be marked as defective.`, "error");
        return;
    }


    utils.showLoader();
    try {
        const defectData = {
            id: utils.generateUUID(),
            supplierId,
            productId,
            productName: product.name,
            color,
            size,
            quantity,
            purchasePrice: product.purchasePrice,
            reason,
            date: new Date().toISOString(),
            returnedQty: 0,
            shipmentDate: shipmentDate
        };

        const result = await api.addDefectiveItem(defectData);
        if (result.success) {
            const data = await api.loadData();
            state.products = data.products;
            state.defects = data.defects;
            ui.closeAddDefectiveModal();
            ui.renderSuppliersPage();
            utils.showNotification("Defective item added and stock updated.", "success");
        } else {
            utils.showNotification(`Error: ${result.error}`, "error");
        }
    } finally {
        utils.hideLoader();
    }
}

async function handleReturnDefectsSubmit(e) {
    e.preventDefault();
    const returns = [];
    document.querySelectorAll('.return-defect-qty-input').forEach(input => {
        const quantity = parseInt(input.value, 10);
        if (quantity > 0) {
            returns.push({
                defectId: input.dataset.defectId,
                quantity: quantity
            });
        }
    });

    if (returns.length === 0) {
        utils.showNotification("No items selected to return.", "info");
        return;
    }

    if (!confirm(translations[state.lang].confirmReturnDefects)) {
        return;
    }

    utils.showLoader();
    try {
        const result = await api.returnDefectsToSupplier({
            supplierId: state.activeSupplierId,
            returns: returns
        });

        if (result.success) {
            const data = await api.loadData();
            state.defects = data.defects;
            state.suppliers = data.suppliers;
            ui.closeReturnDefectsModal();
            ui.renderSuppliersPage();
            utils.showNotification("Defects returned and supplier balance updated.", "success");
        } else {
            utils.showNotification(`Error: ${result.message}`, "error");
        }
    } finally {
        utils.hideLoader();
    }
}

async function handleEditShipmentItemSubmit(e) {
    e.preventDefault();
    const { shipmentId, itemIndex } = state.editingShipmentInfo;
    const newQuantity = parseInt(document.getElementById('edit-item-quantity-input').value, 10);

    if (isNaN(newQuantity) || newQuantity < 1) {
        utils.showNotification("Please enter a valid quantity.", "error");
        return;
    }

    utils.showLoader();
    try {
        const result = await api.updateShipmentItem({ shipmentId, itemIndex, newQuantity });
        if (result.success) {
            const data = await api.loadData();
            state.products = data.products;
            state.shipments = data.shipments;
            ui.closeEditShipmentItemModal();
            ui.renderSuppliersPage();
            utils.showNotification("Item quantity updated.", "success");
        } else {
            utils.showNotification(`Error: ${result.message}`, 'error');
        }
    } finally {
        utils.hideLoader();
    }
}

async function handleDeleteShipmentItem(shipmentId, itemIndex) {
    if (confirm(translations[state.lang].confirmDeleteItem)) {
        utils.showLoader();
        try {
            const result = await api.deleteShipmentItem({ shipmentId, itemIndex });
            if (result.success) {
                const data = await api.loadData();
                state.products = data.products;
                state.shipments = data.shipments;
                ui.renderSuppliersPage();
                utils.showNotification("Item deleted from invoice.", "success");
            } else {
                utils.showNotification(`Error: ${result.message}`, 'error');
            }
        } finally {
            utils.hideLoader();
        }
    }
}

async function handleSplitInvoice(shipmentId) {
    const container = document.querySelector(`.daily-invoice-group[data-shipment-id="${shipmentId}"]`);
    const checkedItems = container.querySelectorAll('.shipment-item-checkbox:checked');
    const itemIndices = Array.from(checkedItems).map(cb => parseInt(cb.dataset.itemIndex, 10));

    if (itemIndices.length === 0) {
        utils.showNotification(translations[state.lang].selectItemsToSplit, "info");
        return;
    }

    if (itemIndices.length === container.querySelectorAll('.shipment-item-checkbox').length) {
        utils.showNotification("Cannot move all items to a new invoice.", "info");
        return;
    }

    if (confirm(translations[state.lang].confirmSplitInvoice)) {
        utils.showLoader();
        try {
            const result = await api.splitShipment({ sourceShipmentId: shipmentId, itemIndices });
            if (result.success) {
                const data = await api.loadData();
                state.shipments = data.shipments;
                ui.renderSuppliersPage();
                utils.showNotification("Invoice split successfully.", "success");
            } else {
                utils.showNotification(`Error: ${result.message}`, 'error');
            }
        } finally {
            utils.hideLoader();
        }
    }
}

async function handleMergeSelectedShipments(supplierId, date) {
    const container = document.querySelector(`.daily-invoices-container[data-date="${date}"]`);
    if (!container) return;

    const checkedInvoices = container.querySelectorAll('.daily-shipment-checkbox:checked');
    const shipmentIds = Array.from(checkedInvoices).map(cb => cb.dataset.shipmentId);

    if (shipmentIds.length < 2) {
        utils.showNotification(translations[state.lang].selectInvoicesToMerge, "info");
        return;
    }

    if (confirm(translations[state.lang].confirmMergeInvoices)) {
        utils.showLoader();
        try {
            const result = await api.mergeSelectedShipments({ supplierId, shipmentIds });
            if (result.success) {
                const data = await api.loadData();
                state.shipments = data.shipments;
                ui.renderSuppliersPage();
                utils.showNotification("Invoices merged successfully.", "success");
            } else {
                utils.showNotification(`Error: ${result.message}`, 'error');
            }
        } finally {
            utils.hideLoader();
        }
    }
}

async function handleDeleteSelectedShipments(date) {
    const container = document.querySelector(`.daily-invoices-container[data-date="${date}"]`);
    if (!container) return;

    const checkedInvoices = container.querySelectorAll('.daily-shipment-checkbox:checked');
    const shipmentIdsToDelete = Array.from(checkedInvoices).map(cb => cb.dataset.shipmentId);

    if (shipmentIdsToDelete.length === 0) {
        utils.showNotification("Please select at least one invoice to delete.", "info");
        return;
    }

    if (!confirm(`Are you sure you want to delete ${shipmentIdsToDelete.length} selected invoice(s) for ${date}? This will restore stock and remove related defects.`)) {
        return;
    }

    utils.showLoader();
    try {
        const result = await api.deleteSelectedShipments({ shipmentIds: shipmentIdsToDelete });

        if (result.success) {
            if (result.deletedData && result.deletedData.shipments) {
                utils.showNotification('Invoices deleted successfully.', 'success');
            } else {
                ui.render();
                utils.showNotification('Invoices deleted.', 'success');
            }
        } else {
            utils.showNotification(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error("Error deleting shipments:", error);
        utils.showNotification("An error occurred during deletion.", "error");
    } finally {
        utils.hideLoader();
    }
}


async function handleSaveInvoice() {
    const { supplierId, date, shippingCost, items } = state.newInvoiceBuilder;

    if (!date) {
        utils.showNotification("Please select an invoice date.", "error");
        return;
    }
    if (items.length === 0) {
        utils.showNotification("Please add at least one item to the invoice.", "error");
        return;
    }

    utils.showLoader();
    try {
        const result = await api.saveNewInvoice({ supplierId, date, shippingCost, items });

        if (result.success) {
            const data = await api.loadData();
            state.products = data.products || [];
            state.shipments = data.shipments || [];

            ui.closeInvoiceBuilderModal();
            ui.renderSuppliersPage();
            utils.showNotification("Invoice saved successfully and stock updated.", "success");
        } else {
            utils.showNotification(`Error: ${result.message}`, "error");
        }

    } catch (error) {
        console.error("Error saving invoice:", error);
        utils.showNotification("An error occurred while saving the invoice.", "error");
    } finally {
        utils.hideLoader();
    }
}

async function handleAddNewProductToInvoice() {
    const newProduct = await finalizeProductSave(null, false);
    if (!newProduct) {
        utils.showNotification("Failed to create product in memory.", "error");
        utils.hideLoader();
        return;
    }

    const quantities = {};
    let totalCost = 0;
    let totalQty = 0;
    const form = document.getElementById('product-form');

    form.querySelectorAll('.color-entry').forEach(colorEntry => {
        const colorName = colorEntry.querySelector('.color-name-input').value.trim();
        if (colorName) {
            colorEntry.querySelectorAll('.size-entry').forEach(sizeEntry => {
                const size = sizeEntry.querySelector('.size-name-input').value.trim().toUpperCase();
                const qty = parseInt(sizeEntry.querySelector('.size-quantity-input').value, 10) || 0;
                if (size && qty > 0) {
                    if (!quantities[colorName]) {
                        quantities[colorName] = {};
                    }
                    quantities[colorName][size] = qty;
                    totalCost += qty * newProduct.purchasePrice;
                    totalQty += qty;
                }
            });
        }
    });

    if (totalQty > 0) {
        state.newInvoiceBuilder.items.push({
            productId: newProduct.id,
            quantities,
            totalCost,
            isNew: true,
            productData: newProduct
        });
    }

    ui.closeProductModal();
    ui.renderInvoiceBuilder();
    utils.showNotification(`Product "${newProduct.name}" added to invoice.`, 'success');
    utils.hideLoader();
}


// --- Main Event Listener Setup ---
export function setupEventListeners() {
    document.addEventListener('submit', async (e) => {
        if (e.target.id === 'product-form') await handleProductFormSubmit(e);
        if (e.target.id === 'daily-expense-form') await handleDailyExpenseSubmit(e);
        if (e.target.id === 'edit-daily-expense-form') await handleEditExpenseSubmit(e);
        if (e.target.id === 'reconciliation-form') {
            e.preventDefault();
            const actualAmount = parseFloat(document.getElementById('reconciliation-amount-input').value);
            if (!isNaN(actualAmount) && actualAmount >= 0) {
                await handleEndShift({ actualAmount });
            } else {
                utils.showNotification("Please enter a valid amount.", "error");
            }
        }
        if (e.target.id === 'defective-item-form') await handleDefectiveFormSubmit(e);
        if (e.target.id === 'employee-form') await handleEmployeeFormSubmit(e);
        if (e.target.id === 'customer-form') await handleCustomerFormSubmit(e);
        if (e.target.id === 'edit-cashier-form') await handleEditCashierSubmit(e);
        if (e.target.id === 'supplier-form') await handleSupplierFormSubmit(e);
        if (e.target.id === 'supplier-payment-form') await handleSupplierPaymentSubmit(e);
        if (e.target.id === 'select-supplier-form') await handleSelectSupplierSubmit(e);
        if (e.target.id === 'edit-shipment-form') await handleEditShipmentSubmit(e);
        if (e.target.id === 'edit-payment-form') await handleEditPaymentSubmit(e);
        if (e.target.id === 'add-defective-form') await handleAddDefectiveSubmit(e);
        if (e.target.id === 'return-defects-form') await handleReturnDefectsSubmit(e);
        if (e.target.id === 'edit-shipment-item-form') await handleEditShipmentItemSubmit(e);
        if (e.target.id === 'booking-confirmation-form') {
            e.preventDefault();
            const deposit = parseFloat(document.getElementById('booking-deposit-input').value) || 0;
            saveReceiptAsBooking(state.activeReceiptId, deposit);
        }
        if (e.target.id === 'admin-password-form') {
            e.preventDefault();
            const password = document.getElementById('admin-password-input').value;

            const result = await api.validateAdminPassword(password);

            if (result.success) {
                state.isAdminMode = true;
                ui.closeAdminPasswordModal();
                ui.render();
            } else {
                document.getElementById('admin-password-error').classList.remove('hidden');
            }
        }
        if (e.target.id === 'edit-booking-form') await handleEditBookingSubmit(e);
        if (e.target.id === 'free-delivery-cost-form') {
            e.preventDefault();
            const costInput = document.getElementById('free-delivery-cost-input');
            const cost = parseFloat(costInput.value);
            if (!isNaN(cost) && cost > 0) {
                const activeReceiptContent = document.getElementById(`receipt-content-${state.activeReceiptId}`);
                if (activeReceiptContent) {
                    activeReceiptContent.querySelector('.delivery-fee-input').value = cost;
                }
                ui.closeFreeDeliveryCostModal();
                completeSale();
            } else {
                utils.showNotification('Please enter a valid shipping cost.', 'error');
            }
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target.id === 'product-search') ui.renderProductGallery();
        if (e.target.id === 'inventory-search') ui.renderInventoryTable();
        if (e.target.id === 'customer-search') ui.renderCustomersPage();
        if (e.target.id === 'booking-search-input') {
            state.bookingSearchTerm = e.target.value;
            ui.renderBookingPage();
        }
        if (e.target.id === 'salaries-search-input') {
            state.salariesSearchTerm = e.target.value;
            ui.renderSalariesPage();
        }

        if (e.target.classList.contains('customer-phone-input') ||
            e.target.classList.contains('customer-name-input') ||
            e.target.classList.contains('customer-address-input') ||
            e.target.classList.contains('customer-city-input')) {

            const activeReceipt = state.receipts.find(r => r.id === state.activeReceiptId);
            if (activeReceipt) {
                if (e.target.classList.contains('customer-phone-input')) {
                    activeReceipt.customerPhone = e.target.value;
                    const customer = state.customers.find(c => c.phone === e.target.value.trim());
                    if (customer) {
                        const parent = e.target.closest('div.grid');
                        parent.querySelector('.customer-name-input').value = customer.name;
                        parent.querySelector('.customer-address-input').value = customer.address || '';
                        parent.querySelector('.customer-city-input').value = customer.city || '';
                        activeReceipt.customerName = customer.name;
                        activeReceipt.customerAddress = customer.address || '';
                        activeReceipt.customerCity = customer.city || '';
                    }
                }
                if (e.target.classList.contains('customer-name-input')) activeReceipt.customerName = e.target.value;
                if (e.target.classList.contains('customer-address-input')) activeReceipt.customerAddress = e.target.value;
                if (e.target.classList.contains('customer-city-input')) activeReceipt.customerCity = e.target.value;

                ui.renderReceiptTabs();
                api.cartSession.save();
            }
        }

        if (e.target.classList.contains('discount-percentage') || e.target.classList.contains('discount-amount') || e.target.classList.contains('delivery-fee-input')) {
            const activeReceiptContent = document.getElementById(`receipt-content-${state.activeReceiptId}`);
            if (activeReceiptContent) {
                if (e.target.classList.contains('discount-percentage')) activeReceiptContent.querySelector('.discount-amount').value = '';
                if (e.target.classList.contains('discount-amount')) activeReceiptContent.querySelector('.discount-percentage').value = '';
                ui.renderCart(state.activeReceiptId);
            }
        }
        if (['report-month-picker', 'report-day-picker', 'history-search', 'user-filter'].includes(e.target.id)) ui.renderSalesHistory();
        if (['bs-report-month-picker', 'bs-report-day-picker'].includes(e.target.id)) ui.renderBestSellersPage();
        if (['defects-month-picker', 'defects-day-picker', 'defects-search'].includes(e.target.id)) ui.renderDefectsPage();

        if (e.target.id === 'shift-history-date-filter') {
            state.shiftDateFilter = e.target.value;
            ui.render();
        }

        if (e.target.id === 'invoice-date-input') {
            state.newInvoiceBuilder.date = e.target.value;
        }
        if (e.target.id === 'invoice-shipping-cost-input') {
            state.newInvoiceBuilder.shippingCost = parseFloat(e.target.value) || 0;
            ui.updateInvoiceBuilderTotals();
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('salary-input')) {
            const username = e.target.dataset.user;
            const type = e.target.dataset.type;
            const value = parseFloat(e.target.value) || 0;

            if (!state.salaries[username]) {
                state.salaries[username] = { fixed: 0, commission: 0, bonus: 0 };
            }
            state.salaries[username][type] = value;
            api.saveData();
            ui.renderSalariesPage();
        }
        if (e.target.id === 'salaries-month-picker') {
            state.selectedSalariesMonth = e.target.value;
            ui.renderSalariesPage();
        }
        if (e.target.id === 'rent-amount-input') {
            state.expenses.rent.amount = parseFloat(e.target.value) || 0;
            api.saveData();
        }
        if (e.target.id === 'bs-time-filter-type' || e.target.id === 'time-filter-type' || e.target.id === 'supplier-time-filter-type') {
            const isBS = e.target.id.startsWith('bs');
            const isSupplier = e.target.id.startsWith('supplier');
            const prefix = isBS ? 'bs-' : (isSupplier ? 'supplier-' : '');
            const page = isBS ? 'best-sellers' : (isSupplier ? 'suppliers' : 'history');

            if (isSupplier) {
                state.supplierTimeFilter = e.target.value;
            }

            document.getElementById(`${prefix}month-filter-container`).classList.toggle('hidden', e.target.value !== 'month');
            document.getElementById(`${prefix}day-filter-container`).classList.toggle('hidden', e.target.value !== 'day');

            if (page === 'best-sellers') ui.renderBestSellersPage();
            else if (page === 'suppliers') ui.renderSuppliersPage();
            else ui.renderSalesHistory();
        }
        if (e.target.id === 'supplier-report-month-picker') {
            state.supplierMonthFilter = e.target.value;
            ui.renderSuppliersPage();
        }
        if (e.target.id === 'supplier-report-day-picker') {
            state.supplierDayFilter = e.target.value;
            ui.renderSuppliersPage();
        }

        if (e.target.id === 'free-delivery-checkbox') {
            const container = e.target.closest('[id^="receipt-content-"]');
            if (container) {
                ui.renderCart(state.activeReceiptId);
            }
        }

        if (e.target.classList.contains('product-selection')) {
            const container = e.target.closest('[id$="-content"]');
            handleProductSelectionChange(e.target.value, container);
        }
        if (e.target.classList.contains('sale-color')) {
            const container = e.target.closest('[id$="-content"]');
            handleSaleColorChange(container);
        }

        if (e.target.id === 'select-all-checkbox') toggleSelectAllSales(e.target.checked);
        if (e.target.classList.contains('sale-checkbox')) handleSaleCheckboxChange(e.target.dataset.saleId, e.target.checked);

        if (e.target.classList.contains('receipt-seller-select')) {
            const activeReceipt = state.receipts.find(r => r.id === state.activeReceiptId);
            if (activeReceipt) {
                activeReceipt.seller = e.target.value;
                api.cartSession.save();
            }
        }

        if (e.target.id === 'product-images') {
            const imagePreviewsContainer = document.getElementById('image-previews-container');
            const files = e.target.files;
            for (const file of files) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const previewWrapper = document.createElement('div');
                    previewWrapper.className = 'relative';
                    previewWrapper.innerHTML = `
                        <img src="${event.target.result}" class="w-full h-auto object-cover rounded-lg new-preview" style="aspect-ratio: 3/2;">
                        <button type="button" class="remove-image-preview-btn absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold">&times;</button>
                    `;
                    imagePreviewsContainer.appendChild(previewWrapper);
                };
                reader.readAsDataURL(file);
            }
        }
        if (e.target.classList.contains('gallery-size-selector')) {
            const card = e.target.closest('.product-card');
            updateVariantStockDisplay(card);
        }

        if (e.target.id === 'defective-product-select') {
            const productId = e.target.value;
            const product = state.products.find(p => p.id === productId);
            const detailsContainer = document.getElementById('defective-details-container');
            const colorSelect = document.getElementById('defective-color-select');
            const sizeSelect = document.getElementById('defective-size-select');
            const shipmentSelect = document.getElementById('defective-shipment-select');

            if (product) {
                colorSelect.innerHTML = Object.keys(product.colors || {}).map(c => `<option value="${c}">${c}</option>`).join('');
                colorSelect.dispatchEvent(new Event('change', { 'bubbles': true }));

                const supplierShipments = state.shipments.filter(s => s.supplierId === state.activeSupplierId && s.items.some(item => item.productId === productId));
                const shipmentsByDate = [...new Set(supplierShipments.map(s => s.date.split('T')[0]))].sort((a, b) => new Date(b) - new Date(a));

                if (shipmentsByDate.length > 0) {
                    shipmentSelect.innerHTML = `<option value="">-- Select Invoice --</option>` + shipmentsByDate.map(date => `<option value="${date}">Invoice of ${new Date(date).toLocaleDateString()}</option>`).join('');
                    shipmentSelect.disabled = false;
                } else {
                    shipmentSelect.innerHTML = `<option value="">${translations[state.lang].noShipmentsForProduct || 'No invoices found'}</option>`;
                    shipmentSelect.disabled = true;
                }
                detailsContainer.classList.remove('hidden');
            } else {
                detailsContainer.classList.add('hidden');
                colorSelect.innerHTML = '';
                sizeSelect.innerHTML = '';
                shipmentSelect.innerHTML = '';
            }
        }

        if (e.target.id === 'defective-color-select') {
            const productId = document.getElementById('defective-product-select').value;
            const product = state.products.find(p => p.id === productId);
            const selectedColor = e.target.value;
            const sizeSelect = document.getElementById('defective-size-select');

            if (product && selectedColor && product.colors[selectedColor]) {
                sizeSelect.innerHTML = Object.keys(product.colors[selectedColor].sizes || {}).map(s => `<option value="${s}">${s}</option>`).join('');
            } else {
                sizeSelect.innerHTML = '';
            }
            sizeSelect.dispatchEvent(new Event('change', { 'bubbles': true }));
        }

        if (['defective-size-select', 'defective-shipment-select'].includes(e.target.id)) {
            const productId = document.getElementById('defective-product-select').value;
            const color = document.getElementById('defective-color-select').value;
            const size = document.getElementById('defective-size-select').value;
            const shipmentDate = document.getElementById('defective-shipment-select').value;
            const quantityInput = document.getElementById('defective-quantity-input');

            if (productId && color && size && shipmentDate) {
                const shipmentsOnDate = state.shipments.filter(s => s.supplierId === state.activeSupplierId && s.date.startsWith(shipmentDate));
                const invoiceQuantity = shipmentsOnDate
                    .flatMap(s => s.items)
                    .filter(item => item.productId === productId && item.color === color && item.size === size)
                    .reduce((sum, item) => sum + item.quantity, 0);

                const alreadyDefectiveQty = state.defects
                    .filter(d => d.shipmentDate === shipmentDate && d.productId === productId && d.color === color && d.size === size)
                    .reduce((sum, d) => sum + d.quantity, 0);

                const maxAllowed = invoiceQuantity - alreadyDefectiveQty;
                quantityInput.max = maxAllowed;
                quantityInput.placeholder = `Max: ${maxAllowed}`;
            } else {
                quantityInput.max = 9999;
                quantityInput.placeholder = ``;
            }
        }

        if (e.target.classList.contains('daily-shipment-checkbox')) {
            const container = e.target.closest('.daily-invoices-container');
            const mergeBtn = container.querySelector('.merge-selected-shipments-btn');
            const selectedCount = container.querySelectorAll('.daily-shipment-checkbox:checked').length;

            if (selectedCount >= 2) {
                mergeBtn.disabled = false;
                mergeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                mergeBtn.disabled = true;
                mergeBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }

        if (e.target.classList.contains('cart-item-color-select')) {
            const productId = e.target.dataset.productId;
            const newColor = e.target.value;
            const product = state.products.find(p => p.id === productId);
            const sizeSelect = e.target.closest('.grid').querySelector('.cart-item-size-select');

            if (product && sizeSelect) {
                const availableSizes = Object.keys(product.colors[newColor]?.sizes || {});
                sizeSelect.innerHTML = availableSizes.map(s => `<option value="${s}">${s}</option>`).join('');
            }
        }

        if (e.target.id === 'existing-product-select') {
            const confirmBtn = document.getElementById('confirm-add-existing-product-btn');
            if (confirmBtn) {
                confirmBtn.disabled = !e.target.value;
            }
        }
    });

    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (!modal.classList.contains('hidden')) {
                    const cancelBtn = modal.querySelector('button[id^="cancel-"], button[id$="-cancel-btn"]');
                    if (cancelBtn) {
                        cancelBtn.click();
                    } else {
                        modal.classList.add('hidden');
                    }
                }
            });
        }

        if (e.key === 'Enter') {
            let enterHandled = false;

            const activeModal = document.querySelector('.modal:not(.hidden)');
            if (activeModal && document.activeElement.tagName !== 'TEXTAREA') {
                const form = activeModal.querySelector('form');
                if (form) {
                    const submitButton = form.querySelector('button[type="submit"]');
                    if (submitButton && !submitButton.disabled) {
                        submitButton.click();
                        enterHandled = true;
                    }
                } else {
                    const primaryButton = activeModal.querySelector('.btn-primary');
                    if (primaryButton && !primaryButton.disabled) {
                        primaryButton.click();
                        enterHandled = true;
                    }
                }
            }

            if (document.activeElement.classList.contains('barcode-scanner-input')) {
                e.preventDefault();
                const barcodeInput = document.activeElement;
                const barcode = barcodeInput.value.trim();
                if (barcode) {
                    handleBarcodeScan(barcode);
                    barcodeInput.value = '';
                }
                enterHandled = true;
            } else if (state.currentPage === 'selling-page' && document.activeElement.classList.contains('paid-amount')) {
                const activeReceiptContent = document.getElementById(`receipt-content-${state.activeReceiptId}`);
                if (activeReceiptContent) {
                    activeReceiptContent.querySelector('.complete-sale-btn').click();
                    enterHandled = true;
                }
            }

            if (enterHandled) {
                e.preventDefault();
            }
        }

        if (e.key === 'F1') {
            e.preventDefault();
            if (state.isAdminMode) {
                api.openUsersWindow();
            } else {
                ui.showAdminPasswordModal();
            }
        }

        if (e.key === 'F2') {
            if (state.currentPage === 'selling-page') {
                e.preventDefault();
                const activeReceiptContent = document.getElementById(`receipt-content-${state.activeReceiptId}`);
                if (activeReceiptContent) {
                    const barcodeInput = activeReceiptContent.querySelector('.barcode-scanner-input');
                    if (barcodeInput) {
                        barcodeInput.focus();
                    }
                }
            }
        }

        if (e.key === 'F8') {
            e.preventDefault();
            if (state.currentPage === 'history-page') {
                if (state.selectedSales.size === 1) {
                    const saleIdToPrint = state.selectedSales.values().next().value;
                    api.printReceipt(saleIdToPrint);
                } else if (state.selectedSales.size > 1) {
                    utils.showNotification("Please select only one receipt to print.", "info");
                } else {
                    utils.showNotification("Please select a receipt to print.", "info");
                }
            }
        }

        if (e.key === 'F3') {
            if (state.currentPage === 'selling-page') {
                e.preventDefault();
                createNewReceipt();
            }
        }

        if (e.key === 'F9') {
            if (state.currentPage === 'selling-page') {
                e.preventDefault();
                await completeSale();
            }
        }
    });

    document.querySelector('header').addEventListener('click', (e) => {
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            if (navLink.id === 'admin-mode-btn') {
                if (state.isAdminMode) {
                    state.isAdminMode = false;
                    ui.render();
                } else {
                    ui.showAdminPasswordModal();
                }
            } else if (navLink.id === 'lang-switcher') {
                state.lang = state.lang === 'en' ? 'ar' : 'en';
                ui.render();
            } else {
                state.currentPage = navLink.dataset.page;
                ui.render();
            }
        }
        if (e.target.closest('#home-btn')) {
            state.currentPage = 'home-page';
            ui.render();
        }
        const logoutBtn = e.target.closest('#logout-btn');
        if (logoutBtn) {
            logoutBtn.classList.add('closing');
            setTimeout(() => {
                api.logout();
            }, 300);
        }
    });

    document.addEventListener('click', async (e) => {
        const target = e.target;
        const closest = (selector) => target.closest(selector);

        if (closest('#export-pdf-btn')) await api.exportReportToPDF();
        if (closest('#export-returns-pdf-btn')) await api.exportReturnsToPDF();
        if (closest('#export-inventory-btn')) await api.exportInventoryToPDF();

        if (target.id === 'add-daily-expense-btn') ui.showDailyExpenseModal();
        if (target.id === 'calculate-shift-btn') {
            const shiftData = calculateCurrentShift();
            state.currentShiftData = shiftData;
            ui.showShiftCalculationModal(shiftData);
        }
        if (closest('.view-shift-details-btn')) {
            const shiftId = closest('.view-shift-details-btn').dataset.shiftId;
            const shift = state.shifts.find(s => s.id === shiftId);
            if (shift) ui.showShiftCalculationModal({ ...shift, isCurrent: false });
        }
        if (closest('.reopen-shift-btn')) {
            const shiftId = closest('.reopen-shift-btn').dataset.shiftId;
            handleReopenShift(shiftId);
        }
        if (target.id === 'end-shift-btn') {
            const expectedAmount = parseFloat(target.dataset.expected);
            ui.showReconciliationModal(expectedAmount);
        }
        if (target.id === 'cancel-daily-expense-btn') ui.closeDailyExpenseModal();
        if (closest('.edit-expense-btn')) {
            const expenseId = closest('.edit-expense-btn').dataset.expenseId;
            const expense = state.expenses.daily.find(e => e.id === expenseId);
            if (expense) ui.showEditDailyExpenseModal(expense);
        }
        if (closest('.delete-expense-btn')) {
            const expenseId = closest('.delete-expense-btn').dataset.expenseId;
            handleDeleteExpense(expenseId);
        }
        if (target.id === 'cancel-edit-expense-btn') ui.closeEditDailyExpenseModal();
        if (target.id === 'cancel-shift-calculation-btn') ui.closeShiftCalculationModal();
        if (target.id === 'cancel-reconciliation-btn') ui.closeReconciliationModal();

        if (target.id === 'open-users-window-btn') api.openUsersWindow();
        if (target.id === 'cancel-admin-password-btn') ui.closeAdminPasswordModal();
        if (target.id === 'export-customers-btn') api.exportCustomersToExcel();
        if (target.id === 'export-salaries-btn') api.exportSalariesToExcel();

        if (closest('.product-row')) {
            const row = closest('.product-row');
            const productId = row.dataset.productId;
            const detailRow = row.nextElementSibling;
            if (detailRow && detailRow.classList.contains('product-detail-row')) {
                const detailCell = detailRow.querySelector('td');
                if (detailRow.classList.contains('hidden')) {
                    document.querySelectorAll('.product-detail-row').forEach(r => {
                        if (r !== detailRow) {
                            r.classList.add('hidden');
                            r.querySelector('td').innerHTML = '';
                        }
                    });
                    detailCell.innerHTML = ui.renderInventoryDetail(productId);
                    detailRow.classList.remove('hidden');
                    ui.updateUIText();
                } else {
                    detailRow.classList.add('hidden');
                    detailCell.innerHTML = '';
                }
            }
        }

        if (closest('.toggle-paid-btn')) {
            const button = closest('.toggle-paid-btn');
            const { user, month } = button.dataset;
            const paidStatusKey = `${user}-${month}`;
            state.salariesPaidStatus[paidStatusKey] = !state.salariesPaidStatus[paidStatusKey];
            await api.saveData();
            ui.renderSalariesPage();
        }
        if (target.id === 'toggle-rent-paid-btn') {
            const month = state.selectedSalariesMonth;
            state.expenses.rent.paidStatus[month] = !state.expenses.rent.paidStatus[month];
            await api.saveData();
            ui.renderSalariesPage();
        }
        if (closest('.edit-employee-btn')) {
            const username = closest('.edit-employee-btn').dataset.username;
            const employee = state.users.find(u => u.username === username);
            if (employee) ui.showEmployeeModal(employee);
        }
        if (closest('.delete-employee-btn')) handleDeleteEmployee(closest('.delete-employee-btn').dataset.username);
        if (closest('.payment-method-btn')) {
            const currentReceiptContent = closest('[id^="receipt-content-"]');
            if (currentReceiptContent) {
                currentReceiptContent.querySelectorAll('.payment-method-btn').forEach(btn => btn.classList.remove('selected'));
                closest('.payment-method-btn').classList.add('selected');
            }
        }
        if (closest('#receipt-selection-buttons button')) {
            const button = closest('#receipt-selection-buttons button');
            const receiptId = button.dataset.receiptId;
            addToCart(state.itemToAdd, receiptId);
            state.currentPage = 'selling-page';
            state.activeReceiptId = receiptId;
            ui.closeReceiptSelectionModal();
            ui.render();
        }
        if (target.id === 'cancel-receipt-selection-btn') ui.closeReceiptSelectionModal();
        if (target.id === 'add-product-btn') {
            state.productModalSource = 'inventory';
            ui.showProductModal();
        }

        if (target.id === 'backup-db-btn') {
            utils.showLoader();
            try {
                const result = await api.backupDatabase();
                if (result.success) {
                    utils.showNotification(`${translations[state.lang].backupSuccess} ${result.path}`, 'success');
                } else if (result.message && result.message !== 'Backup cancelled.') {
                    utils.showNotification(`${translations[state.lang].backupError} ${result.error}`, 'error');
                }
            } catch (err) {
                utils.showNotification(`${translations[state.lang].backupError} ${err.message}`, 'error');
            } finally {
                utils.hideLoader();
            }
        }

        if (target.id === 'restore-db-btn') {
            if (confirm("Are you sure you want to restore the database? This will overwrite all current data and restart the application.")) {
                utils.showLoader();
                try {
                    const result = await api.restoreDatabase();
                    if (result.success) {
                        utils.showNotification(translations[state.lang].restoreSuccess, 'success');
                    } else if (result.message && result.message !== 'Restore cancelled.') {
                        utils.showNotification(`${translations[state.lang].restoreError} ${result.error}`, 'error');
                        utils.hideLoader();
                    } else {
                        utils.hideLoader();
                    }
                } catch (err) {
                    utils.showNotification(`${translations[state.lang].restoreError} ${err.message}`, 'error');
                    utils.hideLoader();
                }
            }
        }
        if (target.id === 'cancel-product-modal-btn') {
            ui.closeProductModal();
            document.getElementById('product-modal').style.zIndex = '50';
        }
        if (target.id === 'close-barcode-modal-btn') ui.closeBarcodeModal();
        if (target.id === 'manage-categories-btn') ui.showCategoryModal();
        if (target.id === 'close-category-modal-btn') ui.closeCategoryModal();
        if (target.id === 'add-category-btn') await handleAddCategory();
        if (closest('.delete-category-btn')) await handleDeleteCategory(closest('.delete-category-btn').dataset.category);
        if (closest('.save-category-btn')) await handleUpdateCategory(closest('.save-category-btn'));
        if (target.id === 'clear-product-form-btn') {
            state.newProductFormData = null;
            ui.showProductModal();
        }

        if (target.id === 'add-receipt-btn') createNewReceipt();
        if (target.id === 'add-employee-btn') ui.showEmployeeModal();
        if (target.id === 'cancel-employee-modal-btn') ui.closeEmployeeModal();
        if (target.id === 'add-customer-btn') ui.showCustomerModal();
        if (target.id === 'cancel-customer-modal-btn') ui.closeCustomerModal();
        if (closest('.edit-cashier-btn')) ui.showEditCashierModal(closest('.edit-cashier-btn').dataset.saleId);
        if (closest('.receipt-tab')) {
            const tab = closest('.receipt-tab');
            if (tab.dataset.receiptId) {
                const receiptId = tab.dataset.receiptId;
                if (target.classList.contains('close-receipt-btn')) closeReceipt(receiptId);
                else switchReceipt(receiptId);
            }
        }
        if (target.classList.contains('edit-product-btn')) {
            const p = state.products.find(p => p.id === target.dataset.id);
            if (p) {
                state.productModalSource = 'inventory';
                ui.showProductModal(p);
            }
        }
        if (target.classList.contains('delete-product-btn')) {
            if (confirm('Are you sure you want to delete this product?')) {
                state.products = state.products.filter(p => p.id !== target.dataset.id);
                await api.saveData();
                ui.render();
            }
        }
        if (target.classList.contains('show-barcodes-btn')) ui.showBarcodeModal(target.dataset.id);
        if (target.classList.contains('print-size-barcode-btn')) {
            const { productId, color, size } = target.dataset;
            const product = state.products.find(p => p.id === productId);
            if (product && product.colors[color] && product.colors[color].sizes[size]) {
                const barcode = product.colors[color].sizes[size].barcode;
                api.printBarcode(barcode, product.name, color, size, product.sellingPrice);
            }
        }
        if (target.classList.contains('category-tab')) {
            state.activeCategory = target.dataset.category;
            ui.render();
        }

        if (target.classList.contains('color-swatch')) {
            const card = closest('.product-card');
            if (!card) return;
            card.querySelectorAll('.color-swatch').forEach(swatch => swatch.classList.remove('active'));
            target.classList.add('active');
            const productId = card.querySelector('[data-product-id]').dataset.productId;
            const selectedColor = target.dataset.color;
            const product = state.products.find(p => p.id === productId);
            const sizeSelector = card.querySelector('.gallery-size-selector');
            if (product && product.colors[selectedColor]) {
                const availableSizes = Object.entries(product.colors[selectedColor].sizes).filter(([, sizeData]) => sizeData.quantity > 0);
                sizeSelector.innerHTML = availableSizes.map(([size, sizeData]) => `<option value="${size}">${size} (Stock: ${sizeData.quantity})</option>`).join('') || '<option>N/A</option>';
                sizeSelector.disabled = availableSizes.length === 0;
                updateVariantStockDisplay(card);
            }
        }
        if (target.classList.contains('add-gallery-to-cart-btn')) {
            const container = closest('[data-product-id]');
            const productId = container.dataset.productId;
            const activeColorSwatch = container.querySelector('.color-swatch.active');
            const color = activeColorSwatch ? activeColorSwatch.dataset.color : null;
            const size = container.querySelector('.gallery-size-selector').value;
            const quantity = parseInt(container.querySelector('.quantity-input').value, 10);
            if (!color) {
                utils.showNotification("Please select a color.", "error");
                return;
            }
            addToCartHandler({ productId, color, size, quantity }, target);
        }
        if (target.classList.contains('add-to-cart-btn')) {
            const container = closest('[id$="-content"]');
            const productId = container.querySelector('.product-selection').value;
            if (productId) {
                const product = state.products.find(p => p.id === productId);
                const itemData = {
                    productId: product.id,
                    productName: product.name,
                    quantity: parseInt(container.querySelector('.sale-quantity').value, 10),
                    price: parseFloat(container.querySelector('.sale-price')?.value || product.sellingPrice),
                    color: container.querySelector('.sale-color').value,
                    size: container.querySelector('.sale-size').value,
                    purchasePrice: product.purchasePrice
                };
                addToCart(itemData, state.activeReceiptId, target);
            }
        }
        if (target.classList.contains('remove-from-cart-btn')) {
            const itemIndex = parseInt(target.dataset.index, 10);
            const receiptId = target.dataset.receiptId;
            const receipt = state.receipts.find(r => r.id === receiptId);
            if (receipt && receipt.cart[itemIndex]) {
                const item = receipt.cart[itemIndex];
                const product = state.products.find(p => p.id === item.productId);
                if (product && product.colors[item.color] && product.colors[item.size]) {
                    product.colors[item.color].sizes[item.size].quantity += item.quantity;
                }
                receipt.cart.splice(itemIndex, 1);
                api.cartSession.save();
                ui.render();
            }
        }
        if (target.classList.contains('complete-sale-btn')) await completeSale();
        if (target.classList.contains('complete-sale-from-booking-btn')) await completeSaleFromBooking(target.dataset.bookingId);
        if (target.matches('.return-sale-btn')) ui.showReturnModal(target.dataset.saleId);
        if (target.matches('.print-receipt-btn')) await api.printReceipt(target.dataset.saleId);
        if (target.id === 'delete-selected-btn') await deleteSelectedSales();
        if (target.id === 'cancel-return-btn') ui.closeReturnModal();
        if (target.id === 'confirm-return-btn') ui.showReturnTypeModal();
        if (target.id === 'return-to-stock-btn') handleNormalReturnOption();
        if (target.id === 'return-as-defective-btn') handleDefectiveReturnOption();
        if (target.id === 'cancel-return-type-btn') ui.closeReturnTypeModal();
        if (target.id === 'cancel-free-delivery-cost-btn') ui.closeFreeDeliveryCostModal();
        if (target.classList.contains('remove-image-preview-btn')) target.parentElement.remove();
        if (target.classList.contains('delete-booking-btn')) {
            const bookingId = target.dataset.bookingId;
            if (confirm('Are you sure you want to delete this booking? This will restore the stock.')) {
                deleteBooking(bookingId);
            }
        }
        if (target.classList.contains('save-as-booking-btn')) {
            const activeReceipt = state.receipts.find(r => r.id === state.activeReceiptId);
            if (activeReceipt && activeReceipt.cart.length > 0) {
                ui.showBookingConfirmationModal(state.activeReceiptId);
            } else {
                utils.showNotification("Cart is empty.", "info");
            }
        }
        if (target.classList.contains('print-booking-btn')) await api.printBooking(target.dataset.bookingId);
        if (closest('.edit-booking-btn')) ui.showEditBookingModal(closest('.edit-booking-btn').dataset.bookingId);
        if (closest('.edit-customer-btn')) {
            const customer = state.customers.find(c => c.id === closest('.edit-customer-btn').dataset.id);
            if (customer) ui.showCustomerModal(customer);
        }
        if (closest('.delete-customer-btn')) handleDeleteCustomer(closest('.delete-customer-btn').dataset.id);
        if (target.id === 'cancel-booking-confirmation-btn') ui.closeBookingConfirmationModal();
        if (target.id === 'cancel-edit-cashier-btn') ui.closeEditCashierModal();
        if (target.id === 'stock-reduction-deduct-btn') handleDeductCostOption();
        if (target.id === 'stock-reduction-defective-btn') handleMarkDefectiveOption();
        if (target.id === 'stock-reduction-cancel-btn') cancelStockAdjustmentFlow();
        if (target.id === 'cancel-defective-btn') ui.closeDefectiveItemModal();
        if (target.id === 'cancel-edit-booking-btn') ui.closeEditBookingModal();

        if (target.id === 'add-supplier-btn') ui.showSupplierModal(null);
        if (target.id === 'edit-supplier-btn') {
            const supplier = state.suppliers.find(s => s.id === state.activeSupplierId);
            if (supplier) ui.showSupplierModal(supplier);
        }
        if (target.id === 'delete-supplier-btn') handleDeleteSupplier(state.activeSupplierId);
        if (target.id === 'cancel-supplier-modal-btn') ui.closeSupplierModal();
        if (closest('.supplier-tab')) {
            state.activeSupplierId = closest('.supplier-tab').dataset.id;
            ui.renderSuppliersPage();
        }
        if (target.id === 'make-payment-btn') ui.showSupplierPaymentModal(state.activeSupplierId);
        if (target.id === 'cancel-payment-modal-btn') ui.closeSupplierPaymentModal();

        if (closest('.daily-invoice-header')) {
            const header = closest('.daily-invoice-header');
            const details = header.closest('.daily-invoice-group').querySelector('.daily-invoice-details');
            const icon = header.querySelector('.chevron-icon');
            if (details) {
                details.classList.toggle('hidden');
                icon.classList.toggle('rotate-180');
            }
        }

        if (closest('.edit-payment-btn')) ui.showEditPaymentModal(closest('.edit-payment-btn').dataset.id);
        if (closest('.delete-payment-btn')) handleDeletePayment(closest('.delete-payment-btn').dataset.id);

        if (target.id === 'cancel-select-supplier-btn') {
            ui.closeSelectSupplierModal();
            cancelStockAdjustmentFlow();
        }

        if (target.id === 'add-defective-btn') ui.showAddDefectiveModal(state.activeSupplierId);
        if (target.id === 'manage-returns-btn') ui.showReturnDefectsModal(state.activeSupplierId);
        if (target.id === 'cancel-add-defective-btn') ui.closeAddDefectiveModal();
        if (target.id === 'cancel-return-defects-btn') ui.closeReturnDefectsModal();


        if (closest('.undo-defect-btn')) {
            handleUndoDefect(closest('.undo-defect-btn').dataset.id);
        }

        if (closest('.print-daily-shipment-btn')) {
            const btn = closest('.print-daily-shipment-btn');
            api.printShipmentInvoice(state.activeSupplierId, btn.dataset.date);
        }

        if (closest('.edit-daily-shipment-btn')) {
            ui.showEditShipmentModal(closest('.edit-daily-shipment-btn').dataset.date);
        }

        if (closest('.delete-daily-shipment-btn')) {
            const btn = closest('.delete-daily-shipment-btn');
            handleDeleteSelectedShipments(btn.dataset.date);
        }

        if (closest('.merge-selected-shipments-btn')) {
            const btn = closest('.merge-selected-shipments-btn');
            handleMergeSelectedShipments(state.activeSupplierId, btn.dataset.date);
        }

        if (closest('.edit-shipment-item-btn')) {
            const btn = closest('.edit-shipment-item-btn');
            const shipmentId = btn.closest('.daily-invoice-group').dataset.shipmentId;
            const itemIndex = parseInt(btn.dataset.itemIndex, 10);
            ui.showEditShipmentItemModal(shipmentId, itemIndex);
        }
        if (target.id === 'cancel-edit-item-btn') {
            ui.closeEditShipmentItemModal();
        }
        if (closest('.delete-shipment-item-btn')) {
            const btn = closest('.delete-shipment-item-btn');
            const shipmentId = btn.closest('.daily-invoice-group').dataset.shipmentId;
            const itemIndex = parseInt(btn.dataset.itemIndex, 10);
            handleDeleteShipmentItem(shipmentId, itemIndex);
        }
        if (closest('.split-invoice-btn')) {
            const btn = closest('.split-invoice-btn');
            const shipmentId = btn.closest('.daily-invoice-group').dataset.shipmentId;
            handleSplitInvoice(shipmentId);
        }

        if (target.classList.contains('edit-cart-item-btn')) {
            const { receiptId, index } = target.dataset;
            state.editingCartItem = { receiptId, index: parseInt(index, 10) };
            ui.renderCart(receiptId);
        }

        if (target.classList.contains('cancel-edit-cart-item-btn')) {
            state.editingCartItem = null;
            ui.renderCart(target.dataset.receiptId);
        }

        if (target.classList.contains('save-cart-item-btn')) {
            const { receiptId, index } = target.dataset;
            const receipt = state.receipts.find(r => r.id === receiptId);
            const originalItem = receipt.cart[parseInt(index, 10)];

            const editContainer = target.closest('.flex-col');
            const newColor = editContainer.querySelector('.cart-item-color-select').value;
            const newSize = editContainer.querySelector('.cart-item-size-select').value;
            const newQuantity = parseInt(editContainer.querySelector('.cart-item-quantity-input').value, 10);
            const newPrice = parseFloat(editContainer.querySelector('.cart-item-price-input').value);

            const product = state.products.find(p => p.id === originalItem.productId);
            const originalVariantStock = product.colors[originalItem.color]?.sizes[originalItem.size]?.quantity || 0;
            const newVariantStock = product.colors[newColor]?.sizes[newSize]?.quantity || 0;

            const isSameVariant = originalItem.color === newColor && originalItem.size === newSize;
            const stockNeeded = newQuantity - (isSameVariant ? originalItem.quantity : 0);

            if (stockNeeded > newVariantStock) {
                utils.showNotification(`Not enough stock for ${product.name} (${newColor}/${newSize}). Only ${newVariantStock} available.`, 'error');
                return;
            }

            product.colors[originalItem.color].sizes[originalItem.size].quantity += originalItem.quantity;
            product.colors[newColor].sizes[newSize].quantity -= newQuantity;

            originalItem.color = newColor;
            originalItem.size = newSize;
            originalItem.quantity = newQuantity;
            originalItem.price = newPrice;

            state.editingCartItem = null;
            api.cartSession.save();
            ui.renderCart(receiptId);
        }

        if (target.classList.contains('cart-quantity-change-btn')) {
            const amount = parseInt(target.dataset.amount, 10);
            const input = target.parentElement.querySelector('.cart-item-quantity-input');
            let currentValue = parseInt(input.value, 10);
            currentValue = Math.max(1, currentValue + amount);
            input.value = currentValue;
        }

        if (target.id === 'add-new-invoice-btn') ui.showInvoiceBuilderModal();
        if (target.id === 'cancel-invoice-builder-btn') ui.closeInvoiceBuilderModal();
        if (target.id === 'add-existing-product-to-invoice-btn') {
            document.getElementById('product-modal').style.zIndex = '60';
            ui.showAddExistingProductModal();
        }
        if (target.id === 'add-new-product-to-invoice-btn') {
            document.getElementById('product-modal').style.zIndex = '60';
            state.productModalSource = 'invoice';
            ui.showProductModal();
        }
        if (target.id === 'cancel-add-existing-product-btn') {
            ui.closeAddExistingProductModal();
            document.getElementById('product-modal').style.zIndex = '50';
        }
        if (target.id === 'confirm-add-existing-product-btn') {
            const productId = document.getElementById('existing-product-select').value;
            if (productId) ui.showProductQuantityModal(productId);
        }
        if (target.id === 'cancel-quantity-modal-btn') {
            ui.closeProductQuantityModal();
            document.getElementById('product-modal').style.zIndex = '50';
        }
        if (target.id === 'save-quantities-to-invoice-btn') {
            const form = document.getElementById('product-quantity-form');
            const productId = form.dataset.productId;
            const product = state.products.find(p => p.id === productId);
            const quantities = {};
            let totalCost = 0;
            let totalQty = 0;

            form.querySelectorAll('.product-quantity-input').forEach(input => {
                const qty = parseInt(input.value, 10) || 0;
                if (qty > 0) {
                    const { color, size } = input.dataset;
                    if (!quantities[color]) quantities[color] = {};
                    quantities[color][size] = qty;
                    totalCost += qty * product.purchasePrice;
                    totalQty += qty;
                }
            });

            if (totalQty > 0) {
                state.newInvoiceBuilder.items.push({ productId, quantities, totalCost });
            }
            ui.closeProductQuantityModal();
            document.getElementById('product-modal').style.zIndex = '50';
            ui.renderInvoiceBuilder();
        }
        if (target.classList.contains('delete-invoice-item-btn')) {
            const index = parseInt(target.dataset.index, 10);
            state.newInvoiceBuilder.items.splice(index, 1);
            ui.renderInvoiceBuilder();
        }
        if (target.classList.contains('edit-invoice-item-btn')) {
            const index = parseInt(target.dataset.index, 10);
            state.newInvoiceBuilder.editingItemIndex = index;
            ui.renderInvoiceBuilder();
        }
        if (target.classList.contains('save-invoice-item-changes-btn')) {
            const index = parseInt(target.dataset.index, 10);
            const item = state.newInvoiceBuilder.items[index];
            const product = state.products.find(p => p.id === item.productId);

            let newTotalCost = 0;
            document.querySelectorAll(`.invoice-item-qty-input[data-index="${index}"]`).forEach(input => {
                const qty = parseInt(input.value, 10) || 0;
                const { color, size } = input.dataset;
                if (qty > 0) {
                    if (!item.quantities[color]) item.quantities[color] = {};
                    item.quantities[color][size] = qty;
                    newTotalCost += qty * product.purchasePrice;
                } else {
                    if (item.quantities[color]) {
                        delete item.quantities[color][size];
                        if (Object.keys(item.quantities[color]).length === 0) {
                            delete item.quantities[color];
                        }
                    }
                }
            });
            item.totalCost = newTotalCost;
            state.newInvoiceBuilder.editingItemIndex = null;
            ui.renderInvoiceBuilder();
        }
        if (target.id === 'save-invoice-btn') await handleSaveInvoice();
    });

    const productModal = document.getElementById('product-modal');
    if (productModal) {
        productModal.addEventListener('click', (e) => {
            if (e.target.id === 'add-color-btn') {
                document.getElementById('color-container').insertAdjacentHTML('beforeend', ui.createColorEntry());
            }
            if (e.target.classList.contains('remove-color-btn')) {
                e.target.closest('.color-entry').remove();
            }
            if (e.target.classList.contains('add-size-btn')) {
                const sizesContainer = e.target.previousElementSibling;
                sizesContainer.insertAdjacentHTML('beforeend', ui.createSizeEntry());
            }
            if (e.target.classList.contains('remove-size-btn')) {
                e.target.closest('.size-entry').remove();
            }
        });
    }
}
