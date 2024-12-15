import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    getDocs,
    deleteDoc,
    doc,
    onSnapshot,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

// Import translations
import { translations } from './translations.js';

// Firebase configuration - replace with your config
const firebaseConfig = {
    apiKey: "AIzaSyBINASb03JE0aDoazbEISJYqMy41tR5Q44",
    authDomain: "expense-tracker-2024-8d7d3.firebaseapp.com",
    projectId: "expense-tracker-2024-8d7d3",
    storageBucket: "expense-tracker-2024-8d7d3.firebasestorage.app",
    messagingSenderId: "295425155233",
    appId: "1:295425155233:web:50a1308dc351b26f7dd0e0"
    // Add your Firebase config here
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let allExpenses = [];
let allCategories = new Set(['Family', 'Personal', 'Tax', 'Insurance']);
let currentLang = localStorage.getItem('preferredLanguage') || 'en';
let allFrequencies = new Set(['one-off', 'monthly', 'annual']);

// DOM Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const expenseForm = document.getElementById('expenseForm');
const expenseList = document.getElementById('expenseList');
const categorySelect = document.getElementById('category');
const frequencySelect = document.getElementById('frequency');
const ytdTotalDiv = document.getElementById('ytdTotal');
const categoryBreakdownDiv = document.getElementById('categoryBreakdown');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupCurrencyListeners();
    updateLanguage(currentLang);
    updateFrequencySelect();
});

// Authentication state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('signupSection').style.display = 'none';
        document.getElementById('expenseSection').style.display = 'block';
        document.getElementById('userEmail').textContent = user.email;
        loadExpenses();
    } else {
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('signupSection').style.display = 'none';
        document.getElementById('expenseSection').style.display = 'none';
    }
});

// Setup Event Listeners
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    });

    // Signup form
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            alert('Signup failed: ' + error.message);
        }
    });

    // Switch between login and signup
    document.getElementById('switchToSignup').addEventListener('click', () => {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('signupSection').style.display = 'block';
    });

    document.getElementById('switchToLogin').addEventListener('click', () => {
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('signupSection').style.display = 'none';
    });

    // Logout button
    document.getElementById('logoutButton').addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            alert('Logout failed: ' + error.message);
        }
    });

    // Category select
    categorySelect.addEventListener('change', (e) => {
        if (e.target.value === 'add-new') {
            const newCategory = prompt('Enter new category name:');
            if (newCategory) {
                allCategories.add(newCategory);
                updateCategorySelect();
                e.target.value = newCategory;
            } else {
                e.target.value = '';
            }
        }
    });

    // Expense form
    expenseForm.addEventListener('submit', handleExpenseSubmit);

    // Frequency select
    frequencySelect.addEventListener('change', (e) => {
        if (e.target.value === 'add-new') {
            const modal = document.getElementById('frequencyModal');
            const input = document.getElementById('newFrequencyInput');
            const cancelBtn = document.getElementById('cancelFrequency');
            const confirmBtn = document.getElementById('confirmFrequency');

            modal.style.display = 'flex';
            input.value = '';
            input.focus();

            cancelBtn.onclick = () => {
                modal.style.display = 'none';
                e.target.value = 'one-off'; // Reset to default
            };

            confirmBtn.onclick = () => {
                const newFrequency = input.value.trim().toLowerCase();
                if (newFrequency) {
                    allFrequencies.add(newFrequency);
                    updateFrequencySelect();
                    e.target.value = newFrequency;
                } else {
                    e.target.value = 'one-off'; // Reset to default
                }
                modal.style.display = 'none';
            };

            // Close on outside click
            modal.onclick = (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                    e.target.value = 'one-off'; // Reset to default
                }
            };
        }
    });
}

// Setup Currency Listeners
function setupCurrencyListeners() {
    const originalAmount = document.getElementById('originalAmount');
    const usdAmount = document.getElementById('usdAmount');
    const currency = document.getElementById('currency');

    // Add listeners for currency conversion
    originalAmount.addEventListener('input', updateUSDAmount);
    currency.addEventListener('change', updateUSDAmount);
}

