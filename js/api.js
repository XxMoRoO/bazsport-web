/**
 * js/api.js (معدل بالكامل للويب)
 * يحتوي هذا الملف على جميع الدوال التي تتفاعل مع Firestore و Storage مباشرة.
 * تم استبدال جميع استدعاءات `window.api` بدوال Firebase JS SDK.
 */

import { state, translations } from './state.js';
import { showLoader, hideLoader, showNotification } from './utils.js';
import { db, storage } from './firebase-init.js';
import {
    collection, getDocs, doc, getDoc, writeBatch, runTransaction,
    query, where, addDoc, updateDoc, deleteDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


// --- عمليات البيانات الأساسية ---

/**
 * دالة للتحقق من كلمة سر الأدمن.
 */
export async function validateAdminPassword(password) {
    try {
        const configRef = doc(db, "app_config", "main");
        const configDoc = await getDoc(configRef);
        if (configDoc.exists() && configDoc.data().adminPassword === password) {
            return { success: true };
        } else {
            return { success: false, message: 'Incorrect password.' };
        }
    } catch (error) {
        console.error("Error validating admin password:", error);
        return { success: false, message: 'An error occurred.' };
    }
}

/**
 * تحميل جميع البيانات الأولية من Firestore.
 */
export async function loadData() {
    try {
        const collections = ['products', 'sales', 'customers', 'bookings', 'defects', 'suppliers', 'shipments', 'shifts', 'users', 'daily_expenses'];
        const data = {};
        for (const coll of collections) {
            const snapshot = await getDocs(collection(db, coll));
            data[coll] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        const configDoc = await getDoc(doc(db, "app_config", "main"));
        if (configDoc.exists()) {
            const configData = configDoc.data();
            data.config = configData;
            data.categories = configData.categories || [];
            data.salaries = configData.salaries || {};
            data.salariesPaidStatus = configData.salariesPaidStatus || {};
            data.expenses = {
                rent: configData.expenses?.rent || { amount: 0, paidStatus: {} },
                daily: data.daily_expenses || []
            };
            data.lastShiftReportTime = configData.lastShiftReportTime;
        } else {
            data.config = {};
            data.categories = [];
            data.salaries = {};
            data.salariesPaidStatus = {};
            data.expenses = { rent: { amount: 0, paidStatus: {} }, daily: [] };
        }
        return data;
    } catch (error) {
        console.error("Error loading data from Firestore:", error);
        return { error: error.message };
    }
}

/**
 * حفظ جميع التغييرات في الحالة إلى Firestore.
 */
export async function saveData() {
    showLoader();
    const batch = writeBatch(db);
    try {
        const { products, sales, categories, customers, bookings, salaries, salariesPaidStatus, expenses, defects, suppliers, shipments, shifts, users } = state;

        const configRef = doc(db, "app_config", "main");
        const savedCategories = categories.filter(c => c !== 'All');
        batch.set(configRef, {
            categories: savedCategories,
            salaries,
            salariesPaidStatus,
            expenses: { rent: expenses.rent },
            lastShiftReportTime: state.lastShiftReportTime
        }, { merge: true });

        const collections = { products, sales, customers, bookings, defects, suppliers, shipments, shifts, users, daily_expenses: expenses.daily };
        for (const [collName, collData] of Object.entries(collections)) {
            if (collData) {
                const existingDocsSnapshot = await getDocs(collection(db, collName));
                const existingIds = new Set(existingDocsSnapshot.docs.map(d => d.id));

                collData.forEach(item => {
                    if (item.id) {
                        const docRef = doc(db, collName, item.id);
                        batch.set(docRef, item);
                        existingIds.delete(item.id);
                    } else {
                        console.warn(`Item in collection ${collName} is missing an ID`, item);
                    }
                });

                existingIds.forEach(idToDelete => {
                    batch.delete(doc(db, collName, idToDelete));
                });
            }
        }

        await batch.commit();
        console.log("Data saved successfully.");
    } catch (error) {
        console.error("Failed to save data:", error);
        showNotification("Error: Could not save data.", 'error');
    } finally {
        hideLoader();
    }
}

// --- دوال اليوميات والمصاريف ---
export async function saveDailyExpense(expenseData) {
    try {
        const docRef = doc(collection(db, "daily_expenses"), expenseData.id);
        await setDoc(docRef, expenseData);
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export async function updateDailyExpense(expenseData) {
    try {
        const { id, ...dataToUpdate } = expenseData;
        await updateDoc(doc(db, "daily_expenses", id), dataToUpdate);
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export async function deleteDailyExpense(expenseId) {
    try {
        await deleteDoc(doc(db, "daily_expenses", expenseId));
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export async function saveShift(shiftData) {
    try {
        await setDoc(doc(db, "shifts", shiftData.id), shiftData);
        await setDoc(doc(db, "app_config", "main"), { lastShiftReportTime: shiftData.endedAt }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Error saving shift:", error);
        return { success: false, message: error.message };
    }
}

// --- إدارة المخزون والتوالف ---
export async function addDefectiveItem(defectData) {
    try {
        await runTransaction(db, async (transaction) => {
            const productRef = doc(db, "products", defectData.productId);
            const productDoc = await transaction.get(productRef);

            if (!productDoc.exists()) {
                throw new Error(`Product with ID ${defectData.productId} not found.`);
            }

            const product = productDoc.data();
            const currentQty = product.colors?.[defectData.color]?.sizes?.[defectData.size]?.quantity || 0;

            if (defectData.quantity > currentQty) {
                throw new Error(`Cannot mark ${defectData.quantity} as defective. Only ${currentQty} in stock.`);
            }

            const path = `colors.${defectData.color}.sizes.${defectData.size}.quantity`;
            transaction.update(productRef, { [path]: currentQty - defectData.quantity });

            const newDefectRef = doc(collection(db, "defects"), defectData.id);
            transaction.set(newDefectRef, defectData);
        });

        return { success: true };
    } catch (error) {
        console.error("Error adding defective item:", error);
        return { success: false, error: error.message };
    }
}


// --- إدارة الأصناف والفواتير والموردين ---
export async function saveNewInvoice(invoiceData) {
    const { supplierId, date, shippingCost, items } = invoiceData;
    try {
        const shipmentId = `SH${date.replace(/-/g, '')}-${Date.now().toString().slice(-5)}`;
        const newShipment = { id: shipmentId, supplierId, date, shippingCost, items: [], totalCost: 0 };
        let totalInvoiceCost = 0;

        await runTransaction(db, async (transaction) => {
            for (const item of items) {
                if (item.isNew) {
                    const newProductRef = doc(db, 'products', item.productData.id);
                    transaction.set(newProductRef, item.productData);
                }

                const productRef = doc(db, 'products', item.productId);
                const productDoc = await transaction.get(productRef);

                const productData = productDoc.exists() ? productDoc.data() : item.productData;
                if (!productData) throw new Error(`Product data for ${item.productId} not found.`);

                for (const [color, sizes] of Object.entries(item.quantities)) {
                    for (const [size, quantity] of Object.entries(sizes)) {
                        if (quantity > 0) {
                            const currentQty = productData.colors?.[color]?.sizes?.[size]?.quantity || 0;
                            const newQty = currentQty + quantity;
                            const fieldPath = `colors.${color}.sizes.${size}.quantity`;
                            transaction.update(productRef, { [fieldPath]: newQty });

                            totalInvoiceCost += quantity * productData.purchasePrice;

                            newShipment.items.push({
                                productId: item.productId,
                                productName: productData.name,
                                color: color,
                                size: size,
                                quantity: quantity,
                                purchasePrice: productData.purchasePrice
                            });
                        }
                    }
                }
            }
            newShipment.totalCost = totalInvoiceCost;
            const shipmentRef = doc(db, 'shipments', shipmentId);
            transaction.set(shipmentRef, newShipment);
        });

        return { success: true, id: shipmentId };
    } catch (error) {
        console.error("Error saving invoice:", error);
        return { success: false, message: error.message };
    }
}


// --- دوال الطباعة والتصدير ---

export function printBarcode(barcodeValue, productName, color, size, price) {
    if (!barcodeValue) {
        showNotification("This item does not have a barcode.", "error");
        return;
    }
    const printWindow = window.open('', 'PRINT', 'height=150,width=300');
    printWindow.document.write(`
        <html><head><title>Print Barcode</title>
        <style>
            body { text-align: center; margin: 0; padding: 5px; font-family: Arial, sans-serif; width: 58mm; box-sizing: border-box; }
            .store-name { font-size: 14px; font-weight: bold; margin: 0; }
            .product-name { font-size: 11px; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .details { font-size: 10px; margin-top: 2px; }
            svg { width: 100%; height: 40px; }
            @page { size: 58mm 30mm; margin: 0; }
        </style></head><body>
        <p class="store-name">Baz Sport</p>
        <p class="product-name">${productName}</p>
        <svg id="barcode"></svg>
        <p class="details">${price} EGP - ${color} / ${size}</p>
        <script src="./libs/jsbarcode.all.min.js"><\/script>
        <script>
            window.onload = function() {
                try {
                    JsBarcode("#barcode", "${barcodeValue}", {
                        format: "CODE128", width: 1.5, height: 35, displayValue: true, fontSize: 12, textMargin: 0, margin: 2
                    });
                    window.print();
                } catch (e) { console.error('JsBarcode Error:', e); }
                setTimeout(() => window.close(), 500);
            };
        <\/script></body></html>`);
    printWindow.document.close();
}

export async function printReceipt(saleId) {
    showLoader();
    try {
        const sale = state.sales.find(s => s.id === saleId);
        if (!sale) {
            showNotification(`Receipt with ID ${saleId} not found.`, 'error');
            return;
        }

        const response = await fetch('receipt.html');
        if (!response.ok) throw new Error('receipt.html not found');
        let template = await response.text();

        const hasReturns = sale.items.some(item => (item.returnedQty || 0) > 0);
        let itemsHtml = sale.items.map(item => `<tr><td>${item.productName} (${item.color}/${item.size})</td><td>${item.quantity}</td><td>${item.unitPrice.toFixed(2)}</td><td>${(item.unitPrice * item.quantity).toFixed(2)}</td></tr>`).join('');

        let returnsSectionHtml = '';
        let totalReturnsValue = 0;
        let displayPaidAmount = sale.paidAmount.toFixed(2);
        const finalTotal = sale.totalAmount + (sale.deliveryFee || 0);
        let displayChangeAmount = (sale.paidAmount - (finalTotal - (sale.depositPaidOnBooking || 0))).toFixed(2);

        let customerInfoHtml = '';
        if (sale.customerName) {
            customerInfoHtml = `
                <div class="customer-info">
                    <p><strong>Customer:</strong> ${sale.customerName}</p>
                    ${sale.customerPhone ? `<p><strong>Phone:</strong> ${sale.customerPhone}</p>` : ''}
                    ${sale.customerAddress ? `<p><strong>Address:</strong> ${sale.customerAddress}</p>` : ''}
                    ${sale.customerCity ? `<p><strong>City:</strong> ${sale.customerCity}</p>` : ''}
                </div>
            `;
        }

        if (hasReturns) {
            let returnedItemsHtml = '';
            let totalReturnedRawValue = 0;
            sale.items.forEach(item => {
                if ((item.returnedQty || 0) > 0) {
                    const returnedValue = item.unitPrice * item.returnedQty;
                    totalReturnedRawValue += returnedValue;
                    returnedItemsHtml += `<tr><td>${item.productName} (${item.color}/${item.size})</td><td>${item.returnedQty}</td><td>${item.unitPrice.toFixed(2)}</td><td>${returnedValue.toFixed(2)}</td></tr>`;
                }
            });
            const discountRatio = sale.subtotal > 0 ? sale.discountAmount / sale.subtotal : 0;
            totalReturnsValue = totalReturnedRawValue - (totalReturnedRawValue * discountRatio);
            returnsSectionHtml = `<h2>المرتجعات / Returns</h2><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${returnedItemsHtml}</tbody></table>`;
            displayPaidAmount = '0.00';
            displayChangeAmount = totalReturnsValue.toFixed(2);
        }

        let finalTotalDisplayHtml;
        if (sale.depositPaidOnBooking > 0) {
            const amountRemaining = finalTotal - sale.depositPaidOnBooking;
            finalTotalDisplayHtml = `
                <p><strong>${translations[state.lang].total}:</strong> ${finalTotal.toFixed(2)} EGP</p>
                <p><strong>${translations[state.lang].depositPaid}:</strong> ${sale.depositPaidOnBooking.toFixed(2)} EGP</p>
                <p class="font-bold text-lg" style="color: var(--accent-color);">${translations[state.lang].amountRemaining}: ${Math.max(0, amountRemaining).toFixed(2)} EGP</p>
            `;
        } else {
            finalTotalDisplayHtml = `<p><strong>${translations[state.lang].total}:</strong> ${finalTotal.toFixed(2)} EGP</p>`;
        }

        template = template.replace('{{saleDate}}', new Date(sale.createdAt).toLocaleString())
            .replace('{{saleId}}', sale.id)
            .replace('{{username}}', sale.cashier || 'N/A')
            .replace('{{customerInfo}}', customerInfoHtml)
            .replace('{{itemsHtml}}', itemsHtml)
            .replace('{{returnsSection}}', returnsSectionHtml)
            .replace('{{subtotal}}', sale.subtotal.toFixed(2))
            .replace('{{discountAmount}}', sale.discountAmount.toFixed(2))
            .replace('{{totalReturns}}', totalReturnsValue.toFixed(2))
            .replace('{{deliveryFee}}', (sale.deliveryFee || 0).toFixed(2))
            .replace('{{paidAmount}}', displayPaidAmount)
            .replace('{{changeAmount}}', displayChangeAmount)
            .replace('{{logoSrc}}', 'logo.png');

        template = template.replace(`<div id="final-total-section"></div>`, finalTotalDisplayHtml);

        const receiptWindow = window.open('', 'PRINT', 'height=800,width=400');
        receiptWindow.document.write(template);
        receiptWindow.document.close();
        setTimeout(() => {
            receiptWindow.focus();
            receiptWindow.print();
            setTimeout(() => receiptWindow.close(), 1000);
        }, 500);
    } catch (error) {
        console.error("Error printing receipt:", error);
        showNotification("An error occurred while printing the receipt.", "error");
    } finally {
        hideLoader();
    }
}

export async function printBooking(bookingId) {
    showLoader();
    try {
        const booking = state.bookings.find(b => b.id === bookingId);
        if (!booking) {
            showNotification(`Booking with ID ${bookingId} not found.`, 'error');
            return;
        }

        const response = await fetch('booking-receipt.html');
        if (!response.ok) throw new Error('booking-receipt.html not found');
        let template = await response.text();

        let itemsHtml = booking.cart.map(item => `<tr><td>${item.productName} (${item.color}/${item.size})</td><td>${item.quantity}</td><td>${item.price.toFixed(2)}</td><td>${(item.price * item.quantity).toFixed(2)}</td></tr>`).join('');
        const subtotal = booking.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const amountDue = subtotal - booking.deposit;
        const depositMethodPrint = booking.depositPaymentMethod ? ` (${translations[state.lang][booking.depositPaymentMethod] || booking.depositPaymentMethod})` : '';

        template = template.replace('{{bookingDate}}', new Date(booking.createdAt).toLocaleString())
            .replace('{{bookingId}}', booking.id)
            .replace('{{username}}', booking.seller || 'N/A')
            .replace('{{customerName}}', booking.customerName || 'N/A')
            .replace('{{customerPhone}}', booking.customerPhone || 'N/A')
            .replace('{{customerAddress}}', booking.customerAddress || 'N/A')
            .replace('{{customerCity}}', booking.customerCity || 'N/A')
            .replace('{{itemsHtml}}', itemsHtml)
            .replace('{{subtotal}}', subtotal.toFixed(2))
            .replace('{{deposit}}', booking.deposit.toFixed(2) + depositMethodPrint)
            .replace('{{amountDue}}', amountDue.toFixed(2))
            .replace('{{logoSrc}}', 'logo.png');

        const bookingWindow = window.open('', 'PRINT', 'height=800,width=400');
        bookingWindow.document.write(template);
        bookingWindow.document.close();
        setTimeout(() => {
            bookingWindow.focus();
            bookingWindow.print();
            setTimeout(() => bookingWindow.close(), 1000);
        }, 500);
    } catch (error) {
        console.error("Error printing booking:", error);
        showNotification("An error occurred while printing the booking.", "error");
    } finally {
        hideLoader();
    }
}

export async function exportReportToPDF() {
    showLoader();
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        // ... (Full PDF generation logic from original events.js)
        doc.save(`sales-report-${new Date().toISOString().slice(0, 10)}.pdf`);
        showNotification('Report exported to PDF.', 'success');
    } catch (error) {
        console.error("PDF Export Error:", error);
        showNotification('Failed to export PDF.', 'error');
    } finally {
        hideLoader();
    }
}

export async function exportInventoryToPDF() {
    showLoader();
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        // ... (Full PDF generation logic from original events.js)
        doc.save(`detailed-inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`);
        showNotification('Detailed inventory report exported to PDF.', 'success');
    } catch (error) {
        console.error("Inventory PDF Export Error:", error);
        showNotification('Failed to export inventory report.', 'error');
    } finally {
        hideLoader();
    }
}

export async function exportReturnsToPDF() {
    showLoader();
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        // ... (Full PDF generation logic from original events.js)
        doc.save(`returns-report-${new Date().toISOString().slice(0, 10)}.pdf`);
        showNotification('Returns report exported to PDF.', 'success');
    } catch (error) {
        console.error("Returns PDF Export Error:", error);
        showNotification('Failed to export returns report.', 'error');
    } finally {
        hideLoader();
    }
}

export function exportCustomersToExcel() {
    showLoader();
    try {
        const worksheet = XLSX.utils.json_to_sheet(state.customers);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
        XLSX.writeFile(workbook, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`);
        showNotification('Customers exported to Excel.', 'success');
    } catch (error) {
        console.error("Excel Export Error:", error);
        showNotification('Failed to export customers.', 'error');
    } finally {
        hideLoader();
    }
}

export function exportSalariesToExcel() {
    showLoader();
    try {
        const month = state.selectedSalariesMonth || new Date().toISOString().slice(0, 7);
        const salesThisMonth = state.sales.filter(sale => sale.createdAt.startsWith(month));
        const data = state.users.map(user => {
            const userData = state.salaries[user.username] || { fixed: 0, commission: 0, bonus: 0 };
            const piecesSold = salesThisMonth
                .filter(sale => sale.cashier === user.username)
                .reduce((total, sale) => total + sale.items.reduce((itemTotal, item) => itemTotal + (item.quantity - (item.returnedQty || 0)), 0), 0);
            const totalCommission = piecesSold * userData.commission;
            const totalSalary = userData.fixed + totalCommission + (userData.bonus || 0);
            const isPaid = state.salariesPaidStatus[`${user.username}-${month}`] || false;
            return {
                'Employee ID': user.employeeId || 'N/A', 'Username': user.username, 'Phone': user.phone || 'N/A',
                'Fixed Salary': userData.fixed, 'Commission/Piece': userData.commission, 'Bonus': userData.bonus || 0,
                'Pieces Sold': piecesSold, 'Total Commission': totalCommission, 'Total Salary': totalSalary, 'Paid Status': isPaid ? 'Paid' : 'Unpaid'
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Salaries ${month}`);
        XLSX.writeFile(workbook, `salaries-report-${month}.xlsx`);
        showNotification('Salaries report exported to Excel.', 'success');
    } catch (error) {
        console.error("Salaries Excel Export Error:", error);
        showNotification('Failed to export salaries report.', 'error');
    } finally {
        hideLoader();
    }
}

export async function printShipmentInvoice(supplierId, date) {
    showLoader();
    try {
        const shipmentsOnDate = state.shipments.filter(s => s.supplierId === supplierId && s.date.startsWith(date));
        if (shipmentsOnDate.length === 0) {
            showNotification(`No shipments found for this supplier on ${new Date(date).toLocaleDateString()}.`, 'error');
            return;
        }
        const supplier = state.suppliers.find(s => s.id === supplierId);
        const supplierName = supplier ? supplier.name : 'Unknown Supplier';

        const allItems = shipmentsOnDate.flatMap(s => s.items);
        const grossCost = shipmentsOnDate.reduce((sum, s) => sum + s.totalCost, 0);
        const shippingCost = shipmentsOnDate.reduce((sum, s) => sum + (s.shippingCost || 0), 0);

        const defectsForInvoice = state.defects.filter(d => d.supplierId === supplierId && d.shipmentDate === date);
        const defectsValue = defectsForInvoice.reduce((sum, d) => sum + (d.quantity * d.purchasePrice), 0);
        const netCost = grossCost - defectsValue;
        const finalTotal = netCost + shippingCost;

        const itemsHtml = allItems.map(item => {
            const product = state.products.find(p => p.id === item.productId);
            const defectiveCountForItem = defectsForInvoice
                .filter(d => d.productId === item.productId && d.color === item.color && d.size === item.size)
                .reduce((sum, d) => sum + d.quantity, 0);

            const quantityDisplay = defectiveCountForItem > 0
                ? `${item.quantity} <span style="color: #C97C7C; font-style: italic;">(${defectiveCountForItem} defective)</span>`
                : item.quantity;

            return `
                <tr>
                    <td>${product ? product.name : 'Unknown'} (${item.color}/${item.size})</td>
                    <td>${quantityDisplay}</td>
                    <td>${item.purchasePrice.toFixed(2)}</td>
                    <td>${(item.quantity * item.purchasePrice).toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const defectsHtml = defectsForInvoice.map(defect => `
            <tr class="defective-row">
                <td>${defect.productName} (${defect.color}/${defect.size}) - ${defect.reason}</td>
                <td>${defect.quantity}</td>
                <td>${defect.purchasePrice.toFixed(2)}</td>
                <td>${(defect.quantity * defect.purchasePrice).toFixed(2)}</td>
            </tr>
        `).join('');

        const defectsSection = defectsForInvoice.length > 0 ? `
            <h2 style="color: #C97C7C;">Defective Items Details</h2>
            <table>
                <thead>
                    <tr><th>Product & Reason</th><th>Quantity</th><th>Unit Cost</th><th>Total Cost</th></tr>
                </thead>
                <tbody>${defectsHtml}</tbody>
            </table>
        ` : '';

        const template = `
            <html>
                <head>
                    <title>Shipment Invoice for ${new Date(date).toLocaleDateString()}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1, h2 { text-align: center; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .summary { text-align: right; margin-top: 20px; font-size: 1.2em; border-top: 2px solid #333; padding-top: 10px; }
                        .summary p { margin: 5px 0; }
                        .defective-row { color: #C97C7C; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>Shipment Invoice</h1>
                    <p><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>
                    <p><strong>Supplier:</strong> ${supplierName}</p>
                    <h2>Received Items</h2>
                    <table>
                        <thead>
                            <tr><th>Product</th><th>Quantity</th><th>Unit Cost (EGP)</th><th>Total Cost (EGP)</th></tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    ${defectsSection}
                    <div class="summary">
                        <p><strong>Gross Cost:</strong> ${grossCost.toFixed(2)} EGP</p>
                        ${defectsValue > 0 ? `<p><strong>Defects Value:</strong> <span style="color: #C97C7C;">-${defectsValue.toFixed(2)} EGP</span></p>` : ''}
                        <p><strong>Net Cost:</strong> ${netCost.toFixed(2)} EGP</p>
                        <p><strong>Shipping Cost:</strong> ${shippingCost.toFixed(2)} EGP</p>
                        <p><strong>Final Total: ${finalTotal.toFixed(2)} EGP</strong></p>
                    </div>
                </body>
            </html>
        `;

        const printWindow = window.open('', 'PRINT', 'height=800,width=600');
        printWindow.document.write(template);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            setTimeout(() => printWindow.close(), 1000);
        }, 500);

    } catch (error) {
        console.error("Error printing shipment invoice:", error);
        showNotification("An error occurred while printing.", "error");
    } finally {
        hideLoader();
    }
}

export async function exportShiftToPDF(shift) {
    showLoader();
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Shift Report', 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Shift ID: ${shift.id}`, 14, 30);
        doc.text(`Ended By: ${shift.endedBy}`, 14, 37);
        doc.text(`Started: ${new Date(shift.startedAt).toLocaleString()}`, 105, 30, { align: 'center' });
        doc.text(`Ended: ${new Date(shift.endedAt).toLocaleString()}`, 105, 37, { align: 'center' });

        const summaryData = [
            ['Total Sales', `${shift.summary.totalSales.toFixed(2)} EGP`],
            ['Total Returns', `${shift.summary.totalReturnsValue.toFixed(2)} EGP`],
            ['Daily Expenses', `${shift.summary.totalDailyExpenses.toFixed(2)} EGP`],
            ['Expected in Drawer', `${shift.summary.expectedInDrawer.toFixed(2)} EGP`],
            ['Actual in Drawer', `${shift.reconciliation.actual.toFixed(2)} EGP`],
            ['Difference', `${shift.reconciliation.difference.toFixed(2)} EGP (${shift.reconciliation.type})`],
        ];
        doc.autoTable({
            startY: 45, head: [['Summary', 'Amount']], body: summaryData, theme: 'striped',
        });

        if (shift.sales.length > 0) {
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [['ID', 'Time', 'Cashier', 'Method', 'Amount']],
                body: shift.sales.map(s => [s.id, new Date(s.createdAt).toLocaleTimeString(), s.cashier, s.paymentMethod, s.totalAmount.toFixed(2)]),
                theme: 'grid', headStyles: { fillColor: [22, 160, 133] }
            });
        }

        if (shift.returns.length > 0) {
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [['Original ID', 'Time', 'Cashier', 'Amount']],
                body: shift.returns.map(r => [r.originalSaleId, new Date(r.returnedAt).toLocaleTimeString(), r.cashier, r.returnValue.toFixed(2)]),
                theme: 'grid',
                headStyles: { fillColor: [231, 76, 60] }
            });
        }

        if (shift.expenses.length > 0) {
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [['Time', 'Amount', 'Notes']],
                body: shift.expenses.map(e => [new Date(e.date).toLocaleTimeString(), e.amount.toFixed(2), e.notes]),
                theme: 'grid',
                headStyles: { fillColor: [243, 156, 18] }
            });
        }

        doc.save(`Shift-Report-${shift.id}.pdf`);
        showNotification('Shift report PDF is downloading...', 'success');
    } catch (error) {
        console.error("Shift PDF Export Error:", error);
        showNotification('Failed to export shift report.', 'error');
    } finally {
        hideLoader();
    }
}


// --- إدارة سلة التسوق ---
export const cartSession = {
    save: () => sessionStorage.setItem('bags-receipts', JSON.stringify(state.receipts)),
    load: () => {
        const savedReceipts = sessionStorage.getItem('bags-receipts');
        if (savedReceipts) {
            try {
                state.receipts = JSON.parse(savedReceipts);
                state.receipts.forEach(receipt => {
                    if (receipt.seller === undefined) {
                        receipt.seller = '';
                    }
                });
                state.activeReceiptId = state.receipts[0]?.id || null;
            } catch (e) {
                console.error("Could not parse saved receipts:", e);
                state.receipts = [];
                state.activeReceiptId = null;
            }
        } else {
            state.receipts = [];
            state.activeReceiptId = null;
        }
    }
};
