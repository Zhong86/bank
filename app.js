//VARIABLES
let state = Object.freeze({
  account: null
}); //checked if logged in 

const storageKey = 'savedAccount'; 

function init() {
  const savedAccount = localStorage.getItem(storageKey); 
  if (savedAccount) {
    updateState('account', JSON.parse(savedAccount)); 
  }

  window.onpopstate = () => updateRoute(); 
  updateRoute(); 

  console.log("initiating");
}

function updateState(property, newData) {
  state = Object.freeze({
    ...state, 
    [property]: newData
  }); 
  localStorage.setItem(storageKey, JSON.stringify(state.account)); 
 
  console.log(state);
}

//NAVIGATION
const routes = {
  '/login': { templateId: 'login' }, 
  '/dashboard': { templateId: 'dashboard', init: initDashboard }
};

function updateRoute() {
  console.log("update route");

  const path = window.location.pathname; 
  const route = routes[path]; 

  if (!route) {
    return navigate('/dashboard'); 
  }
  const template = document.getElementById(route.templateId);
  const view = template.content.cloneNode(true); 
  const app = document.getElementById('app'); 
  app.innerHTML = ''; 
  app.appendChild(view); 

  if (typeof route.init === 'function') {
    route.init(); 
  }
}

function navigate(path) {
  window.history.pushState({}, path, path);
  updateRoute(); 
}

function onLinkClick(event) {
  event.preventDefault(); 
  navigate(event.target.href); 
}

//FORM HANDLING
async function register() {
  const registerForm = document.getElementById('registerForm'); 
  const submitButton = registerForm.querySelector('button[type="submit"]'); 

  try {
    //show loading state
    submitButton.disabled = true; 
    submitButton.textContent = 'Creating Account...';

    //process form data
    const formData = new FormData(registerForm); //Gets the JSON file
    const data = Object.fromEntries(formData); 
    const jsonData = JSON.stringify(data); 
    
    //send to server
    const result = await createAccount(jsonData); 
    
    if (result.error) {
      return updateElement('registerError', result.error); 
    }

    console.log('Account created succesfully!', result); 
    alert(`Welcome, ${result.user}. Your account has been created.`); 
    
    registerForm.reset(); 
    updateState('account', result); 
    navigate('/dashboard'); 

  } catch (error) {
    console.error('Unexpected error: ', error); 
    alert(`An unexpected error occured. Please try again.`); 
  } finally { //restores UI state regardless if error or not
    submitButton.disabled = false; 
    submitButton.textContent = 'Create Account'; 
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm'); 
  if(!registerForm) return; 
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault(); //Prevents default form submission
    register(); 
  }); 
}); 

//CREATE ACCOUNT
async function createAccount(account) {
  try {
    const response = await fetch('//192.168.1.11:5000/api/accounts', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json', 
        'Accept': 'application/json', 
      },
      body: account
    }); 

    if (!response.ok) {
      throw new Error(`HTTP error. Status: ${response.status}`); 
    }
    return await response.json(); 
  } catch (error) {
    console.error('Account creation failed:', error); 
    return { error: error.message || 'Network error occurred' }
  }
}

//LOGIN
async function login() {
  const loginForm = document.getElementById('loginForm'); 
  const user = loginForm.user.value; 
  const data = await getAccount(user); 
  if (data.error) {
    return updateElement('loginError', data.error); 
  }
  
  updateState('account', data); 

  navigate('/dashboard'); 
}

async function getAccount(user) {
  try {
    //fetches data asynchronously
    const response = await fetch('//192.168.1.11:5000/api/accounts/' + encodeURIComponent(user)); 
    return await response.json(); 
  } catch (error) {
    return { error: error.message || 'Unknown error' }; 
  }
}

function logout() {
  updateState('account', null); 
  navigate('/login'); 

  console.log('logging out');
}

//UPDATE UI
function updateElement(id, textOrNode) {
  const element = document.getElementById(id); 
  if (!element) return; 
  element.textContent = '';
  element.append(textOrNode); 
}

function showElement(id) {
  const element = document.getElementById(id); 
  element.style.display = 'block'; 
}

function hideElement(id) {
  const element = document.getElementById(id); 
  element.style.display = 'none'; 
}

function onClickDashboard() {
  const dashboard = document.getElementById('dashboard'); 
  dashboard.onclick = () => { 
    hideElement('createTransactionBloc'); 
  }; 
}

function updateDashboard() {
  const account = state.account;
  if(!account || !Array.isArray(account.transactions)) {
    const txContainer = document.getElementById('transactions'); 
    if(txContainer) txContainer.innerHTML = ''; 
    if(!account)
      console.log('account not found');
    else if( !Array.isArray(account.transactions))
      console.log('transaction not found'); 
    return logout(); 
  }

  updateElement('description', account.description); 
  updateElement('balance', account.balance.toFixed(2)); 
  updateElement('currency', account.currency); 

  const filters = getFiltersFromForm(); 
  const results = filterTransactions(filters, account.transactions); 

  const transactionRows = document.createDocumentFragment(); 
  for (const transaction of results) {
    const transactionRow = createTransactionRow(transaction); 
    transactionRows.appendChild(transactionRow); 
  }
  updateElement('transactions', transactionRows); 

}

function createTransactionRow(transaction) {
  const template = document.getElementById('transaction'); 
  const transactionRow = template.content.cloneNode(true); 
  const tr = transactionRow.querySelector('tr'); 
  tr.children[0].textContent = transaction.date; 
  tr.children[1].textContent = transaction.object; 
  tr.children[2].textContent = transaction.amount.toFixed(2); 
  return transactionRow; 
}