// Currency conversion (simplified - you might want to use a real API)
async function updateUSDAmount() {
    const originalAmount = document.getElementById('originalAmount').value;
    const currency = document.getElementById('currency').value;
    const usdAmount = document.getElementById('usdAmount');

    // Simple conversion rates (you should use a real API)
    const rates = {
        RMB: 0.14,  // Added RMB rate (1 RMB = 0.14 USD)
        USD: 1,
        EUR: 1.1,
        GBP: 1.27,
        JPY: 0.007,
        HKD: 0.128
    };

    usdAmount.value = (originalAmount * rates[currency]).toFixed(2);
}

// Handle Expense Submit
async function handleExpenseSubmit(e) {
    e.preventDefault();
    
    try {
        const expense = {
            description: document.getElementById('description').value,
            originalAmount: parseFloat(document.getElementById('originalAmount').value),
            currency: document.getElementById('currency').value,
            usdAmount: parseFloat(document.getElementById('usdAmount').value),
            date: document.getElementById('date').value,
            category: document.getElementById('category').value,
            frequency: document.getElementById('frequency').value,
            userId: auth.currentUser.uid,
            timestamp: serverTimestamp()
        };

        await addDoc(collection(db, 'expenses'), expense);
        expenseForm.reset();
        
        // Refresh the displays after adding
        await loadExpenses();
        
    } catch (error) {
        console.error('Error adding expense:', error);
        alert('Error adding expense: ' + error.message);
    }
}

// Load and display expenses
function loadExpenses() {
    const q = query(
        collection(db, 'expenses'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('date', 'desc')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
        allExpenses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayExpenses();
        updateYTDSummary();
    }, (error) => {
        console.error('Error loading expenses:', error);
    });

    // Store unsubscribe function for cleanup
    window.addEventListener('beforeunload', unsubscribe);
}

// Display expenses
function displayExpenses() {
    expenseList.innerHTML = '';
    
    allExpenses.forEach(expense => {
        const div = document.createElement('div');
        div.className = 'expense-item';
        
        // Update this line to handle both formats of frequency translation
        const translatedFrequency = translations[currentLang][expense.frequency] || 
                                  translations[currentLang][expense.frequency.replace('-', '')] ||
                                  expense.frequency;
        
        div.innerHTML = `
            <div class="expense-item-header">
                <div class="expense-description">${expense.description}</div>
                <button class="delete-button" onclick="deleteExpense('${expense.id}')" data-translate="delete">
                    ${translations[currentLang].delete}
                </button>
            </div>
            <div class="expense-meta">
                ${translations[currentLang][expense.category.toLowerCase()] || expense.category} 
                ${translations[currentLang].bullet} 
                ${translatedFrequency} 
                ${translations[currentLang].bullet} 
                ${expense.date}
            </div>
            <div class="expense-amounts">
                <span class="original-amount">${expense.currency} ${Math.round(expense.originalAmount).toLocaleString()}</span>
                <span class="usd-amount">USD ${Math.round(expense.usdAmount).toLocaleString()}</span>
            </div>
        `;
        
        expenseList.appendChild(div);
    });
}

// Update YTD Summary
function updateYTDSummary() {
    const currentYear = new Date().getFullYear();
    const rmbRate = 7.14; // 1 USD = 7.14 RMB
    
    // Calculate YTD total in USD
    const ytdTotalUSD = allExpenses
        .filter(expense => expense.date && expense.date.startsWith(currentYear.toString()))
        .reduce((sum, expense) => sum + (expense.usdAmount || 0), 0);
    
    const ytdTotalRMB = ytdTotalUSD * rmbRate;
    
    // Format amounts
    const formattedUSD = Math.round(ytdTotalUSD).toLocaleString();
    const formattedRMB = Math.round(ytdTotalRMB).toLocaleString();
    
    // Update YTD total display
    ytdTotalDiv.textContent = translations[currentLang].ytdTotal
        .replace('{usd}', formattedUSD)
        .replace('{rmb}', formattedRMB);
    
    // Calculate and display category breakdown
    const categoryTotals = {};
    allExpenses
        .filter(expense => expense.date && expense.date.startsWith(currentYear.toString()))
        .forEach(expense => {
            if (expense.category && expense.usdAmount) {
                categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.usdAmount;
            }
        });
    
    // Display category breakdown with both USD and RMB
    categoryBreakdownDiv.innerHTML = Object.entries(categoryTotals)
        .map(([category, totalUSD]) => {
            const totalRMB = totalUSD * rmbRate;
            const categoryTranslation = translations[currentLang][category.toLowerCase()] || category;
            
            return `
                <div class="category-total">
                    ${translations[currentLang].categoryTotal
                        .replace('{category}', categoryTranslation)
                        .replace('{usd}', Math.round(totalUSD).toLocaleString())
                        .replace('{rmb}', Math.round(totalRMB).toLocaleString())}
                </div>
            `;
        }).join('');
}