//SEARCH & FILTER
function parseDateSafe(value) { //parse data safely: accepts YYYY-MM-DD
  if(!value) return null; 
  const d= new Date(value); 
  return Number.isNaN(d.getTime()) ? null : d;
}

function getFiltersFromForm() {
  const dateFromEl = document.getElementById('date-from');
  const dateToEl = document.getElementById('date-to');
  const amountMinEl = document.getElementById('amount-min');
  const amountMaxEl = document.getElementById('amount-max');
  const descriptionEl = document.getElementById('description');

  const dateFromStr = dateFromEl ? dateFromEl.value : '';
  const dateToStr = dateToEl ? dateToEl.value : '';
  const amountMinStr = amountMinEl ? amountMinEl.value : '';
  const amountMaxStr = amountMaxEl ? amountMaxEl.value : '';
  const descriptionStr = descriptionEl ? descriptionEl.value : '';
 
  let fromDate = parseDateSafe(dateFromStr); 
  let toDate = parseDateSafe(dateToStr); 

  //if only one bound is provided, keep other null
  if (fromDate && toDate && fromDate > toDate) { 
    const tmp = fromDate; //swap dates
    fromDate = toDate; 
    toDate = tmp; 
  }

  let minAmount = amountMinStr === '' ? null : Number(amountMinStr); 
  let maxAmount = amountMaxStr === '' ? null : Number(amountMaxStr); 

  if (minAmount !== null && Number.isNaN(minAmount)) minAmount = null;
  if (maxAmount !== null && Number.isNaN(maxAmount)) maxAmount = null;

  if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
    const tmp = minAmount; 
    minAmount = maxAmount; 
    maxAmount = tmp; 
  }

  const keywords = (descriptionStr || '')
    .split(/\s+/).map(s => s.trim()).filter(Boolean).map(s => s.toLowerCase()); 
  
  return { fromDate, toDate, minAmount, maxAmount, keywords }; 
}


function filterTransactions(filters, transactions = []) {
  const noFilters = 
    !filters ||  
    (!filters.fromDate && !filters.toDate && filters.minAmount == null 
      && filters.maxAmount== null && (!filters.keywords || filters.keywords.length === 0))
  if (noFilters) {
    return transactions.slice(); 
  }
  
  //checks all transactions and filters
  return transactions.filter(tx => {
    //Date check
    if (filters.fromDate || filters.toDate) {
      const txDate = parseDateSafe(tx.date); 
      if (!txDate) return false; 
      if (filters.fromDate && txDate < filters.fromDate) return false; 
      if (filters.toDate && txDate > filters.toDate) return false; 
    }

    //amount check 
    if (filters.minAmount != null && Number(tx.amount) < filters.minAmount) return false;
    if (filters.maxAmount != null && Number(tx.amount) > filters.maxAmount) return false;
    
    //description 
    if (filters.keywords && filters.keywords.length > 0) {
      const desc = (tx.description || '').toLowerCase(); 
      if(!desc) return false; 
      const allPresent = filters.keywords.every(kw => desc.includes(kw)); 
      if (!allPresent) return false; 
    }

    return true; 
  })
}

//reset filter input
function clearFilters() {
  document.getElementById('search-form').reset(); 
  updateDashboard(); 
}

//Create transaction
async function newTransaction() {
  const transactionForm = document.getElementById('newTransaction'); 
  const submitBtn = transactionForm.querySelector("button[type='submit']"); 
 
  try {
    submitBtn.disabled = true; 
    submitBtn.textContent = "Creating transaction..."; 

    const formData = new FormData(transactionForm); 
    const data = Object.fromEntries(formData); 
    const jsonData = JSON.stringify(data); 

    const result = await createTransaction(jsonData); 

    if(result.error) {
      console.log("Error to create transaction"); 
      return -1; 
    }
    alert(`Successfully created new transaction: ${result.object}!`); 
    transactionForm.reset(); 

    const update = await getAccount(state.account.user); 
    updateState('account', update); 
    updateDashboard(); 
    hideElement('createTransactionBloc'); 
  } catch (error) {
    alert('Failed to create new transaction!'); 
  } finally {
    submitBtn.disabled = false; 
    submitBtn.textContent = "Create"; 
  }
}
async function createTransaction(transaction) {
  try {
    const name = state.account.user;
    const response = await fetch(`//192.168.1.11:5000/api/accounts/${name}/transactions`, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json', 
          'Accept': 'application/json'
      }, 
      body: transaction
    }); 

    if(!response.ok) throw new Error('Failed to update transactions'); 

    return await response.json(); 
  } catch (error) {
    console.error('Error in createTransaction: ', error); 
  } 
}

document.addEventListener('DOMContentLoaded', () => {  
  const transactionForm = document.getElementById('newTransaction'); 
  if(!transactionForm) return; 
  transactionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    newTransaction(); 
  }); 
});

// ==============Dashboard initialization & listeners ============
function initDashboard() {
  attachDashboardListeners(); 
  updateDashboard(); 
}

function attachDashboardListeners() {
  const form = document.getElementById('search-form'); 
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault(); 
      updateDashboard(); 
    });
    const inputs = ['date-form', 'date-to', 'amount-min', 'amount-max', 'description'];
    inputs.forEach(id => {
      const el = document.getElementById(id); 
      if (!el) return; 
      el.addEventListener('input', () => updateDashboard()); 
      el.addEventListener('change', () => updateDashboard()); 
    }); 
  }

  const clearBtn = document.getElementById('clear-filters'); 
  if (clearBtn) clearBtn.addEventListener('click', () => clearFilters()); 
}


document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm'); 
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault(); 
      login(); 
    }); 
  }
});

init(); 