// Delete expense
window.deleteExpense = async function(id) {
    if (confirm(translations[currentLang].confirmDelete || 'Are you sure you want to delete this expense?')) {
        try {
            await deleteDoc(doc(db, 'expenses', id));
            
            // Immediately update local array and UI
            allExpenses = allExpenses.filter(expense => expense.id !== id);
            displayExpenses();
            updateYTDSummary();
            
            // Show feedback (optional)
            const feedbackMsg = document.createElement('div');
            feedbackMsg.className = 'feedback success';
            feedbackMsg.textContent = translations[currentLang].deleteSuccess || 'Expense deleted successfully';
            document.getElementById('expenseList').prepend(feedbackMsg);
            setTimeout(() => feedbackMsg.remove(), 3000);
            
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert(translations[currentLang].deleteError || 'Error deleting expense: ' + error.message);
        }
    }
}

// Update category select options
function updateCategorySelect() {
    categorySelect.innerHTML = `
        <option value="" data-translate="selectCategory">${translations[currentLang].selectCategory}</option>
        ${Array.from(allCategories)
            .map(category => {
                const translationKey = category.toLowerCase();
                const displayText = translations[currentLang][translationKey] || category;
                return `<option value="${category}" data-translate="${translationKey}">${displayText}</option>`;
            })
            .join('')}
        <option value="add-new" data-translate="addCategory">${translations[currentLang].addCategory}</option>
    `;
} 

// Update language handling function
function updateLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('preferredLanguage', lang);
    
    // Update text content for static elements
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });
    
    // Update select options
    document.querySelectorAll('select option[data-translate]').forEach(option => {
        const key = option.getAttribute('data-translate');
        if (translations[lang][key]) {
            option.textContent = translations[lang][key];
        }
    });

    // Update flag visibility
    document.getElementById('en-flag').classList.toggle('active', lang === 'en');
    document.getElementById('zh-flag').classList.toggle('active', lang === 'zh');

    // Refresh all dynamic content
    if (auth.currentUser) {  // Only refresh if user is logged in
        displayExpenses();    // Refresh expense list
        updateYTDSummary();   // Refresh YTD total and category breakdown
        updateCategorySelect(); // Refresh category dropdown
        updateFrequencySelect(); // Refresh frequency dropdown
    }
}

// Add event listeners for flags
document.getElementById('en-flag').addEventListener('click', () => updateLanguage('en'));
document.getElementById('zh-flag').addEventListener('click', () => updateLanguage('zh'));

// Add function to update frequency select
function updateFrequencySelect() {
    frequencySelect.innerHTML = `
        ${Array.from(allFrequencies)
            .map(freq => {
                const translatedFreq = translations[currentLang][freq] || 
                                     translations[currentLang][freq.replace('-', '')] ||
                                     freq;
                return `
                    <option value="${freq}" data-translate="${freq}">
                        ${translatedFreq}
                    </option>
                `;
            }).join('')}
        <option value="add-new" data-translate="addOther">
            ${translations[currentLang].addOther}
        </option>
    `;
}

// Add these translations
const newTranslations = {
    en: {
        confirmDelete: "Are you sure you want to delete this expense?",
        deleteSuccess: "Expense deleted successfully",
        deleteError: "Error deleting expense: "
    },
    zh: {
        confirmDelete: "确定要删除这笔支出吗？",
        deleteSuccess: "支出已成功删除",
        deleteError: "删除支出时出错："
    }
};

// Update your translations object with these new entries
Object.assign(translations.en, newTranslations.en);
Object.assign(translations.zh, newTranslations.zh);
